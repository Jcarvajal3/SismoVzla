/**
 * ==========================================================================
 * SPECIALIST.JS - Endpoint Vercel para Autenticación, Listados y Revisiones
 * ==========================================================================
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Valida que el token Bearer corresponda a un especialista activo.
 * @param {string} authHeader - Cabecera de autorización.
 * @returns {Promise<Object|null>} Datos del especialista o null.
 */
async function validateSpecialist(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const accessCode = authHeader.substring(7); // Extraer token

  const { data, error } = await supabase
    .from('specialists')
    .select('*')
    .eq('access_code', accessCode)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data;
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase no está configurado en el servidor.' });
  }

  const { action } = req.query;

  try {
    // -------------------------------------------------------------
    // ACCIÓN: LOGIN (POST)
    // -------------------------------------------------------------
    if (action === 'login' && req.method === 'POST') {
      const { access_code } = req.body;
      if (!access_code) {
        return res.status(400).json({ error: 'Código de acceso requerido.' });
      }

      // Buscar especialista activo
      const { data: specialist, error } = await supabase
        .from('specialists')
        .select('id, nombre, especialidad, is_active')
        .eq('access_code', access_code)
        .eq('is_active', true)
        .single();

      if (error || !specialist) {
        return res.status(401).json({ error: 'Código de acceso inválido o inactivo.' });
      }

      // Actualizar timestamp de último login
      await supabase
        .from('specialists')
        .update({ last_login: new Date().toISOString() })
        .eq('id', specialist.id);

      return res.status(200).json({
        success: true,
        specialist: {
          id: specialist.id,
          nombre: specialist.nombre,
          especialidad: specialist.especialidad
        }
      });
    }

    // -------------------------------------------------------------
    // PARA LAS DEMÁS ACCIONES SE REQUIERE AUTORIZACIÓN (TOKEN BEARER)
    // -------------------------------------------------------------
    const specialist = await validateSpecialist(req.headers.authorization);
    if (!specialist) {
      return res.status(401).json({ error: 'No autorizado. Token inválido.' });
    }

    // -------------------------------------------------------------
    // ACCIÓN: REPORTS (GET)
    // -------------------------------------------------------------
    if (action === 'reports' && req.method === 'GET') {
      const { tab, specialist_id } = req.query;

      if (!specialist_id) {
        return res.status(400).json({ error: 'ID del especialista requerido.' });
      }

      let reports = [];

      // 1. Obtener listados de reportes según pestaña
      if (tab === 'pendientes') {
        // Reportes con diagnóstico preliminar pero que no tengan revisiones profesionales aún
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('status', 'analyzed')
          .order('created_at', { ascending: false });

        if (error) throw error;
        reports = data;

      } else if (tab === 'prioritarios') {
        // Reportes pendientes con nivel de riesgo ALTO o CRÍTICO
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('status', 'analyzed')
          .in('nivel_riesgo', ['ALTO', 'CRITICO'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        reports = data;

      } else if (tab === 'mis-revisiones') {
        // Consultar revisiones de este especialista unidas al reporte
        const { data, error } = await supabase
          .from('specialist_reviews')
          .select('*, reports(*)')
          .eq('specialist_id', specialist_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Formatear la lista para devolver objetos estructurados como reportes
        reports = data
          .filter(rev => rev.reports !== null)
          .map(rev => ({
            ...rev.reports,
            status: 'reviewed',
            nivel_riesgo: rev.nivel_riesgo_corregido, // Mostrar el riesgo corregido por el profesional
            created_at: rev.created_at // Usar la fecha de la revisión
          }));
      }

      // 2. Obtener conteos para actualización de badges (en paralelo)
      const [countPending, countPriority, countMyReviews] = await Promise.all([
        supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'analyzed'),
        supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'analyzed')
          .in('nivel_riesgo', ['ALTO', 'CRITICO']),
        supabase
          .from('specialist_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('specialist_id', specialist_id)
      ]);

      return res.status(200).json({
        reports: reports,
        counts: {
          pendientes: countPending.count || 0,
          prioritarios: countPriority.count || 0,
          mis_revisiones: countMyReviews.count || 0
        }
      });
    }

    // -------------------------------------------------------------
    // ACCIÓN: REVIEW (POST)
    // -------------------------------------------------------------
    if (action === 'review' && req.method === 'POST') {
      const reviewData = req.body;

      if (!reviewData.report_id || !reviewData.specialist_id || !reviewData.nivel_riesgo_corregido || !reviewData.diagnostico) {
        return res.status(400).json({ error: 'Faltan campos requeridos en la revisión.' });
      }

      // 1. Guardar la revisión profesional en specialist_reviews
      const { data: insertedReview, error: reviewError } = await supabase
        .from('specialist_reviews')
        .insert({
          report_id: reviewData.report_id,
          specialist_id: reviewData.specialist_id,
          nivel_riesgo_corregido: reviewData.nivel_riesgo_corregido,
          tipo_dano: reviewData.tipo_dano || [],
          elementos_afectados: reviewData.elementos_afectados || [],
          diagnostico: reviewData.diagnostico,
          recomendaciones: reviewData.recomendaciones || '',
          requiere_evacuacion: !!reviewData.requiere_evacuacion,
          requiere_inspeccion_urgente: !!reviewData.requiere_inspeccion_urgente,
          nombre_especialista: specialist.nombre,
          colegio_profesional: specialist.colegio_profesional || 'CIV',
          numero_colegiado: specialist.numero_colegiado || ''
        })
        .select()
        .single();

      if (reviewError) {
        console.error('Error insertando revisión:', reviewError);
        throw new Error('Fallo al insertar la revisión técnica.');
      }

      // 2. Actualizar estado y nivel de riesgo del reporte
      const { error: reportError } = await supabase
        .from('reports')
        .update({
          status: 'reviewed',
          nivel_riesgo: reviewData.nivel_riesgo_corregido
        })
        .eq('id', reviewData.report_id);

      if (reportError) {
        console.error('Error actualizando reporte:', reportError);
        throw new Error('Fallo al actualizar el estado del reporte.');
      }

      // 3. Incrementar el contador de revisiones del especialista
      const currentReviewsCount = specialist.reviews_count || 0;
      await supabase
        .from('specialists')
        .update({ reviews_count: currentReviewsCount + 1 })
        .eq('id', specialist.id);

      return res.status(200).json({
        success: true,
        review: insertedReview
      });
    }

    // Si no coincide con ninguna acción soportada
    return res.status(400).json({ error: 'Acción no soportada.' });

  } catch (error) {
    console.error('Error en Handler Specialist:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};
