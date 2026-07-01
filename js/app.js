/**
 * ==========================================================================
 * APP.JS - Orquestador Principal de la Aplicación y Enrutador SPA
 * ==========================================================================
 */

const CHECKLIST_ITEMS = [
  '¿Hay grietas nuevas en paredes que no existían antes del sismo?',
  '¿Las puertas y ventanas abren y cierran con dificultad o ya no encajan en sus marcos?',
  '¿Hay grietas visibles en columnas o vigas (elementos estructurales de concreto armado)?',
  '¿Se observan cabillas (acero de refuerzo) expuestas por desprendimiento del concreto?',
  '¿El edificio presenta alguna inclinación visible, hundimiento o desplazamiento lateral?',
  '¿Hay pedazos de concreto, friso (revestimiento) o mampostería desprendidos en el suelo?',
  '¿Se escuchan ruidos inusuales, crujidos o tronidos provenientes de la estructura?',
  '¿Hay tuberías de agua rotas, filtraciones nuevas o humedad repentina en paredes?',
  '¿Percibe olor a gas (mercaptano) en el interior o cercanías del inmueble?',
  '¿Hay cables eléctricos caídos, expuestos, chispas o daños visibles en el tendido eléctrico?',
  '¿Las escaleras comunes presentan grietas diagonales, desprendimiento o deformación?',
  '¿El techo o losa presenta goteras nuevas, pandeo (deformación), fisuras o hundimiento?',
  '¿Hay separación visible entre paredes y columnas, vigas o losa de techo?'
];

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

/**
 * Orquesta la inicialización de todos los módulos y configuraciones.
 */
function initApp() {
  console.log('🇾🇪 Inicializando Análisis de Estructura...');

  // Fix #26: Cada módulo se inicializa de forma independiente con su propio try/catch.
  // Un error en uno no bloquea la inicialización de los demás.
  try { initLocation(); } catch (e) { console.error('[initApp] Error en initLocation:', e); }
  try { initCamera();   } catch (e) { console.error('[initApp] Error en initCamera:', e); }
  try { initSpecialist(); } catch (e) { console.error('[initApp] Error en initSpecialist:', e); }

  // Configurar orquestadores del módulo principal
  setupRouter();
  setupSOSButton();
  setupChecklist();
  setupFormSubmission();
}

/**
 * Enrutador SPA simple basado en el Hash (hashchange).
 */
