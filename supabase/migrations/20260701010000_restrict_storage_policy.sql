-- ==========================================================================
-- MIGRACIÓN: Restringir política de uploads al bucket de Storage
-- Fecha: 2026-07-01
-- Motivo (Fix #20): La política anterior "Anyone can upload damage photos"
-- permitía que CUALQUIER persona (sin autenticación) subiera archivos al
-- bucket 'damage-photos'. Esto podía usarse para subir contenido malicioso
-- o abusar del almacenamiento.
--
-- Solución: Restringir uploads a que solo la Service Role Key del servidor
-- pueda insertar (los uploads se hacen desde api/analyze.js con service_role).
-- Los uploads anónimos desde el frontend fueron reemplazados por uploads
-- del lado del servidor en la función serverless.
-- ==========================================================================

-- Eliminar la política permisiva existente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Anyone can upload damage photos'
  ) THEN
    DROP POLICY "Anyone can upload damage photos" ON storage.objects;
  END IF;
END
$$;

-- Crear política restrictiva: solo el service_role puede insertar archivos
-- (los uploads se realizan desde el backend Node.js con la Service Role Key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Service role can upload damage photos'
  ) THEN
    CREATE POLICY "Service role can upload damage photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'damage-photos'
      AND auth.role() = 'service_role'
    );
  END IF;
END
$$;

-- Mantener la política de lectura pública (los reportes son públicos intencionalmente)
-- No se modifica "Public read damage photos"
