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
    const prompt = `Eres un ingeniero estructural con 20 años de experiencia evaluando daños post-sísmicos en edificaciones en Venezuela y Latinoamérica. 

Analiza las siguientes imágenes de un inmueble afectado por el terremoto en Venezuela (junio 2026).

INFORMACIÓN DEL INMUEBLE:
- Tipo: ${buildingInfo.tipo_inmueble || 'casa'}
- Ubicación: ${buildingInfo.estado || 'No especificado'}, ${buildingInfo.municipio || 'No especificado'}
- Edificio: ${buildingInfo.nombre_edificio || 'No especificado'}
- Piso donde está el daño: ${buildingInfo.piso || 'No especificado'}
- Descripción del usuario: ${buildingInfo.descripcion_usuario || 'Sin descripción'}

INSTRUCCIONES DE ANÁLISIS:
1. Identifica TODOS los daños visibles en las imágenes.
2. Clasifica si son daños cosméticos (friso, pintura, grietas finas en tabiquería) o estructurales (daños en columnas, vigas, losas de entrepiso, fundaciones).
3. Evalúa el riesgo para los habitantes en base a la estabilidad estructural.
4. Proporciona recomendaciones accionables y claras.

CRITERIOS DE CLASIFICACIÓN (basados en escala ATC-20):
- BAJO: Grietas finas (<1mm) solo en friso/pintura de paredes no estructurales, desprendimiento superficial de acabados.
- MEDIO: Grietas de 1-5mm, grietas diagonales en paredes de mampostería, desprendimiento de friso que revela el bloque, grietas en uniones de pared y techo sin afectar la viga.
- ALTO: Grietas >5mm, daños visibles en columnas o vigas (grietas transversales o longitudinales importantes, desprendimiento de concreto/recubrimiento), exposición parcial de acero de refuerzo (cabillas).
- CRITICO: Columnas con fracturas severas o aplastamiento, vigas deformadas o fracturadas con pérdida de apoyo, acero de refuerzo expuesto y doblado (pandeo de cabillas), inclinación visible del edificio, pisos colapsados, falla evidente de fundaciones.

Responde ÚNICAMENTE con un objeto JSON con esta estructura exacta:
{
  "nivel_riesgo": "BAJO|MEDIO|ALTO|CRITICO",
  "tipo_dano": "Cosmético|Estructural Menor|Estructural Mayor|Riesgo de Colapso",
  "probabilidad_riesgo": <número entre 0 y 100 indicando nivel de riesgo estimado>,
  "elementos_afectados": ["lista de elementos dañados (ej: columnas, vigas, paredes de bloque, losa)"],
  "descripcion_danos": "descripción técnica y detallada de lo observado en las imágenes y la concordancia con la descripción del usuario",
  "es_estructural": <true o false>,
  "requiere_evacuacion_inmediata": <true o false>,
  "recomendaciones": ["lista de recomendaciones técnicas de seguridad"],
  "acciones_inmediatas": ["acciones urgentes a tomar si las hay, array vacío si no"],
  "que_observar": ["señales de advertencia a monitorear en los próximos días (ej: aumento del tamaño de grietas, ruidos)"]
}

⚠️ IMPORTANTE: Si las imágenes no corresponden a daños estructurales o daños en inmuebles (por ejemplo, son fotos de personas, paisajes, comida, etc.), responde obligatoriamente con esta estructura exacta:
{
  "nivel_riesgo": "N/A",
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