function setupRouter() {
  // Fix #49: Cachear queries DOM en lugar de re-ejecutar querySelectorAll en cada cambio de hash
  const allSections = Array.from(document.querySelectorAll('.page-section'));
  const allNavLinks = Array.from(document.querySelectorAll('#main-nav .nav-link'));

  const handleRouting = async () => {
    const hash = window.location.hash || '#evaluar';
    
    // Ocultar todas las secciones (Fix #49: usando cache)
    allSections.forEach(sec => { sec.classList.remove('active'); });

    // Desactivar todos los links de navegación del header
    allNavLinks.forEach(link => { link.classList.remove('active'); link.removeAttribute('aria-current'); });

    // 1. Manejo del Caso de Detalle de Reporte Público (/#reporte/UUID)
    if (hash.startsWith('#reporte/')) {
      const reportId = hash.split('/')[1];
      if (reportId) {
        // Mostrar sección de evaluación (donde se pintan los resultados)
        const evalSection = document.getElementById('section-evaluar');
        if (evalSection) evalSection.classList.add('active');
        
        // Activar el link de nav de evaluación
        const evalLink = document.querySelector('#main-nav [data-section="evaluar"]');
        if (evalLink) evalLink.classList.add('active');

        // Mostrar cargador en el contenedor de resultados
        const resultContainer = document.getElementById('resultado-analisis');
        if (resultContainer) {
          resultContainer.className = 'card result-card';
          showLoading('resultado-analisis', 5);
          resultContainer.scrollIntoView({ behavior: 'smooth' });
        }

        try {
          // Consultar el detalle completo (incluyendo revisiones del especialista)
          const report = await fetchReportDetail(reportId);
          
          // Renderizar los resultados
          displayResults(
            report.ai_diagnosis,
            report.id,
            'resultado-analisis',
            report.specialist_reviews
          );
        } catch (error) {
          console.error('Error al enrutar al reporte:', error);
          showToast('No se pudo encontrar el reporte especificado.', 'error');
          if (resultContainer) resultContainer.hidden = true;
        }
      }
      return;
    }

    // 2. Manejo de Secciones Estándar
    const sectionName = hash.substring(1);
    const validSections = ['evaluar', 'especialistas', 'info', 'mapa'];
    const activeSection = validSections.includes(sectionName) ? sectionName : 'evaluar';

    // Mostrar sección correspondiente
    const targetSection = document.getElementById(`section-${activeSection}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Activar link del nav
    const activeLink = document.querySelector(`#main-nav [data-section="${activeSection}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    // Inicializar mapa diferido cuando el usuario navegue a #mapa
    if (activeSection === 'mapa') {
      await initMap();
    }
  };

  // Escuchar eventos de cambio de hash y de carga inicial
  window.addEventListener('hashchange', handleRouting);
  window.addEventListener('load', handleRouting);
}

/**
 * Configura el escuchador del formulario de evaluación de daños.
 */
function setupFormSubmission() {
  const form = document.getElementById('form-evaluacion');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-analizar');
    const images = getImages();

    // Validar imágenes obligatorias
    if (images.length === 0) {
      showToast('Por favor, tome o seleccione al menos 1 foto del daño.', 'warning');
      
      // Hacer scroll suave al área de carga de fotos
      document.getElementById('step-fotos').scrollIntoView({ behavior: 'smooth' });
      return; // botón nunca se bloqueó → no hay problema
    }

    // Recopilar datos de ubicación e inmueble
    const locationData = getLocationData();
    const tipoInmueble = document.getElementById('select-tipo').value;
    const descripcion = document.getElementById('textarea-descripcion').value;
    const telefono = document.getElementById('input-telefono') ? document.getElementById('input-telefono').value.trim() : '';

    const formData = {
      ...locationData,
      tipo: tipoInmueble,
      piso: null,
      descripcion: descripcion,
      telefono: telefono
    };

    // Validar requeridos del formulario
    const validation = validateForm(formData);
    if (!validation.valid) {
      validation.errors.forEach(err => showToast(err, 'warning'));
      return; // botón nunca se bloqueó → no hay problema
    }

    // Fix #25: Deshabilitar el botón solo DESPUÉS de que todas las validaciones pasaron
    // De esta forma, el bloque finally siempre lo re-habilita correctamente.
    if (submitBtn) submitBtn.disabled = true;

    // === NUEVO FLUJO: Ocultar form/hero → Mostrar pantalla de carga ===
    const hero = document.getElementById('hero-evaluar');
    const loadingOverlay = document.getElementById('loading-overlay');
    const resultContainer = document.getElementById('resultado-analisis');

    // Ocultar formulario y hero
    form.hidden = true;
    if (hero) hero.hidden = true;

    // Ocultar resultado anterior
    if (resultContainer) resultContainer.hidden = true;

    // Mostrar pantalla de carga
    if (loadingOverlay) loadingOverlay.removeAttribute('hidden');

    // Scroll al tope de la sección
    document.getElementById('section-evaluar').scrollIntoView({ behavior: 'smooth' });

    try {
      const res = await submitAnalysis(images, formData);

      if (res && res.success) {
        // Ocultar pantalla de carga
        if (loadingOverlay) loadingOverlay.hidden = true;

        // Renderizar los resultados
        displayResults(res.diagnosis, res.reportId, 'resultado-analisis');

        // Limpiar el estado de fotos y inputs del formulario
        // Fix #71: Patrón defensivo consistente para clearImages()
        if (typeof clearImages === 'function') clearImages();
        form.reset();

        // Limpiar las coordenadas ocultas y estado GPS
        document.getElementById('input-lat').value = '';
        document.getElementById('input-lng').value = '';
        const geoStatus = document.getElementById('geo-status');
        if (geoStatus) geoStatus.hidden = true;

        showToast('Diagnóstico generado con éxito.', 'success');
      } else {
        // La API respondió pero sin éxito (ej: { success: false, error: '...' })
        // Restaurar UI para que el usuario pueda reintentar
        const errorMsg = (res && res.error) || 'No se pudo completar el análisis. Intente de nuevo.';
        if (loadingOverlay) loadingOverlay.hidden = true;
        form.hidden = false;
        if (hero) hero.removeAttribute('hidden');
        showToast(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error al procesar la evaluación:', error);
      showToast(error.message || 'Ocurrió un error al procesar el análisis.', 'error');

      // En caso de error, volver al formulario
      if (loadingOverlay) loadingOverlay.hidden = true;
      form.hidden = false;
      if (hero) hero.removeAttribute('hidden');
    } finally {
      // Siempre re-habilitar el botón al terminar (Fix #25)
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/**
 * Reinicia la vista al formulario para permitir un nuevo análisis.
 * Oculta los resultados, restaura el formulario y limpia el estado de fotos y GPS.
 */
function handleNewAnalysis() {
  const form = document.getElementById('form-evaluacion');
  const hero = document.getElementById('hero-evaluar');
  const resultContainer = document.getElementById('resultado-analisis');
  const loadingOverlay = document.getElementById('loading-overlay');

  // Ocultar resultados y carga
  if (resultContainer) resultContainer.hidden = true;
  if (loadingOverlay) loadingOverlay.hidden = true;

  // Mostrar formulario y hero
  if (form) {
    form.hidden = false;
    form.reset();
  }
  if (hero) hero.removeAttribute('hidden');

  // Limpiar fotos previamente cargadas
  if (typeof clearImages === 'function') clearImages();

  // Limpiar coordenadas GPS
  const inputLat = document.getElementById('input-lat');
  const inputLng = document.getElementById('input-lng');
  if (inputLat) inputLat.value = '';
  if (inputLng) inputLng.value = '';

  const geoStatus = document.getElementById('geo-status');
  if (geoStatus) geoStatus.hidden = true;

  // Scroll al tope
  document.getElementById('section-evaluar').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Configura los eventos del botón SOS flotante y su modal.
 */
function setupSOSButton() {
  const sosBtn = document.getElementById('btn-sos');
  const sosModal = document.getElementById('modal-sos');
  const closeSosBtn = document.getElementById('btn-close-sos');

  if (!sosBtn || !sosModal) return;

  // Abrir modal SOS
  sosBtn.addEventListener('click', () => {
    sosModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden'; // Bloquear scroll
  });

  // Cerrar modal SOS
  const closeSOS = () => {
    sosModal.setAttribute('hidden', 'true');
    document.body.style.overflow = 'auto'; // Restaurar scroll
  };

  if (closeSosBtn) {
    closeSosBtn.addEventListener('click', closeSOS);
  }

  // Cerrar si hace click fuera del contenido del modal
  sosModal.addEventListener('click', (e) => {
    if (e.target === sosModal) {
      closeSOS();
    }
  });
}

/**
 * Genera dinámicamente el checklist de inspección visual rápida ATC-20.
 * Crea los items de checkbox en el contenedor #checklist-items y
 * registra listeners para el estado visual de cada item.
 */
function setupChecklist() {
  const container = document.getElementById('checklist-items');
  if (!container) return;

  container.innerHTML = '';

  CHECKLIST_ITEMS.forEach((itemText, index) => {
    const itemEl = document.createElement('label');
    itemEl.className = 'checklist-item';
    itemEl.setAttribute('for', `chk-item-${index}`);

    itemEl.innerHTML = `
      <input type="checkbox" id="chk-item-${index}">
      <span class="checklist-text">${sanitizeHTML(itemText)}</span>
    `;

    // Event listener para togglar la clase visual al cambiar de estado
    const checkbox = itemEl.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        itemEl.classList.add('checked');
      } else {
        itemEl.classList.remove('checked');
      }
    });

    container.appendChild(itemEl);
  });
}
