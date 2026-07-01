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

  // Fix #80: URL de Supabase ya no tiene fallback hardcodeado.
  // Si la variable de entorno no está definida, el servidor lo reporta explícitamente
  // en lugar de silenciosamente usar una URL que podría ser incorrecta en producción.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('CONFIG: SUPABASE_URL o SUPABASE_ANON_KEY no están definidas.');
    return res.status(503).json({ error: 'Servidor no configurado correctamente. Contacte al administrador.' });
  }

  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
};
