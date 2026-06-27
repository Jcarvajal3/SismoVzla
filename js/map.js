/**
 * ==========================================================================
 * MAP.JS - Módulo de Visualización de Reportes sobre Leaflet.js
 * ==========================================================================
 */

let mapInstance = null;
let markerGroup = null;
let currentReports = [];
let _loadRequestId = 0;

/**
 * Inicializa el mapa Leaflet centrado en Venezuela.
 * Solo se ejecuta una vez para evitar errores de reinicialización del contenedor.
 */
async function initMap() {
  if (mapInstance) {
    // Si ya existe, refrescar tamaño (por si se inicializó estando oculto)
    setTimeout(() => mapInstance.invalidateSize(), 50);
    return;
  }

  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Centro aproximado de Venezuela (Lat: 8.0, Lng: -66.0), Zoom: 6.5
  mapInstance = L.map('map', {
    zoomSnap: 0.5,
    minZoom: 5,
    maxZoom: 18
  }).setView([8.0, -66.0], 6.5);

  // Capa de mosaico oscura/moderna de CartoDB (se ve increíble y encaja con la estética oscura)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(mapInstance);

  // Crear grupo de marcadores para poder borrarlos/añadirlos fácilmente
  markerGroup = L.layerGroup().addTo(mapInstance);

  // Configurar event listeners para los filtros
  setupMapFilters();

  // Cargar reportes iniciales
  await loadReports();
}

/**
 * Configura los event listeners de los chips de riesgo y el dropdown de estados.
 */
function setupMapFilters() {
  const chips = document.querySelectorAll('#filter-riesgo .chip');
  const estadoSelect = document.getElementById('filter-estado');

  // Eventos para chips
  chips.forEach(chip => {
    chip.addEventListener('click', async () => {
      // Activar clase active en este chip
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      await loadReports();
    });
  });

  // Evento para dropdown de estados
  if (estadoSelect) {
    estadoSelect.addEventListener('change', async () => {
      await loadReports();
    });
  }
}

/**
 * Lee los filtros seleccionados en la UI.
 * @returns {Object} Filtros formateados.
 */
function getActiveFilters() {
  const activeChip = document.querySelector('#filter-riesgo .chip.active');
  const estadoSelect = document.getElementById('filter-estado');

  return {
    riesgo: activeChip ? activeChip.getAttribute('data-risk') : 'todos',
    estado: estadoSelect ? estadoSelect.value : ''
  };
}

/**
 * Consulta los datos a Supabase y pinta los marcadores en el mapa.
 */
async function loadReports() {
  if (!mapInstance || !markerGroup) return;

  const requestId = ++_loadRequestId;

  const statsGrid = document.getElementById('map-stats');
  if (statsGrid && currentReports.length === 0) {
    showLoading('map-stats', 4);
  }

  try {
    const filters = getActiveFilters();
    const reports = await fetchReportsForMap(filters);

    // Si otra petición fue lanzada después de ésta, descartar estos resultados
    if (requestId !== _loadRequestId) return;

    currentReports = reports;

    // Limpiar marcadores anteriores
    markerGroup.clearLayers();

    // Pintar nuevos marcadores
    reports.forEach(report => {
      if (report.latitude && report.longitude) {
        const marker = createMarker(report);
        if (marker) marker.addTo(markerGroup);
      }
    });

    // Actualizar bloque de estadísticas
    updateStats(reports);
  } catch (error) {
    console.error('Error cargando reportes para el mapa:', error);
    showToast('No se pudieron cargar los marcadores en el mapa.', 'error');
    
    const statsGrid = document.getElementById('map-stats');
    if (statsGrid) {
      statsGrid.innerHTML = '<p class="error-text text-center full-width">Error al conectar con la base de datos.</p>';
    }
  }
}

/**
 * Crea un marcador interactivo en base al nivel de riesgo.
 * @param {Object} report - Datos del reporte.
 * @returns {L.Marker|null} Marcador de Leaflet.
 */
