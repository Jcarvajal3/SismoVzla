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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 500, 1000)); // Límite máximo de seguridad de 1000 items

    // Filtros dinámicos
    if (estado) {
      query = query.eq('estado', estado);
    }
    if (nivel_riesgo) {
      query = query.eq('nivel_riesgo', nivel_riesgo.toUpperCase());
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error consultando reportes en DB:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error en Handler Reports:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
