/**
 * ==========================================================================
 * UTILS.JS - Utilidades Compartidas y Helpers de UI
 * ==========================================================================
 */

/**
 * Muestra una notificación toast animada.
 * @param {string} message - Mensaje a mostrar.
 * @param {string} type - Tipo de toast: 'success', 'error', 'warning', 'info'.
 * @param {number} duration - Duración en milisegundos (por defecto 4000ms).
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Iconos según tipo
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  const icon = icons[type] || 'ℹ️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${sanitizeHTML(message)}</span>
    <button class="toast-close" aria-label="Cerrar">&times;</button>
  `;

  container.appendChild(toast);

  // Funciones de eliminación
  const removeToast = () => {
    if (toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  };

  // Event listener para el botón cerrar
  toast.querySelector('.toast-close').addEventListener('click', removeToast);

  // Auto-eliminar después del tiempo especificado
  setTimeout(removeToast, duration);
}

/**
 * Reemplaza el contenido de un elemento con skeleton loading animado.
 * @param {string} containerId - ID del contenedor HTML.
 * @param {number} linesCount - Cantidad de líneas skeleton a dibujar.
 */
function showLoading(containerId, linesCount = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Guardar contenido original en un atributo de datos para poder restaurarlo
  if (!container.dataset.originalHtml) {
    container.dataset.originalHtml = container.innerHTML;
  }

  let skeletonHtml = '<div class="skeleton-wrapper" style="display:flex; flex-direction:column; gap:12px;">';
  for (let i = 0; i < linesCount; i++) {
    const width = i === linesCount - 1 ? '60%' : '100%';
    skeletonHtml += `<div class="skeleton" style="height: 18px; width: ${width};"></div>`;
  }
  skeletonHtml += '</div>';
  
  container.innerHTML = skeletonHtml;
  container.removeAttribute('hidden');
}

/**
 * Remueve el skeleton loading y restaura el contenido original.
 * @param {string} containerId - ID del contenedor HTML.
 */
function hideLoading(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.dataset.originalHtml) {
    container.innerHTML = container.dataset.originalHtml;
    delete container.dataset.originalHtml;
  }
}

/**
 * Reemplaza el texto del botón con un spinner y lo deshabilita.
 * @param {HTMLElement} buttonEl - Elemento botón HTML.
 */
function showSpinner(buttonEl) {
  if (!buttonEl) return;
  buttonEl.disabled = true;
  buttonEl.dataset.originalText = buttonEl.innerHTML;
  buttonEl.innerHTML = '<span class="spinner"></span>';
}

/**
 * Restaura el texto original del botón y lo vuelve a habilitar.
 * @param {HTMLElement} buttonEl - Elemento botón HTML.
 * @param {string} [originalText] - Texto a restaurar (opcional).
 */
function hideSpinner(buttonEl, originalText) {
  if (!buttonEl) return;
  buttonEl.disabled = false;
  buttonEl.innerHTML = originalText || buttonEl.dataset.originalText || 'Enviar';
  delete buttonEl.dataset.originalText;
}

/**
 * Formatea una fecha ISO a formato legible "27 jun 2026, 2:30 PM".
 * @param {string} isoString - Fecha en formato ISO.
 * @returns {string} Fecha formateada.
 */
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const optionsDate = { day: 'numeric', month: 'short', year: 'numeric' };
  const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };

  const formattedDate = date.toLocaleDateString('es-VE', optionsDate);
  const formattedTime = date.toLocaleTimeString('es-VE', optionsTime);

  return `${formattedDate}, ${formattedTime}`;
}

/**
 * Formatea un número de bytes a KB o MB.
 * @param {number} bytes - Tamaño en bytes.
 * @returns {string} Cadena formateada (ej: "350 KB" o "1.2 MB").
 */
function formatFileSize(bytes) {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Genera un UUID v4 básico en el cliente.
 * @returns {string} UUID aleatorio.
 */
function generateUUID() {
  // UUID v4 compatible con navegadores viejos y entornos sin crypto.randomUUID
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Escapa HTML para evitar ataques XSS al inyectar cadenas de texto en el DOM.
 * @param {string} str - Cadena de texto a sanitizar.
 * @returns {string} Cadena sanitizada.
 */
function sanitizeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return map[m];
  });
}

/**
 * Limita la frecuencia de ejecución de una función (Debounce).
 * @param {Function} fn - Función a ejecutar.
 * @param {number} delay - Retraso en milisegundos.
 * @returns {Function} Función debounced.
 */
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Valida que los campos requeridos estén presentes en un objeto de datos de formulario.
 * @param {Object} formData - Datos del formulario.
 * @returns {{valid: boolean, errors: string[]}} Resultado de la validación.
 */
function validateForm(formData) {
  const errors = [];
  
  if (!formData.estado || formData.estado.trim() === '') {
    errors.push('El estado es requerido.');
  }
  if (!formData.municipio || formData.municipio.trim() === '') {
    errors.push('El municipio es requerido.');
  }
  if (!formData.edificio || formData.edificio.trim() === '') {
    errors.push('El nombre del edificio o residencia es requerido.');
  }
  if (!formData.tipo || formData.tipo.trim() === '') {
    errors.push('El tipo de inmueble es requerido.');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
