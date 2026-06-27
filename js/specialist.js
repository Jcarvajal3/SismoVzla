/**
 * ==========================================================================
 * SPECIALIST.JS - Panel de Control, Login y Revisiones de Especialistas
 * ==========================================================================
 */

const specialistState = {
  session: null,     // { id, nombre, access_code, logged_in_at }
  currentTab: 'pendientes',
  reports: []
};

/**
 * Inicializa el módulo del panel de especialistas.
 */
function initSpecialist() {
  const loginBtn = document.getElementById('btn-specialist-login');
  const logoutBtn = document.getElementById('btn-specialist-logout');
  const tabContainer = document.getElementById('specialist-tabs');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const reviewForm = document.getElementById('form-revision');

  // Event Listeners
  if (loginBtn) loginBtn.addEventListener('click', handleSpecialistLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', handleSpecialistLogout);
  
  if (tabContainer) {
    tabContainer.querySelectorAll('.tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        // Encontrar botón real en caso de clickear en el badge interno
        const targetBtn = e.target.closest('.tab');
        if (!targetBtn) return;
        
        tabContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        targetBtn.classList.add('active');
        
        specialistState.currentTab = targetBtn.getAttribute('data-tab');
        loadSpecialistReports();
      });
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeReviewModal);
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', handleReviewSubmit);
  }

  // Verificar si hay una sesión activa guardada
  checkActiveSession();
}

/**
 * Verifica si hay una sesión guardada en localStorage y auto-autentica.
 */
function checkActiveSession() {
  const savedSession = localStorage.getItem('specialist_session');
  if (savedSession) {
    try {
      specialistState.session = JSON.parse(savedSession);
      showDashboard();
    } catch (e) {
      localStorage.removeItem('specialist_session');
    }
  }
}

/**
 * Event handler para el login de especialista.
 */
async function handleSpecialistLogin() {
  const codeInput = document.getElementById('input-access-code');
  const errorEl = document.getElementById('login-error');
  const loginBtn = document.getElementById('btn-specialist-login');

  const accessCode = codeInput?.value?.trim();
  if (!accessCode) {
    showToast('Ingrese su código de acceso.', 'warning');
    return;
  }

  showSpinner(loginBtn);
  if (errorEl) errorEl.hidden = true;

  try {
    const res = await fetch('/api/specialist?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_code: accessCode })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Código de acceso incorrecto.');
    }

    // Guardar sesión en estado y localStorage
    specialistState.session = {
      id: data.specialist.id,
      nombre: data.specialist.nombre,
      access_code: accessCode,
      logged_in_at: new Date().toISOString()
    };
    
    localStorage.setItem('specialist_session', JSON.stringify(specialistState.session));
    
    showToast(`Bienvenido Ing. ${data.specialist.nombre}`, 'success');
    if (codeInput) codeInput.value = '';
    showDashboard();

  } catch (error) {
    console.error('Error de login especialista:', error);
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    }
    showToast(error.message, 'error');
  } finally {
    hideSpinner(loginBtn, 'Iniciar Sesión');
  }
}

/**
 * Cierra la sesión activa y restaura la UI de login.
 */
function handleSpecialistLogout() {
  specialistState.session = null;
  localStorage.removeItem('specialist_session');
  
  document.getElementById('specialist-dashboard').hidden = true;
  document.getElementById('specialist-login').hidden = false;
  
  showToast('Sesión cerrada correctamente.', 'info');
}

/**
 * Alterna las vistas de login a dashboard y carga los datos.
 */
function showDashboard() {
  document.getElementById('specialist-login').hidden = true;
  document.getElementById('specialist-name').textContent = specialistState.session.nombre;
  document.getElementById('specialist-dashboard').hidden = false;
  
  // Resetear a pestaña inicial
  specialistState.currentTab = 'pendientes';
  const tabContainer = document.getElementById('specialist-tabs');
  if (tabContainer) {
    tabContainer.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      if (t.getAttribute('data-tab') === 'pendientes') t.classList.add('active');
    });
  }

  loadSpecialistReports();
}

