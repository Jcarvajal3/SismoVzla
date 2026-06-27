/**
 * ==========================================================================
 * CAMERA.JS - Módulo de Captura y Compresión de Imágenes (Canvas API)
 * ==========================================================================
 */

const cameraState = {
  images: [], // Array de { blob, base64, originalSize, compressedSize, mimeType }
  maxImages: 4
};

/**
 * Inicializa los controladores de eventos para la carga de imágenes.
 * Soporta dos flujos: cámara directa y selección de galería.
 */
function initCamera() {
  const cameraInput  = document.getElementById('input-fotos-camara');
  const galleryInput = document.getElementById('input-fotos-galeria');
  const cameraBtn    = document.getElementById('btn-tomar-foto');
  const galleryBtn   = document.getElementById('btn-galeria');
  const uploadArea   = document.getElementById('image-upload-area');

  if (!cameraInput || !galleryInput || !cameraBtn || !galleryBtn) return;

  // Botón "Tomar foto" → dispara el input con capture="environment"
  cameraBtn.addEventListener('click', () => cameraInput.click());

  // Botón "Elegir de galería" → dispara el input sin capture (galería)
  galleryBtn.addEventListener('click', () => galleryInput.click());

  // Ambos inputs comparten el mismo manejador de selección
  cameraInput.addEventListener('change',  handleImageSelect);
  galleryInput.addEventListener('change', handleImageSelect);

  // Drag & Drop sobre el área de acciones (fallback de escritorio)
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImageSelect({ target: { files: e.dataTransfer.files, value: '' } });
      }
    });
  }
}

/**
 * Procesa la selección de archivos, comprime cada imagen y actualiza la UI.
 * @param {Event} event - Evento del input.
 */
async function handleImageSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  const currentCount = cameraState.images.length;
  const remainingSlots = cameraState.maxImages - currentCount;

  if (remainingSlots <= 0) {
    showToast(`Ya has subido el límite de ${cameraState.maxImages} fotos.`, 'warning');
    return;
  }

  // Filtrar solo las imágenes que caben
  const filesToProcess = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    showToast(`Solo se procesaron las primeras ${remainingSlots} fotos (máx. ${cameraState.maxImages} total).`, 'warning');
  }

  // Mostrar indicador de compresión/procesamiento
  const compressionInfo = document.getElementById('compression-info');
  if (compressionInfo) {
    compressionInfo.textContent = 'Procesando y comprimiendo imágenes...';
    compressionInfo.hidden = false;
  }

  for (const file of filesToProcess) {
    if (!file.type.startsWith('image/')) {
      showToast(`El archivo ${file.name} no es una imagen válida.`, 'error');
      continue;
    }

    try {
      const result = await compressImage(file);
      cameraState.images.push(result);
    } catch (error) {
      console.error('Error comprimiendo imagen:', error);
      showToast(`Error al procesar la imagen ${file.name}.`, 'error');
    }
  }

  // Limpiar valor del input para permitir volver a seleccionar el mismo archivo
  if (event.target && 'value' in event.target) {
    event.target.value = '';
  }

  // Actualizar la interfaz
  renderPreviews();
}

/**
 * Comprime una imagen usando Canvas API.
 * Ancho máximo: 1200px, Calidad JPEG: 0.7.
 * @param {File} file - Archivo de imagen original.
 * @returns {Promise<Object>} Promesa con los datos comprimidos.
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;
        
        // Redimensionar si excede la dimensión máxima
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir a blob JPEG con calidad 0.7
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Fallo al crear Blob de canvas'));
            return;
          }
          
          const fileReader = new FileReader();
          fileReader.readAsDataURL(blob);
          fileReader.onloadend = () => {
            // Extraer solo la parte base64 sin el esquema del DataURL
            const base64Data = fileReader.result.split(',')[1];
            
            resolve({
              blob: blob,
              base64: base64Data,
              mimeType: 'image/jpeg',
              originalSize: file.size,
              compressedSize: blob.size
            });
          };
          fileReader.onerror = (err) => reject(new Error('Error al leer el blob comprimido.'));
        }, 'image/jpeg', 0.7);
      };
      
      img.onerror = (err) => reject(err);
    };
    
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Elimina una imagen del estado por su índice y actualiza la UI.
 * @param {number} index - Índice de la imagen.
 */
function removeImage(index) {
  if (index >= 0 && index < cameraState.images.length) {
    cameraState.images.splice(index, 1);
    renderPreviews();
  }
}

/**
 * Retorna las imágenes cargadas actualmente.
 * @returns {Array<Object>} Lista de imágenes.
 */
function getImages() {
  return cameraState.images;
}

/**
 * Limpia todas las imágenes cargadas y actualiza la UI.
 */
function clearImages() {
  cameraState.images = [];
  renderPreviews();
}

/**
 * Dibuja las miniaturas (previews) de las imágenes cargadas en la UI.
 */
function renderPreviews() {
  const previewContainer = document.getElementById('image-previews');
  const compressionInfo = document.getElementById('compression-info');

  if (!previewContainer) return;

  previewContainer.innerHTML = '';

  if (cameraState.images.length === 0) {
    if (compressionInfo) compressionInfo.hidden = true;
    return;
  }

  let totalOriginal = 0;
  let totalCompressed = 0;

  cameraState.images.forEach((img, index) => {
    totalOriginal += img.originalSize;
    totalCompressed += img.compressedSize;

    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';

    // Generar URL temporal local para renderizar el preview
    const objectURL = URL.createObjectURL(img.blob);

    previewItem.innerHTML = `
      <img src="${objectURL}" alt="Preview ${index + 1}">
      <button type="button" class="preview-remove" onclick="removeImage(${index})" aria-label="Eliminar foto">&times;</button>
      <div class="preview-size-info">${formatFileSize(img.compressedSize)}</div>
    `;

    previewContainer.appendChild(previewItem);
    
    // Revocar la URL después de un momento para no causar fugas de memoria
    previewItem.querySelector('img').onload = () => {
      URL.revokeObjectURL(objectURL);
    };
  });

  // Mostrar estadísticas de compresión acumuladas
  if (compressionInfo) {
    const count = cameraState.images.length;
    const savings = ((1 - (totalCompressed / totalOriginal)) * 100).toFixed(0);
    const photosWord = count === 1 ? 'foto seleccionada' : 'fotos seleccionadas';
    compressionInfo.textContent = `${count} ${photosWord} (${formatFileSize(totalOriginal)} ➔ ${formatFileSize(totalCompressed)} | -${savings}%)`;
    compressionInfo.hidden = false;
  }
}
