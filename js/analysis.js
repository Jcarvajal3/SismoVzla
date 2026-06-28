/**
 * ==========================================================================
 * ANALYSIS.JS - Módulo de Envío y Renderizado de Diagnósticos
 * ==========================================================================
 */

/**
 * Envía las imágenes y los datos del edificio al endpoint de análisis.
 * @param {Array<Object>} images - Array de imágenes comprimidas en base64.
 * @param {Object} formData - Objeto con los datos de ubicación e inmueble.
 * @returns {Promise<Object>} Promesa con el diagnóstico del servidor.
 */
async function submitAnalysis(images, formData) {
  const requestBody = {
    images: images.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
    buildingInfo: {
      tipo_inmueble: formData.tipo,
      piso: formData.piso ? parseInt(formData.piso) : null,
      descripcion_usuario: formData.descripcion,
      estado: formData.estado,
      municipio: formData.municipio,
      parroquia: formData.parroquia,
      direccion: formData.direccion,
      nombre_edificio: formData.edificio,
      latitude: formData.lat ? parseFloat(formData.lat) : null,
      longitude: formData.lng ? parseFloat(formData.lng) : null
    }
  };

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor (${response.status})`);
  }

  return response.json();
}

/**
 * Retorna la clase CSS correspondiente al nivel de riesgo.
 * @param {string} nivel - Nivel de riesgo ('BAJO', 'MEDIO', 'ALTO', 'CRITICO').
 * @returns {string} Clase CSS.
 */
function getRiskColor(nivel) {
  const mapping = {
    'BAJO': 'bajo',
    'MEDIO': 'medio',
    'ALTO': 'alto',
    'CRITICO': 'critico'
  };
  return mapping[nivel?.toUpperCase()] || 'bajo';
}

/**
 * Renderiza los resultados del diagnóstico en la UI.
 * @param {Object} diagnosis - Diagnóstico JSON devuelto por el servidor.
 * @param {string} reportId - ID del reporte en base de datos.
 * @param {string} containerId - ID del contenedor de resultados.
 */
/**
 * Renderiza los resultados del diagnóstico en la UI.
 * @param {Object} diagnosis - Diagnóstico JSON devuelto por el servidor.
 * @param {string} reportId - ID del reporte en base de datos.
 * @param {string} containerId - ID del contenedor de resultados.
 * @param {Array} [reviews=[]] - Revisiones del especialista asociadas.
 */
function displayResults(diagnosis, reportId, containerId, reviews = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const riskClass = getRiskColor(diagnosis.nivel_riesgo);
  
  // Limpiar clases anteriores del contenedor de resultados
  container.className = `card result-card card-${riskClass}`;
  
  // Construir HTML
  container.innerHTML = buildResultHTML(diagnosis, reportId, reviews);
  container.hidden = false;

  // Hacer scroll suave hacia los resultados
  container.scrollIntoView({ behavior: 'smooth' });

  // Iniciar la barra de riesgo después de mostrar la UI (animación)
  setTimeout(() => {
    const riskBar = document.getElementById('risk-probability-bar');
    if (riskBar) {
      riskBar.style.width = `${diagnosis.probabilidad_riesgo || 0}%`;
    }
  }, 100);

  // Vincular botones de acción sin inline onclick (prevención XSS)
  const shareBtn = document.getElementById('btn-share-report');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      handleShareReport(window._lastReportId, window._lastDiagnosis);
    });
  }
  const newAnalysisBtn = document.getElementById('btn-new-analysis');
  if (newAnalysisBtn) {
    newAnalysisBtn.addEventListener('click', handleNewAnalysis);
  }
}

/**
 * Construye el bloque HTML correspondiente a los resultados del análisis.
 * @param {Object} diagnosis - Objeto de diagnóstico.
 * @param {string} reportId - ID único del reporte.
 * @param {Array} [reviews=[]] - Lista de revisiones profesionales.
 * @returns {string} Código HTML.
 */
function buildResultHTML(diagnosis, reportId, reviews = []) {
  const riskClass = getRiskColor(diagnosis.nivel_riesgo);
  const formattedRisk = diagnosis.nivel_riesgo || 'MEDIO';

  // Etiqueta de acceso ANIH (Verde/Amarilla/Roja)
  const etiqueta = diagnosis.etiqueta_acceso || '';
  const etiquetaConfig = {
    'VERDE':    { icon: '🟢', label: 'Acceso Permitido',    style: 'background:rgba(34,197,94,0.15); color:#16a34a; border:1px solid #16a34a;' },
    'AMARILLA': { icon: '🟡', label: 'Acceso Restringido',  style: 'background:rgba(234,179,8,0.15);  color:#b45309; border:1px solid #ca8a04;' },
    'ROJA':     { icon: '🔴', label: 'Acceso No Permitido', style: 'background:rgba(239,68,68,0.15);  color:#dc2626; border:1px solid #dc2626;' },
  };
  const etiquetaInfo = etiquetaConfig[etiqueta] || null;
  const etiquetaHtml = etiquetaInfo
    ? `<div style="display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:0.5px; ${etiquetaInfo.style}">
        ${etiquetaInfo.icon} ETIQUETA ${etiqueta} — ${etiquetaInfo.label}
       </div>`
    : '';

  let specialistReviewHtml = '';
  if (reviews && reviews.length > 0) {
    const rev = reviews[0];
    const specRiskClass = getRiskColor(rev.nivel_riesgo_corregido);
    
    const typesHtml = (rev.tipo_dano || []).map(t => `<span class="pill" style="font-size: 11px; padding: 2px 8px;">${sanitizeHTML(t)}</span>`).join(' ');
    const elemsHtml = (rev.elementos_afectados || []).map(e => `<span class="pill" style="font-size: 11px; padding: 2px 8px;">${sanitizeHTML(e)}</span>`).join(' ');
    
    specialistReviewHtml = `
      <div class="specialist-review-box" style="border: 2px solid var(--accent-secondary); background-color: rgba(59, 130, 246, 0.05); border-radius: var(--radius-md); margin-bottom: var(--space-xl); padding: var(--space-md); box-shadow: var(--shadow-card);">
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-xs); margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="color: var(--accent-secondary); font-size: var(--font-size-lg); border-left: none; padding-left: 0; margin-bottom: 0;">👷 Validación de Especialista</h3>
          <span class="badge" style="background-color: var(--accent-secondary); color: #fff; border: none;">Validado</span>
        </div>
        <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-md); display: flex; flex-direction: column; gap: 4px;">
          <div><strong>Ingeniero:</strong> ${sanitizeHTML(rev.nombre_especialista)} ${rev.numero_colegiado ? `(C.I.V. ${sanitizeHTML(rev.numero_colegiado)})` : ''}</div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <strong>Dictamen de Riesgo:</strong> 
            <span class="badge badge-${specRiskClass}" style="font-size:10px; padding:1px 8px;">${rev.nivel_riesgo_corregido}</span>
          </div>
        </div>
        <div class="diagnosis-section" style="margin-bottom: var(--space-md);">
          <p style="font-size: 14px; line-height: 1.5; color: var(--text-primary);"><strong>Evaluación Técnica:</strong> ${sanitizeHTML(rev.diagnostico)}</p>
        </div>
        ${typesHtml ? `<div style="font-size:13px; margin-bottom:8px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong>Tipos de daño:</strong> ${typesHtml}</div>` : ''}
        ${elemsHtml ? `<div style="font-size:13px; margin-bottom:8px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong>Elementos comprometidos:</strong> ${elemsHtml}</div>` : ''}
        ${rev.recomendaciones ? `<p style="font-size:13px; margin-top:8px; color: var(--text-secondary);"><strong>Recomendaciones profesionales:</strong> ${sanitizeHTML(rev.recomendaciones)}</p>` : ''}
        ${rev.requiere_evacuacion ? `
          <div class="banner-evacuacion" style="margin-top: var(--space-md); margin-bottom: 0; background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%); border: 1px solid var(--risk-critico);">
            <span class="banner-icon">🚨</span>
            <div class="banner-content">
              <h4 style="font-size: var(--font-size-base); color: #f87171; margin-bottom: 2px;">¡Orden de Evacuación Profesional!</h4>
              <p style="font-size: 12px; color: var(--text-primary); margin: 0;">El especialista determinó que la edificación NO es segura. Desocupe inmediatamente.</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Si las fotos no correspondían a daños
  if (diagnosis.nivel_riesgo === 'N/A') {
    return `
      <div class="result-header">
        <h3 class="result-title">❌ Análisis No Válido</h3>
        <span class="badge badge-medio">Información</span>
      </div>
      <div class="diagnosis-section">
        <p>${sanitizeHTML(diagnosis.descripcion_danos)}</p>
      </div>
      <div class="disclaimer-box">
        <p>⚠️ Intente tomar fotos de grietas en paredes, vigas, columnas o desprendimientos de concreto a una distancia prudencial (1 a 2 metros).</p>
      </div>
    `;
  }

  // Generar pills para los elementos afectados
  const elementsHtml = (diagnosis.elementos_afectados || [])
    .map(el => `<span class="pill">${sanitizeHTML(el)}</span>`)
    .join('');

  // Generar recomendaciones
  const recsHtml = (diagnosis.recomendaciones || [])
    .map(rec => `<li>${sanitizeHTML(rec)}</li>`)
    .join('');

  // Generar checklist de qué observar
  const obsHtml = (diagnosis.que_observar || [])
    .map(obs => `<li>${sanitizeHTML(obs)}</li>`)
    .join('');

  // Banner de evacuación si es necesario
  let evacuationBanner = '';
  if (diagnosis.requiere_evacuacion_inmediata) {
    evacuationBanner = `
      <div class="banner-evacuacion">
        <span class="banner-icon">🚨</span>
        <div class="banner-content">
          <h4>¡Se Recomienda Evacuación Inmediata!</h4>
          <p>Se detectaron daños graves que comprometen la estabilidad del inmueble. Por favor, desocupe la edificación y llame a las autoridades locales de Protección Civil.</p>
        </div>
      </div>
    `;
  }

  // Acciones inmediatas
  let actionsBox = '';
  if (diagnosis.acciones_inmediatas && diagnosis.acciones_inmediatas.length > 0) {
    const actionsList = diagnosis.acciones_inmediatas
      .map(act => `<li>${sanitizeHTML(act)}</li>`)
      .join('');
    actionsBox = `
      <div class="action-box">
        <h4>🚨 Medidas de Seguridad Inmediatas:</h4>
        <ul>${actionsList}</ul>
      </div>
    `;
  }

  // Almacenar datos de diagnóstico para compartir sin inline onclick
  window._lastDiagnosis = diagnosis;
  window._lastReportId = reportId;

  return `
    ${specialistReviewHtml}
    ${evacuationBanner}
    
    <div class="result-header">
      <h3 class="result-title">Análisis de Riesgo Preliminar</h3>
      <span class="badge badge-${riskClass}">${formattedRisk}</span>
    </div>
    ${etiquetaHtml ? `
    <div style="margin-bottom: var(--space-md); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <span style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">Dictamen de Acceso (Metodología ANIH 2023):</span>
      ${etiquetaHtml}
    </div>` : ''}

    <!-- Medidor de Riesgo -->
    <div class="risk-meter">
      <div class="risk-meter-label">
        <span>Índice de severidad estimado</span>
        <span>${diagnosis.probabilidad_riesgo || 0}%</span>
      </div>
      <div class="risk-bar-container">
        <div id="risk-probability-bar" class="risk-bar bar-${riskClass}"></div>
      </div>
    </div>

    <div class="diagnosis-section">
      <h3>Diagnóstico de Daños</h3>
      <p><strong>Tipo de Daño:</strong> ${sanitizeHTML(diagnosis.tipo_dano)}</p>
      <p style="margin-top: 10px;">${sanitizeHTML(diagnosis.descripcion_danos)}</p>
    </div>

    ${elementsHtml ? `
      <div class="diagnosis-section">
        <h3>Elementos Estructurales Afectados</h3>
        <div class="pills-container">${elementsHtml}</div>
      </div>
    ` : ''}

    ${actionsBox}

    ${recsHtml ? `
      <div class="diagnosis-section">
        <h3>Recomendaciones Clave</h3>
        <ol class="recommendations-list">${recsHtml}</ol>
      </div>
    ` : ''}

    ${obsHtml ? `
      <div class="diagnosis-section">
        <h3>¿Qué observar en las próximas horas?</h3>
        <ul class="observations-list">${obsHtml}</ul>
      </div>
    ` : ''}

    <div class="disclaimer-box">
      <p>⚠️ <strong>Aviso Importante (Disclaimer):</strong> Este diagnóstico fue generado automáticamente con criterios de la metodología <strong>"Evaluación Rápida de Daños en Edificaciones"</strong> (ANIH, Boletín Nº 61, 2023) desarrollada por FUNVISIS. Posee carácter únicamente informativo y no reemplaza bajo ninguna circunstancia una inspección física realizada por ingenieros civiles, bomberos o personal calificado de Protección Civil.</p>
    </div>

    <div class="result-actions">
      <button type="button" class="btn btn-secondary" id="btn-share-report">
        📤 Compartir Reporte
      </button>
      <button type="button" class="btn btn-primary" id="btn-new-analysis">
        🔄 Nuevo Análisis
      </button>
    </div>
  `;
}

/**
 * Enlace para compartir un reporte utilizando Web Share API.
 * @param {string} reportId - ID del reporte.
 * @param {Object} diagnosis - Objeto de diagnóstico.
 */
async function handleShareReport(reportId, diagnosis) {
  const shareText = `🇻🇪 Evaluación Sísmica Venezuela\n` +
    `📍 Inmueble Evaluado\n` +
    `⚠️ Riesgo estimado: ${diagnosis.nivel_riesgo}\n` +
    `📋 ${diagnosis.tipo_dano}\n` +
    `🔗 Ver reporte: ${window.location.origin}#reporte/${reportId}`;
  
  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Evaluación Sísmica Venezuela',
        text: shareText
      });
      showToast('Reporte compartido con éxito', 'success');
    } else {
      await navigator.clipboard.writeText(shareText);
      showToast('Reporte copiado al portapapeles', 'success');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error al compartir:', error);
      showToast('No se pudo compartir el reporte', 'error');
    }
  }
}

/**
 * Notificación/simulación al solicitar revisión técnica presencial.
 */
function requestSpecialistAlert() {
  showToast(
    'Tu reporte está registrado en el sistema. Los ingenieros y especialistas de guardia podrán visualizarlo en el panel y emitir un diagnóstico validado.',
    'success',
    6000
  );
}