/**
 * Carga los reportes de la pestaña actual desde la API y actualiza los badges.
 */
async function loadSpecialistReports() {
  if (!specialistState.session) return;

  const listContainer = document.getElementById('specialist-reports-list');
  showLoading('specialist-reports-list', 3);

  try {
    const url = `/api/specialist?action=reports&tab=${specialistState.currentTab}&specialist_id=${specialistState.session.id}`;
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${specialistState.session.access_code}`
      }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener reportes del servidor.');
    }

    const data = await res.json();
    specialistState.reports = data.reports || [];
    
    // Renderizar la lista
    renderReportsList(specialistState.reports);

    // Actualizar conteos de badges de las pestañas
    updateTabBadges(data.counts || {});

  } catch (error) {
    console.error('Error cargando reportes especialistas:', error);
    showToast(error.message, 'error');
    if (listContainer) {
      listContainer.innerHTML = `<p class="error-text text-center">${sanitizeHTML(error.message)}</p>`;
    }
  }
}

/**
 * Renderiza el listado de reportes en la UI.
 * @param {Array} reports - Lista de reportes.
 */
function renderReportsList(reports) {
  const container = document.getElementById('specialist-reports-list');
  if (!container) return;

  container.innerHTML = '';

  if (reports.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary);">
        📭 No hay reportes en esta sección.
      </div>
    `;
    return;
  }

  reports.forEach(report => {
    container.appendChild(renderReportCard(report));
  });
}

/**
 * Genera el elemento de tarjeta HTML para un reporte de la lista.
 * @param {Object} report - Datos del reporte.
 * @returns {HTMLElement} Tarjeta del reporte.
 */
function renderReportCard(report) {
  const card = document.createElement('div');
  card.className = 'report-item';
  
  const riskClass = getRiskColor(report.nivel_riesgo);
  const dateStr = formatDate(report.created_at);
  const imgUrl = (report.image_urls && report.image_urls.length > 0) 
    ? report.image_urls[0] 
    : 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=150&h=100'; // Fallback a placeholder si no hay foto

  card.innerHTML = `
    <div class="report-img">
      <img src="${imgUrl}" alt="Daño Inmueble" loading="lazy">
    </div>
    <div class="report-details">
      <div class="report-details-top">
        <h3>${sanitizeHTML(report.nombre_edificio || 'Edificio')}</h3>
        <p class="report-meta">
          📍 ${sanitizeHTML(report.estado)}, ${sanitizeHTML(report.municipio)} ${report.piso ? `(Piso ${report.piso})` : ''}
        </p>
        <p class="report-meta" style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">
          📅 Subido: ${dateStr}
        </p>
      </div>
      <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span class="badge badge-${riskClass}">${report.nivel_riesgo}</span>
        <button class="btn btn-secondary btn-small btn-action-review">
          ${report.status === 'reviewed' ? '🔍 Ver revisión' : '👷 Revisar'}
        </button>
      </div>
    </div>
  `;

  // Listener para el botón de revisión
  card.querySelector('.btn-action-review').addEventListener('click', () => {
    openReviewModal(report.id);
  });

  return card;
}

/**
 * Actualiza los contadores (badges) de las pestañas del dashboard.
 * @param {Object} counts - Conteos devueltos por la API.
 */
function updateTabBadges(counts) {
  const pendingBadge = document.getElementById('badge-pendientes');
  const priorityBadge = document.getElementById('badge-prioritarios');
  const reviewBadge = document.getElementById('badge-revisiones');

  if (pendingBadge) pendingBadge.textContent = counts.pendientes || 0;
  if (priorityBadge) priorityBadge.textContent = counts.prioritarios || 0;
  if (reviewBadge) reviewBadge.textContent = counts.mis_revisiones || 0;
}

/**
 * Abre el modal de revisión y carga los datos del reporte.
 * @param {string} reportId - ID del reporte.
 */
