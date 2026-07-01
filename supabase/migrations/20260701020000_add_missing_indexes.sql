-- ==========================================================================
-- MIGRACIÓN: Índices de rendimiento faltantes
-- Fecha: 2026-07-01
-- ==========================================================================

-- Fix #85: Faltaba índice en specialist_reviews(specialist_id).
-- Este índice acelera queries que buscan "todas las revisiones de un especialista"
-- (usadas en el tab "Mis revisiones" del dashboard de especialistas).
CREATE INDEX IF NOT EXISTS idx_reviews_specialist_id
  ON specialist_reviews(specialist_id);

-- Fix #84: Índice espacial para queries geográficas del mapa.
-- Las queries del mapa filtran por latitude/longitude NOT NULL y luego
-- Leaflet/JS hace el clustering en el cliente. Un índice compuesto en
-- (latitude, longitude) acelera el filtrado inicial de registros con coords.
-- Nota: Para queries espaciales avanzadas (radio, polígono), usar PostGIS
-- con un índice GIST: CREATE INDEX ... USING GIST(ST_MakePoint(longitude, latitude)::geography);
-- Pero para el caso de uso actual (NOT NULL filter + bounding box simple), esto es suficiente.
CREATE INDEX IF NOT EXISTS idx_reports_coordinates
  ON reports(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Índice adicional útil: búsqueda combinada para el panel de especialistas
-- (status + created_at es el ordenamiento más común en el listado de pendientes)
CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports(status, created_at DESC);