function createMarker(report) {
  const lat = parseFloat(report.latitude);
  const lng = parseFloat(report.longitude);
  
  if (isNaN(lat) || isNaN(lng)) return null;

  const icon = getMarkerIcon(report.nivel_riesgo);
  const dateStr = formatDate(report.created_at);

  const marker = L.marker([lat, lng], { icon: icon });

  // Popups personalizados para dar una excelente UX
  const popupHtml = `
    <div class="marker-popup">
      <strong>${sanitizeHTML(report.nombre_edificio || 'Edificio Reportado')}</strong>
      <div style="margin: 4px 0 8px 0;">
        <span class="badge badge-${getRiskColor(report.nivel_riesgo)}">${report.nivel_riesgo}</span>
      </div>
      <p style="margin-bottom:4px; font-size:11px; color:var(--text-secondary);">
        📍 ${sanitizeHTML(report.estado)}, ${sanitizeHTML(report.municipio)}<br>
        🏢 Tipo: ${sanitizeHTML(report.tipo_inmueble)}
      </p>
      <small style="color:var(--text-muted); display:block; margin-top:6px;">
        📅 ${dateStr}
      </small>
      <button onclick="routerNavigateToReport('${report.id}')" class="btn btn-secondary btn-small" 
              style="width: 100%; margin-top: 10px; padding: 4px 0;">
        🔎 Ver detalles
      </button>
    </div>
  `;

  marker.bindPopup(popupHtml, {
    maxWidth: 240,
    minWidth: 180
  });

  return marker;
}

/**
 * Genera un icono circular de color basado en CSS (evita descargar imágenes).
 * @param {string} nivel - Nivel de riesgo.
 * @returns {L.DivIcon} Icono de Leaflet.
 */
function getMarkerIcon(nivel) {
  const colors = {
    BAJO: 'var(--risk-bajo)',
    MEDIO: 'var(--risk-medio)',
    ALTO: 'var(--risk-alto)',
    CRITICO: 'var(--risk-critico)'
  };
  const color = colors[nivel?.toUpperCase()] || '#8b949e';

  // Icono CSS circular con sombra premium
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      background-color: ${color};
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.5);
      transition: all 0.2s ease-in-out;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
}

/**
 * Navega hacia el detalle de un reporte.
 * Se inyecta en el objeto window para que pueda ser llamado desde el HTML inyectado del popup.
 * @param {string} reportId - ID del reporte.
 */
window.routerNavigateToReport = function(reportId) {
  // Cambiamos el hash para ir al detalle (el router principal de app.js se encargará de abrir el modal/sección)
  window.location.hash = `#reporte/${reportId}`;
};

/**
 * Calcula estadísticas de los reportes cargados y dibuja tarjetas en la interfaz.
 * @param {Array} reports - Lista de reportes.
 */
function updateStats(reports) {
  const statsGrid = document.getElementById('map-stats');
  if (!statsGrid) return;

  const total = reports.length;
  
  // Contadores por riesgo
  let bajo = 0, medio = 0, alto = 0, critico = 0;
  
  // Diccionario para contar reportes por estado
  const estadosCount = {};

  reports.forEach(r => {
    const riesgo = r.nivel_riesgo?.toUpperCase();
    if (riesgo === 'BAJO') bajo++;
    else if (riesgo === 'MEDIO') medio++;
    else if (riesgo === 'ALTO') alto++;
    else if (riesgo === 'CRITICO') critico++;

    const estado = r.estado || 'Desconocido';
    estadosCount[estado] = (estadosCount[estado] || 0) + 1;
  });

  // Top estados más afectados
  const topEstados = Object.entries(estadosCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // Top 3 estados

  const topEstadosHtml = topEstados.length > 0 
    ? topEstados.map(([est, count]) => `<div>${sanitizeHTML(est)}: <strong>${count}</strong></div>`).join('')
    : '<div style="color:var(--text-muted);">Sin datos</div>';

  statsGrid.innerHTML = `
    <!-- Total -->
    <div class="stat-card">
      <div class="stat-val">${total}</div>
      <div class="stat-label">Total Reportes</div>
    </div>
    
    <!-- Críticos/Altos -->
    <div class="stat-card">
      <div class="stat-val" style="color: var(--risk-critico)">${critico}</div>
      <div class="stat-label">🔴 R. Crítico</div>
    </div>
    
    <!-- Medios/Altos -->
    <div class="stat-card">
      <div class="stat-val" style="color: var(--risk-alto)">${alto + medio}</div>
      <div class="stat-label">🟠/🟡 Medio u Alto</div>
    </div>

    <!-- Estados Top -->
    <div class="stat-card" style="text-align: left; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">Top Afectados</div>
      <div style="font-size: var(--font-size-sm); line-height: 1.3;">
        ${topEstadosHtml}
      </div>
    </div>
  `;
}