async function openReviewModal(reportId) {
  const modal = document.getElementById('modal-revision');
  if (!modal) return;

  // Abrir el modal y mostrar loader temporal
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden'; // Evitar scroll de fondo

  const imagesContainer = document.getElementById('revision-images');
  const aiDiagContainer = document.getElementById('revision-ai-diagnosis');
  const reviewForm = document.getElementById('form-revision');

  if (imagesContainer) imagesContainer.innerHTML = 'Cargando imágenes...';
  if (aiDiagContainer) aiDiagContainer.innerHTML = 'Cargando diagnóstico preliminar...';
  if (reviewForm) reviewForm.reset();

  try {
    // Consultar el detalle del reporte de forma asíncrona
    const report = await fetchReportDetail(reportId);
    
    // Inyectar el ID oculto del reporte en el formulario
    document.getElementById('rev-report-id').value = report.id;

    // 1. Dibujar imágenes del reporte
    if (imagesContainer) {
      imagesContainer.innerHTML = '';
      if (report.image_urls && report.image_urls.length > 0) {
        report.image_urls.forEach(url => {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Daño del edificio';
          img.addEventListener('click', () => window.open(url, '_blank')); // Abrir imagen en grande
          imagesContainer.appendChild(img);
        });
      } else {
        imagesContainer.innerHTML = '<span style="color:var(--text-muted)">Sin fotos adjuntas</span>';
      }
    }

    // 2. Dibujar diagnóstico preliminar
    if (aiDiagContainer) {
      const diag = report.ai_diagnosis || {};
      const riskClass = getRiskColor(diag.nivel_riesgo);
      aiDiagContainer.innerHTML = `
        <h4>🔮 Diagnóstico Preliminar Automatizado:</h4>
        <div style="margin: var(--space-sm) 0;">
          <span class="badge badge-${riskClass}">${diag.nivel_riesgo || 'N/A'}</span>
          <span style="margin-left: 10px;"><strong>Severidad:</strong> ${diag.probabilidad_riesgo || 0}%</span>
        </div>
        <p><strong>Tipo de daño:</strong> ${sanitizeHTML(diag.tipo_dano || 'No especificado')}</p>
        <p style="margin-top:4px;"><strong>Elementos afectados:</strong> ${(diag.elementos_afectados || []).join(', ') || 'ninguno'}</p>
        <p style="margin-top:6px; font-style:italic; color:var(--text-secondary);">"${sanitizeHTML(diag.descripcion_danos || 'Sin descripción.')}"</p>
      `;
    }

    // 3. Pre-cargar campos del formulario con el diagnóstico preliminar si es un reporte pendiente
    if (report.status !== 'reviewed') {
      const diag = report.ai_diagnosis || {};
      if (diag.nivel_riesgo) {
        document.getElementById('rev-nivel-riesgo').value = diag.nivel_riesgo.toUpperCase();
      }
      
      // Auto-marcar checkbox de evacuación sugerida
      document.getElementById('rev-evacuacion').checked = !!diag.requiere_evacuacion_inmediata;
      
      // Intentar marcar los elementos afectados sugeridos
      const affectedElements = (diag.elementos_afectados || []).map(el => el.toLowerCase());
      const elementsCheckboxes = document.querySelectorAll('#rev-elementos input[type="checkbox"]');
      elementsCheckboxes.forEach(cb => {
        cb.checked = affectedElements.some(el => el.includes(cb.value) || cb.value.includes(el));
      });
    } else {
      // Si el reporte ya fue revisado por especialista, cargar los datos de la revisión profesional
      const review = (report.specialist_reviews && report.specialist_reviews.length > 0) 
        ? report.specialist_reviews[0] 
        : null;

      if (review) {
        document.getElementById('rev-nivel-riesgo').value = review.nivel_riesgo_corregido.toUpperCase();
        document.getElementById('rev-diagnostico').value = review.diagnostico;
        document.getElementById('rev-recomendaciones').value = review.recomendaciones || '';
        document.getElementById('rev-evacuacion').checked = !!review.requiere_evacuacion;
        document.getElementById('rev-inspeccion-urgente').checked = !!review.requiere_inspeccion_urgente;

        // Cargar los checkboxes de tipo daño
        const damageTypes = review.tipo_dano || [];
        const typeCheckboxes = document.querySelectorAll('#rev-tipo-dano input[type="checkbox"]');
        typeCheckboxes.forEach(cb => {
          cb.checked = damageTypes.includes(cb.value);
        });

        // Cargar los checkboxes de elementos
        const affectedElements = review.elementos_afectados || [];
        const elementsCheckboxes = document.querySelectorAll('#rev-elementos input[type="checkbox"]');
        elementsCheckboxes.forEach(cb => {
          cb.checked = affectedElements.includes(cb.value);
        });

        // Deshabilitar formulario si ya está revisado para evitar re-envíos (solo lectura)
        // A menos que este especialista quiera editarlo (lo dejamos editable por simplicidad pero notificando)
      }
    }

  } catch (error) {
    console.error('Error cargando detalle de reporte en modal:', error);
    showToast('No se pudieron obtener los detalles del reporte.', 'error');
    closeReviewModal();
  }
}

