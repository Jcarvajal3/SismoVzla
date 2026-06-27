/**
 * ==========================================================================
 * LOCATION.JS - Módulo de Geolocalización y Geocodificación Inversa
 * ==========================================================================
 */

const ESTADOS_VENEZUELA = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas',
  'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital',
  'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida',
  'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'
];

const ESTADOS_AFECTADOS = [
  'Aragua',
  'Caracas',
  'Falcón',
  'La Guaira',
  'Miranda',
  'Yaracuy'
];

/**
 * Inicializa el módulo de ubicación, llena los dropdowns de estados y asocia eventos.
 */
function initLocation() {
  fillEstadosDropdown('select-estado');
  fillEstadosDropdown('filter-estado'); // También llenamos el filtro de la sección del mapa

  const selectEstado = document.getElementById('select-estado');
  const groupEstadoOtro = document.getElementById('group-estado-otro');
  const inputEstadoOtro = document.getElementById('input-estado-otro');

  if (selectEstado && groupEstadoOtro && inputEstadoOtro) {
    selectEstado.addEventListener('change', () => {
      if (selectEstado.value === 'Otro') {
        groupEstadoOtro.style.display = 'block';
        inputEstadoOtro.setAttribute('required', 'true');
        inputEstadoOtro.setAttribute('aria-required', 'true');
        inputEstadoOtro.focus();
      } else {
        groupEstadoOtro.style.display = 'none';
        inputEstadoOtro.removeAttribute('required');
        inputEstadoOtro.removeAttribute('aria-required');
        inputEstadoOtro.value = '';
      }
    });
  }

  const form = document.getElementById('form-evaluacion');
  if (form && groupEstadoOtro && inputEstadoOtro) {
    form.addEventListener('reset', () => {
      groupEstadoOtro.style.display = 'none';
      inputEstadoOtro.removeAttribute('required');
      inputEstadoOtro.removeAttribute('aria-required');
    });
  }

  const geoBtn = document.getElementById('btn-geolocalizacion');
  if (geoBtn) {
    geoBtn.addEventListener('click', handleGeolocationRequest);
  }
}

/**
 * Llena un elemento select de HTML con los estados correspondientes.
 * @param {string} selectId - ID del select HTML.
 */
function fillEstadosDropdown(selectId) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return;

  // Preservar la primera opción por defecto
  const defaultOption = selectEl.options[0];
  selectEl.innerHTML = '';
  if (defaultOption) selectEl.appendChild(defaultOption);

  if (selectId === 'select-estado') {
    ESTADOS_AFECTADOS.forEach(estado => {
      const option = document.createElement('option');
      option.value = estado;
      option.textContent = estado;
      selectEl.appendChild(option);
    });
    // Agregar opción "Otro"
    const optionOtro = document.createElement('option');
    optionOtro.value = 'Otro';
    optionOtro.textContent = 'Otro (Especificar)';
    selectEl.appendChild(optionOtro);
  } else {
    ESTADOS_VENEZUELA.forEach(estado => {
      const option = document.createElement('option');
      option.value = estado;
      option.textContent = estado;
      selectEl.appendChild(option);
    });
  }
}

/**
 * Event handler para el botón de geolocalización.
 */
