/**
 * ==========================================================================
 * SUPABASE-CLIENT.JS - Cliente Supabase para Operaciones del Lado del Cliente
 * ==========================================================================
 */

// Las credenciales públicas de Supabase se obtendrán dinámicamente desde el servidor
// para evitar hardcodear llaves y permitir despliegues sin compilación ("zero-config").
let supabaseClient = null;
let _initPromise = null;

/**
 * Obtiene o inicializa la instancia única del cliente Supabase.
 * @returns {Promise<Object>} Cliente Supabase.
 */
async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (_initPromise) return _initPromise;

  _initPromise = _initSupabaseClient();
  return _initPromise;
}

async function _initSupabaseClient() {
  try {
    // Cargar configuración desde el endpoint API
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Error al obtener la configuración pública.');
    
    const config = await res.json();
    
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.warn('Supabase URL o Anon Key ausentes en /api/config. Intentando cargar variables globales.');
      const url = config.supabaseUrl || 'https://xlylodcinromqqjjupph.supabase.co';
      const key = config.supabaseAnonKey || window.SUPABASE_ANON_KEY;
      
      if (!key) {
        throw new Error('Supabase Anon Key no definida. Asegúrese de configurar las variables de entorno.');
      }
      
      supabaseClient = window.supabase.createClient(url, key);
    } else {
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    
    return supabaseClient;
  } catch (error) {
    console.error('Error inicializando Supabase Client:', error);
    _initPromise = null;
    showToast('Error de conexión con la base de datos.', 'error');
    throw error;
  }
}

/**
 * Consulta la tabla 'reports' para obtener los pines a renderizar en el mapa.
 * @param {Object} filters - Filtros a aplicar: { riesgo: string, estado: string }
 * @returns {Promise<Array>} Lista de reportes filtrados.
 */
async function fetchReportsForMap(filters = {}) {
  const client = await getSupabaseClient();
  
  let query = client
    .from('reports')
    .select('id, latitude, longitude, nivel_riesgo, nombre_edificio, estado, municipio, tipo_inmueble, created_at, status')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  // Filtrar por riesgo si no es 'todos'
  if (filters.riesgo && filters.riesgo !== 'todos') {
    query = query.eq('nivel_riesgo', filters.riesgo);
  }
  
  // Filtrar por estado si está definido
  if (filters.estado && filters.estado.trim() !== '') {
    query = query.eq('estado', filters.estado);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error al consultar reportes para mapa:', error);
    throw error;
  }
  
  return data;
}

/**
 * Consulta los detalles completos de un reporte y sus correspondientes revisiones de especialistas.
 * @param {string} reportId - ID del reporte.
 * @returns {Promise<Object>} Datos del reporte detallado.
 */
async function fetchReportDetail(reportId) {
  if (!reportId) throw new Error('Se requiere el ID del reporte.');
  
  const client = await getSupabaseClient();
  
  const { data, error } = await client
    .from('reports')
    .select('*, specialist_reviews(*)')
    .eq('id', reportId)
    .single();

  if (error) {
    console.error(`Error al consultar detalle del reporte ${reportId}:`, error);
    throw error;
  }
  
  return data;
}
