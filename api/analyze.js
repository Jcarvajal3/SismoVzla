/**
 * ==========================================================================
 * ANALYZE.JS - Vercel Serverless Function for Automated Image Analysis
 * ==========================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Inicializar cliente Supabase con el Service Role Key (evita bypass de RLS del lado del cliente)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = async function handler(req, res) {
  // Manejo de CORS Preflight
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar que Supabase esté configurado
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase no está configurado en el servidor.' });
  }

  const { images, buildingInfo } = req.body;

  // Validaciones
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una imagen.' });
  }
  if (images.length > 4) {
    return res.status(400).json({ error: 'El límite máximo es de 4 imágenes.' });
  }
  if (!buildingInfo) {
    return res.status(400).json({ error: 'La información del inmueble es requerida.' });
  }

  try {
    const reportId = crypto.randomUUID();
    const imageUrls = [];

    // 1. Subir imágenes a Supabase Storage
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.base64) continue;

      const buffer = Buffer.from(img.base64, 'base64');
      const ext = img.mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = `${reportId}/${Date.now()}-${i}.${ext}`;

      const { data, error } = await supabase.storage
        .from('damage-photos')
        .upload(fileName, buffer, {
          contentType: img.mimeType || 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Error al subir imagen a Storage:', error);
        throw new Error(`Fallo al almacenar la imagen ${i + 1} en el servidor.`);
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from('damage-photos')
        .getPublicUrl(fileName);

      if (publicUrlData && publicUrlData.publicUrl) {
        imageUrls.push(publicUrlData.publicUrl);
      }
    }

    // Filtrar imágenes con datos base64 válidos para el payload de Gemini
    const validImages = images.filter(img => img.base64);
    if (validImages.length === 0) {
      return res.status(400).json({ error: 'Ninguna imagen contenía datos válidos.' });
    }

    // 2. Construir Prompt para Gemini
    // Marco técnico basado en: "Evaluación Rápida de Daños en Edificaciones"
    // López O.A., Coronel G., Ginés C., Fierro F., Marinilli A. y Urich A.
    // Boletín Nº 61, Academia Nacional de la Ingeniería y el Hábitat (ANIH), 2023.
    const prompt = `Eres un ingeniero estructural con 20 años de experiencia evaluando daños post-sísmicos en edificaciones en Venezuela y Latinoamérica. Aplicas rigurosamente la metodología de "Evaluación Rápida de Daños en Edificaciones" desarrollada por FUNVISIS y la Academia Nacional de la Ingeniería y el Hábitat (ANIH, Boletín 61, 2023), basada en las metodologías internacionales de Japón (BRI), Chile (MOP) y USA (ATC-20).

Analiza las siguientes imágenes de un inmueble afectado por el terremoto en Venezuela (junio 2026).

INFORMACIÓN DEL INMUEBLE:
- Tipo: ${buildingInfo.tipo_inmueble || 'casa'}
- Ubicación: ${buildingInfo.estado || 'No especificado'}, ${buildingInfo.municipio || 'No especificado'}
- Edificio: ${buildingInfo.nombre_edificio || 'No especificado'}
- Piso donde está el daño: ${buildingInfo.piso || 'No especificado'}
- Descripción del usuario: ${buildingInfo.descripcion_usuario || 'Sin descripción'}

═══════════════════════════════════════════════════════
MARCO TÉCNICO DE REFERENCIA - METODOLOGÍA ANIH 2023
═══════════════════════════════════════════════════════

PROTOCOLO DE EVALUACIÓN ESCALONADA:
La evaluación sigue un orden de prioridad. Si detectas condiciones del nivel más grave, asigna inmediatamente el riesgo correspondiente sin requerir condiciones adicionales.

PASO 1 — EVALUACIÓN EXTERNA (sin necesidad de acceso interior):
Determina si hay condiciones de riesgo externo evaluando visualmente:
  • Colapso de la estructura: Posible (edificio desplazado/deformado), Parcial o Total → Riesgo Externo ALTO
  • Peligro por edificios aledaños: Moderado o Elevado (edificios vecinos inestables o colapsados)
  • Peligro geológico/geotécnico: Agrietamiento del pavimento/terreno, deslizamiento de taludes, licuación
  • Asentamiento del edificio: Hasta 20 cm → Medio; Mayor a 20 cm → Alto
  • Inclinación del edificio: Hasta 2 cm por cada 60 cm de altura → Medio; Mayor → Alto
  REGLA: Si hay cualquier aspecto ALTO en la evaluación externa → Riesgo C. Alto (Etiqueta ROJA)

PASO 2 — DAÑO SEVERO O COMPLETO EN ELEMENTOS ESTRUCTURALES PRINCIPALES:
Si se observa al menos UN (N≥1) elemento con daño Severo o Completo → Riesgo C. Alto (Etiqueta ROJA)
No es necesario continuar evaluando otros elementos.

PASO 3 — PORCENTAJE DE DAÑO MODERADO (solo si no hay daño Severo/Completo):
Estima el porcentaje de elementos estructurales con daño Moderado:
  • Menos del 10% → Riesgo A. Bajo
  • Entre 10% y 30% → Riesgo B. Medio
  • Más del 30% → Riesgo C. Alto

PASO 4 — COMPONENTES NO ESTRUCTURALES (paredes de relleno, tabiquería):
Evalúa el riesgo de caída de componentes no estructurales y asigna nivel de riesgo.

REGLA FINAL: El riesgo global es el MÁS DESFAVORABLE entre los pasos 1 al 4.

═══════════════════════════════════════════════════════
CRITERIOS DE CLASIFICACIÓN DE DAÑO POR TIPO DE ELEMENTO
═══════════════════════════════════════════════════════

A. COLUMNAS DE CONCRETO ARMADO (Fuente: Kaminosono et al., 2002 adaptado por ANIH):
   • Daño MENOR:    Grietas < 1 mm de ancho. Sin desprendimiento de material.
   • Daño MODERADO: Grietas entre 1 mm y 2 mm de ancho.
   • Daño SEVERO:   Grietas > 2 mm de ancho, ACOMPAÑADAS de desconchado y caída de porciones del concreto de recubrimiento. IMPORTANTE: el ancho solo no define Severo, debe existir también el desconchado.
   • Daño COMPLETO: Caída de porciones importantes de concreto, pandeo/doblado de barras de acero de refuerzo (cabillas), acortamiento visible de la columna.

B. UNIONES O NODOS DE CONCRETO ARMADO (Fuente: Kaminosono et al., 2002 adaptado por ANIH):
   • Daño MENOR:    Caída parcial del recubrimiento de concreto solamente.
   • Daño MODERADO: Caída del recubrimiento Y exposición del acero de refuerzo.
   • Daño SEVERO:   Caída del recubrimiento Y grietas diagonales visibles en el nodo.
   • Daño COMPLETO: Aplastamiento del concreto en el nodo, pandeo de barras.

C. VIGAS DE CONCRETO ARMADO (Fuente: Kaminosono et al., 2002 adaptado por ANIH):
   • Daño MENOR:    Grietas ≤ 1 mm de ancho.
   • Daño MODERADO: Grietas entre 1 mm y 2 mm, ACOMPAÑADAS de aplastamiento local del concreto.
   • Daño SEVERO:   Grietas ≥ 2 mm, ACOMPAÑADAS de aplastamiento local Y amplia pérdida del recubrimiento.
   • Daño COMPLETO: Caída de concreto, doblado de barras de refuerzo, desplazamiento vertical visible de la viga.

D. MUROS DE CONCRETO ARMADO (Fuente: Hurtado, 2013 adaptado por ANIH):
   • Daño MENOR:    Pocas grietas, ancho menor a 2 mm.
   • Daño MODERADO: Grietas con ancho entre 2 mm y 6 mm.
   • Daño SEVERO:   Caída del recubrimiento del concreto. Posible desplazamiento residual del muro.
   • Daño COMPLETO: Grietas anchas, caída de concreto, refuerzo pandeado o fracturado, desplazamiento residual significativo.

E. MUROS PORTANTES DE MAMPOSTERÍA ESTRUCTURAL (muros de bloque o ladrillo que soportan losas/techos):
   • Daño LEVE:     Grietas hasta 1 mm en la superficie.
   • Daño MODERADO: Agrietamiento diagonal incipiente, grietas entre 1 mm y 3 mm.
   • Daño SEVERO:   Agrietamiento diagonal severo con grietas > 3 mm, dislocación de algunas piezas de mampostería.
   • Daño COMPLETO: Desprendimiento de piezas, aplastamiento local, prolongación de grietas diagonales en machones/vigas de corona, inclinación del muro, desplome parcial.

F. PAREDES DE RELLENO (tabiquería no estructural en pórticos de concreto o acero):
   • Riesgo BAJO (Daño Leve):   Grietas muy pequeñas, no mayores a 1 mm de espesor.
   • Riesgo MEDIO (Moderado-Severo): Grietas de varios mm o cm, posible rotura y desprendimiento en esquinas o bordes de ventana, grietas diagonales, posible separación entre la pared y la estructura portante.
   • Riesgo ALTO (Daño Completo): Derrumbe parcial de porciones importantes de la pared o derrumbe total de la pared.

G. ESTRUCTURAS DE ACERO:
   • Daño MENOR:    Deformaciones pequeñas, casi imperceptibles. Pandeo en arriostramientos (es desempeño esperado en sismos).
   • Daño MODERADO: Deformaciones perceptibles a simple vista. Pandeo incipiente en secciones de vigas o columnas.
   • Daño SEVERO:   Pandeo local en secciones de vigas, columnas o en las conexiones.
   • Daño COMPLETO: Pandeo local y/o fractura en secciones de vigas o columnas. Fractura de soldaduras o tornillos. Fractura de placa base de columna.

═══════════════════════════════════════════════════════
SISTEMA DE ETIQUETAS DE ACCESO (ANIH 2023)
═══════════════════════════════════════════════════════
   🟢 VERDE  — Acceso PERMITIDO:     Riesgo A. Bajo en todos los aspectos evaluados.
   🟡 AMARILLA — Acceso RESTRINGIDO: Al menos un aspecto con Riesgo B. Medio, ninguno con C. Alto.
   🔴 ROJA   — Acceso NO PERMITIDO:  Al menos un aspecto con Riesgo C. Alto.

CORRESPONDENCIA CON NIVELES DE RIESGO INTERNOS:
   - BAJO   → Etiqueta VERDE    (daños menores/cosméticos, sin riesgo estructural)
   - MEDIO  → Etiqueta AMARILLA (daño moderado en elementos, requiere inspección detallada posterior)
   - ALTO   → Etiqueta ROJA     (daño severo en algún elemento estructural)
   - CRITICO → Etiqueta ROJA    (daño completo, colapso posible/parcial/total, evacuación inmediata)

═══════════════════════════════════════════════════════
INSTRUCCIONES FINALES
═══════════════════════════════════════════════════════

Aplica los criterios técnicos anteriores para analizar las imágenes. Recuerda:
1. El ancho de grieta por sí solo no define el nivel de daño en columnas y vigas: deben coincidir con los indicadores adicionales especificados (desconchado, aplastamiento, pandeo).
2. El daño en paredes de relleno (tabiquería) NO es equivalente a daño estructural, pero sí representa riesgo de caída sobre ocupantes.
3. Sé conservador: en caso de duda entre dos niveles, escoge el más desfavorable.
4. Si solo se observan paredes de relleno sin ver elementos estructurales principales (columnas, vigas, muros portantes), indica esto en la descripción y basa el diagnóstico en lo visible.

Responde ÚNICAMENTE con un objeto JSON con esta estructura exacta:
{
  "nivel_riesgo": "BAJO|MEDIO|ALTO|CRITICO",
  "etiqueta_acceso": "VERDE|AMARILLA|ROJA",
  "tipo_dano": "Cosmético|Estructural Menor|Estructural Mayor|Riesgo de Colapso",
  "probabilidad_riesgo": <número entre 0 y 100 indicando nivel de riesgo estimado>,
  "elementos_afectados": ["lista de elementos dañados con su nivel de daño según metodología ANIH, ej: 'Columnas de concreto - Daño Moderado', 'Paredes de relleno - Daño Severo'"],
  "descripcion_danos": "descripción técnica y detallada de lo observado aplicando criterios ANIH: tipo de elemento, ancho estimado de grietas, presencia de desconchado/aplastamiento/pandeo, y concordancia con la descripción del usuario",
  "es_estructural": <true o false>,
  "requiere_evacuacion_inmediata": <true o false>,
  "recomendaciones": ["lista de recomendaciones técnicas de seguridad según metodología ANIH"],
  "acciones_inmediatas": ["acciones urgentes según protocolo ANIH: acordonar, cerrar calles, apuntalar, desconectar gas/electricidad, etc. Array vacío si no aplica"],
  "que_observar": ["señales de advertencia a monitorear en los próximos días según criterios ANIH (ej: aumento del ancho de grietas, nuevas grietas diagonales, ruidos, humedades, etc.)"]
}

⚠️ IMPORTANTE: Si las imágenes no corresponden a daños estructurales o daños en inmuebles (por ejemplo, son fotos de personas, paisajes, comida, etc.), responde obligatoriamente con esta estructura exacta:
{
  "nivel_riesgo": "N/A",
  "etiqueta_acceso": "N/A",
  "tipo_dano": "No aplica",
  "descripcion_danos": "Las imágenes proporcionadas no corresponden a daños o fallas en un inmueble. Por favor, suba fotos de las grietas, columnas, vigas o paredes afectadas para poder realizar la evaluación.",
  "recomendaciones": ["Suba fotos nítidas del daño estructural"],
  "acciones_inmediatas": [],
  "que_observar": [],
  "probabilidad_riesgo": 0,
  "es_estructural": false,
  "requiere_evacuacion_inmediata": false
}`;

    // 3. Consumir Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'El motor de diagnóstico no está configurado correctamente en el servidor.' });
    }

    // Configurar payload de la API de Gemini (Multimodal)
    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          ...validImages.map(img => ({
            inline_data: {
              mime_type: img.mimeType || 'image/jpeg',
              data: img.base64
            }
          }))
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    // Usar gemini-2.5-flash según la especificación del plan (con fallback a gemini-1.5-flash si es necesario)
    const model = 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiBody)
    });

    if (!geminiResponse.ok) {
      const geminiErrText = await geminiResponse.text();
      console.error('Error al llamar a Gemini API:', geminiErrText);
      throw new Error('Error al procesar el análisis visual preliminar.');
    }

    const geminiData = await geminiResponse.json();
    const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      throw new Error('El motor de análisis retornó una respuesta vacía o incompleta.');
    }

    // 4. Parsear y Sanitizar Respuesta JSON de Gemini
    let diagnosis;
    try {
      diagnosis = JSON.parse(analysisText.trim());
    } catch (e) {
      // Intentar extraer el JSON si el motor retornó texto adicional o markdown codeblocks
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          diagnosis = JSON.parse(jsonMatch[0].trim());
        } catch (innerErr) {
          console.error('Fallo al parsear JSON interno de Gemini:', innerErr);
          throw new Error('El diagnóstico preliminar devuelto no pudo ser procesado.');
        }
      } else {
        throw new Error('El diagnóstico devuelto no tiene un formato válido.');
      }
    }

    // 5. Guardar Reporte en PostgreSQL en Supabase
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket.remoteAddress || null;

    const reportData = {
      id: reportId,
      latitude: buildingInfo.latitude || null,
      longitude: buildingInfo.longitude || null,
      estado: buildingInfo.estado,
      municipio: buildingInfo.municipio,
      parroquia: buildingInfo.parroquia || null,
      direccion: buildingInfo.direccion || null,
      nombre_edificio: buildingInfo.nombre_edificio,
      tipo_inmueble: buildingInfo.tipo_inmueble,
      piso: buildingInfo.piso || null,
      descripcion_usuario: buildingInfo.descripcion_usuario || null,
      image_urls: imageUrls,
      ai_diagnosis: diagnosis,
      status: 'analyzed',
      nivel_riesgo: diagnosis.nivel_riesgo || 'MEDIO',
      user_agent: userAgent,
      ip_address: ipAddress
    };

    const { error: dbError } = await supabase
      .from('reports')
      .insert(reportData);

    if (dbError) {
      console.error('Error al insertar reporte en Supabase DB:', dbError);
      throw new Error('No se pudo guardar el reporte en la base de datos.');
    }

    // 6. Retornar Respuesta Exitosa
    return res.status(200).json({
      success: true,
      reportId: reportId,
      diagnosis: diagnosis,
      imageUrls: imageUrls
    });

  } catch (error) {
    console.error('Error en Handler Analyze:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};
