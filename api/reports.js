/**
 * ==========================================================================
 * REPORTS.JS - Vercel Serverless Function to Fetch Reports with Filters
 * ==========================================================================
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = async function handler(req, res) {
  // Fix CORS: usar allowlist en lugar de wildcard
  const allowedOrigins = [
    process.env.ALLOWED_ORIGIN,
    'http://localhost:3000',
    'http://localhost:3001'
  ].filter(Boolean);
  const requestOrigin = req.headers.origin;
  if (allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase no está configurado en el servidor.' });
  }

  try {
    const { estado, nivel_riesgo, status, limit = 500 } = req.query;

    // Validar parámetros de filtro contra allowlists para prevenir queries no esperadas
    const VALID_RIESGO_LEVELS = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];
    const VALID_STATUS = ['analyzed', 'reviewed', 'pending'];

    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 500, 1000)); // Límite máximo de seguridad de 1000 items

    // Filtros dinámicos con validación
    if (estado) {
      query = query.eq('estado', estado);
    }
    if (nivel_riesgo) {
      const upperRiesgo = nivel_riesgo.toUpperCase();
      if (VALID_RIESGO_LEVELS.includes(upperRiesgo)) {
        query = query.eq('nivel_riesgo', upperRiesgo);
      }
    }
    if (status) {
      if (VALID_STATUS.includes(status)) {
        query = query.eq('status', status);
      }
    }

    const { data, error } = await query;

    if (error) {
      // Fix #59: DB errors son 500 (server error), no 400 (client error)
      console.error('Error consultando reportes en DB:', error);
      return res.status(500).json({ error: 'Error al consultar los reportes.' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error en Handler Reports:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
