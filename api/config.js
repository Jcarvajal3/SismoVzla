/**
 * ==========================================================================
 * CONFIG.JS - Vercel Serverless Function to serve public configurations
 * ==========================================================================
 */

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Devolver de forma segura la URL y la Anon Key pública del proyecto
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://xlylodcinromqqjjupph.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
};