/**
 * Cierra el modal de revisión y restaura el scroll.
 */
function closeReviewModal() {
  const modal = document.getElementById('modal-revision');
  if (modal) modal.setAttribute('hidden', 'true');
  document.body.style.overflow = 'auto'; // Restaurar scroll
}

/**
 * Event handler para el submit del formulario de revisión profesional.
 * @param {Event} event - Evento del formulario.
 */
async function handleReviewSubmit(event) {
  event.preventDefault();

  if (!specialistState.session) {
    showToast('Sesión no válida. Vuelva a iniciar sesión.', 'error');
    return;
  }

  const reportId = document.getElementById('rev-report-id').value;
  const submitBtn = event.target.querySelector('button[type="submit"]');

  // Recopilar checkboxes seleccionados
  const tipoDano = [];
  document.querySelectorAll('#rev-tipo-dano input[type="checkbox"]:checked').forEach(cb => {
    tipoDano.push(cb.value);
  });

  const elementosAfectados = [];
  document.querySelectorAll('#rev-elementos input[type="checkbox"]:checked').forEach(cb => {
    elementosAfectados.push(cb.value);
  });

  // Validaciones
  const diagnostico = document.getElementById('rev-diagnostico').value.trim();
  if (diagnostico === '') {
    showToast('El diagnóstico profesional es requerido.', 'warning');
    return;
  }

  const reviewData = {
    report_id: reportId,
    specialist_id: specialistState.session.id,
    nivel_riesgo_corregido: document.getElementById('rev-nivel-riesgo').value,
    tipo_dano: tipoDano,
    elementos_afectados: elementosAfectados,
    diagnostico: diagnostico,
    recomendaciones: document.getElementById('rev-recomendaciones').value.trim(),
    requiere_evacuacion: document.getElementById('rev-evacuacion').checked,
    requiere_inspeccion_urgente: document.getElementById('rev-inspeccion-urgente').checked,
    
    // Adjuntar datos del profesional actual para firma histórica
    nombre_especialista: specialistState.session.nombre
  };

  showSpinner(submitBtn);

  try {
    const res = await fetch('/api/specialist?action=review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${specialistState.session.access_code}`
      },
      body: JSON.stringify(reviewData)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al guardar la revisión.');
    }

    showToast('Revisión profesional enviada con éxito.', 'success');
    closeReviewModal();
    
    // Recargar reportes del dashboard
    await loadSpecialistReports();

  } catch (error) {
    console.error('Error al enviar la revisión:', error);
    showToast(error.message, 'error');
  } finally {
    hideSpinner(submitBtn, '✅ Enviar Revisión');
  }
}