async function handleGeolocationRequest() {
  const geoBtn = document.getElementById('btn-geolocalizacion');
  const statusEl = document.getElementById('geo-status');

  if (!navigator.geolocation) {
    showToast('La geolocalización no está soportada por tu navegador.', 'error');
    return;
  }

  showSpinner(geoBtn);
  if (statusEl) {
    statusEl.textContent = 'Obteniendo coordenadas GPS...';
    statusEl.className = 'geo-status';
    statusEl.hidden = false;
  }

  try {
    const coords = await requestGeolocation();
    
    // Guardar coordenadas en los campos ocultos del formulario
    const latInput = document.getElementById('input-lat');
    const lngInput = document.getElementById('input-lng');
    if (latInput) latInput.value = coords.latitude;
    if (lngInput) lngInput.value = coords.longitude;
    
    if (statusEl) {
      statusEl.textContent = `Coordenadas obtenidas: Lat: ${coords.latitude.toFixed(5)}, Lng: ${coords.longitude.toFixed(5)}. Identificando dirección...`;
    }

    // Geocodificación inversa con OpenStreetMap Nominatim
    const address = await reverseGeocode(coords.latitude, coords.longitude);
    
    if (address) {
      // Auto-rellenar campos en base al reverse geocoding
      if (address.estado) {
        const estadoEl = document.getElementById('select-estado');
        const groupEstadoOtro = document.getElementById('group-estado-otro');
        const inputEstadoOtro = document.getElementById('input-estado-otro');

        if (estadoEl) {
          // Map "Distrito Capital" to "Caracas"
          let targetEstado = address.estado;
          if (targetEstado === 'Distrito Capital') {
            targetEstado = 'Caracas';
          }

          if (ESTADOS_AFECTADOS.includes(targetEstado)) {
            estadoEl.value = targetEstado;
            if (groupEstadoOtro) groupEstadoOtro.style.display = 'none';
            if (inputEstadoOtro) {
              inputEstadoOtro.value = '';
              inputEstadoOtro.removeAttribute('required');
            }
          } else {
            // Set to "Otro" and show text field
            estadoEl.value = 'Otro';
            if (groupEstadoOtro) groupEstadoOtro.style.display = 'block';
            if (inputEstadoOtro) {
              inputEstadoOtro.value = targetEstado;
              inputEstadoOtro.setAttribute('required', 'true');
            }
          }
        }
      }
      if (address.municipio) {
        const municipioEl = document.getElementById('input-municipio');
        if (municipioEl) municipioEl.value = address.municipio;
      }
      if (address.parroquia) {
        const parroquiaEl = document.getElementById('input-parroquia');
        if (parroquiaEl) parroquiaEl.value = address.parroquia;
      }

      showToast('Ubicación detectada con éxito.', 'success');
      if (statusEl) {
        statusEl.textContent = `📍 Ubicación detectada: ${address.municipio}, Edo. ${address.estado}`;
        statusEl.className = 'geo-status text-success';
      }
    } else {
      showToast('Coordenadas obtenidas, pero no se pudo determinar la dirección automáticamente.', 'warning');
      if (statusEl) {
        statusEl.textContent = `Coordenadas GPS obtenidas: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}. Complete la dirección manualmente.`;
      }
    }
  } catch (error) {
    console.error('Error de geolocalización:', error);
    let errorMsg = 'No se pudo obtener tu ubicación.';
    if (error.code === 1) errorMsg = 'Permiso denegado para acceder a la ubicación.';
    else if (error.code === 2) errorMsg = 'La posición GPS no está disponible.';
    else if (error.code === 3) errorMsg = 'Tiempo de espera agotado al obtener ubicación.';
    
    showToast(errorMsg, 'error');
    if (statusEl) {
      statusEl.textContent = `⚠️ Error GPS: ${errorMsg} Por favor, complete la ubicación manualmente.`;
      statusEl.className = 'geo-status error-text';
    }
  } finally {
    hideSpinner(geoBtn, '📍 Detectar mi ubicación automáticamente');
  }
}

/**
 * Solicita las coordenadas GPS al navegador mediante Geolocation API.
 * @returns {Promise<Object>} Coordenadas obtenidas.
 */
function requestGeolocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000, // Timeout de 10s
        maximumAge: 0
      }
    );
  });
}

/**
 * Llama a la API de Nominatim de OpenStreetMap para geocodificación inversa.
 * @param {number} lat - Latitud.
 * @param {number} lng - Longitud.
 * @returns {Promise<Object>} Dirección estructurada o null.
 */
async function reverseGeocode(lat, lng) {
  try {
    // Nominatim pide que no se abuse y se envíe accept-language
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`;
    
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.address) return null;

    const addr = data.address;

    // 1. Detectar el estado correspondiente en nuestra lista
    let detectedEstado = '';
    const rawEstado = addr.state || '';
    
    // Normalizar texto para comparación flexible
    const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    // Caso especial Distrito Capital
    if (normalize(rawEstado).includes('distrito capital') || normalize(addr.city || '').includes('caracas')) {
      detectedEstado = 'Distrito Capital';
    } else {
      const match = ESTADOS_VENEZUELA.find(edo => 
        normalize(rawEstado).includes(normalize(edo)) || normalize(edo).includes(normalize(rawEstado))
      );
      detectedEstado = match || '';
    }

    // 2. Extraer municipio
    // Nominatim puede reportar el municipio en county, suburb, city_district o municipality
    const detectedMunicipio = (addr.county || addr.municipality || addr.city_district || addr.town || '')
      .replace(/Municipio/gi, '')
      .trim();

    // 3. Extraer parroquia o localidad
    const detectedParroquia = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';

    // 4. Formar una dirección sugerida legible
    const road = addr.road || '';
    const houseNumber = addr.house_number || '';
    const postcode = addr.postcode ? `Zona Postal ${addr.postcode}` : '';
    const parts = [road, houseNumber, detectedParroquia, postcode].filter(p => p !== '');
    const detectedDireccion = parts.join(', ');

    return {
      estado: detectedEstado,
      municipio: detectedMunicipio,
      parroquia: detectedParroquia,
      direccion: detectedDireccion
    };
  } catch (error) {
    console.error('Error en geocodificación inversa:', error);
    return null;
  }
}

/**
 * Retorna los datos de ubicación capturados en el formulario.
 * @returns {Object} Datos de ubicación.
 */
function getLocationData() {
  const selectEstado = document.getElementById('select-estado');
  const inputEstadoOtro = document.getElementById('input-estado-otro');
  
  let estadoVal = selectEstado ? selectEstado.value : '';
  if (estadoVal === 'Otro' && inputEstadoOtro) {
    estadoVal = inputEstadoOtro.value.trim();
  }

  return {
    estado: estadoVal,
    municipio: document.getElementById('input-municipio').value,
    parroquia: document.getElementById('input-parroquia').value,
    edificio: document.getElementById('input-edificio').value,
    lat: document.getElementById('input-lat').value,
    lng: document.getElementById('input-lng').value
  };
}
