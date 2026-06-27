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
  console.log('🇻🇪 Inicializando EstructuraScan...');

  // Inicializar módulos secundarios
  initLocation();
  initCamera();
  initSpecialist();

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
  const handleRouting = async () => {
    const hash = window.location.hash || '#evaluar';
    
    // Ocultar todas las secciones
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.remove('active');
    });

    // Desactivar todos los links de navegación del header
    document.querySelectorAll('#main-nav .nav-link').forEach(link => {
      link.classList.remove('active');
    });

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
    const validSections = ['evaluar', 'info'];
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
      return;
    }

    // Recopilar datos de ubicación e inmueble
    const locationData = getLocationData();
    const tipoInmueble = document.getElementById('select-tipo').value;
    const descripcion = document.getElementById('textarea-descripcion').value;

    const formData = {
      ...locationData,
      tipo: tipoInmueble,
      piso: null,
      descripcion: descripcion
    };

    // Validar requeridos del formulario
    const validation = validateForm(formData);
    if (!validation.valid) {
      validation.errors.forEach(err => showToast(err, 'warning'));
      return;
    }

    // Deshabilitar botón y mostrar spinner de carga
    showSpinner(submitBtn);

    // Ocultar diagnóstico anterior si lo hubiera
    const resultContainer = document.getElementById('resultado-analisis');
    if (resultContainer) resultContainer.hidden = true;

    try {
      showToast('Subiendo imágenes y analizando daños...', 'info');
      
      const res = await submitAnalysis(images, formData);

      if (res && res.success) {
        showToast('Diagnóstico generado con éxito.', 'success');
        
        // Renderizar los resultados
        displayResults(res.diagnosis, res.reportId, 'resultado-analisis');
        
        // Limpiar el estado de fotos y inputs del formulario
        clearImages();
        form.reset();
        
        // Limpiar las coordenadas ocultas y estado GPS
        document.getElementById('input-lat').value = '';
        document.getElementById('input-lng').value = '';
        const geoStatus = document.getElementById('geo-status');
        if (geoStatus) geoStatus.hidden = true;
      }
    } catch (error) {
      console.error('Error al procesar la evaluación:', error);
      showToast(error.message || 'Ocurrió un error al procesar el análisis.', 'error');
    } finally {
      hideSpinner(submitBtn, '🔍 Analizar Daños');
    }
  });
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
 * Genera dinámicamente y configura el checklist de seguridad interactivo ATC-20.
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
