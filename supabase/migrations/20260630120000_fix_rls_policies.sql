-- ==========================================================================
-- MIGRACIÓN: Corrección de Políticas RLS (Row Level Security)
-- Fecha: 2026-06-30
-- Problema: Políticas demasiado permisivas permitían que usuarios anónimos
--           pudieran modificar y eliminar datos libremente.
-- Solución: Restringir escritura/actualización exclusivamente al service_role
--           (usado por los endpoints serverless de Vercel). La lectura pública
--           se mantiene para el mapa y la visualización de reportes.
-- ==========================================================================

-- =========================================================
-- TABLA: reports
-- =========================================================
-- Asegurar que RLS esté activo
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas permisivas y las nuevas para asegurar idempotencia
DROP POLICY IF EXISTS "reports_select" ON reports;
DROP POLICY IF EXISTS "reports_insert" ON reports;
DROP POLICY IF EXISTS "reports_update" ON reports;
DROP POLICY IF EXISTS "reports_delete" ON reports;
DROP POLICY IF EXISTS "reports_select_public" ON reports;
DROP POLICY IF EXISTS "reports_insert_service_only" ON reports;
DROP POLICY IF EXISTS "reports_update_service_only" ON reports;
DROP POLICY IF EXISTS "reports_delete_blocked" ON reports;

-- Lectura pública: cualquier usuario (anon/service_role) puede leer reportes
-- Esto permite que el mapa público cargue los pins sin autenticación.
CREATE POLICY "reports_select_public"
  ON reports FOR SELECT
  USING (true);

-- Inserción: solo el service_role (servidor Vercel) puede crear reportes
CREATE POLICY "reports_insert_service_only"
  ON reports FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Actualización: solo el service_role puede modificar reportes
-- (p.ej., marcar como 'reviewed' tras revisión de un especialista)
CREATE POLICY "reports_update_service_only"
  ON reports FOR UPDATE
  USING (auth.role() = 'service_role');

-- Eliminación: bloqueada para todos (incluyendo service_role vía anon)
-- Los reportes nunca deben eliminarse desde el cliente.
CREATE POLICY "reports_delete_blocked"
  ON reports FOR DELETE
  USING (false);

-- =========================================================
-- TABLA: specialist_reviews
-- =========================================================
ALTER TABLE specialist_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_insert" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_update" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_delete" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_select_public" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_insert_service_only" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_update_blocked" ON specialist_reviews;
DROP POLICY IF EXISTS "reviews_delete_blocked" ON specialist_reviews;

-- Lectura pública: permite cargar revisiones en el panel de detalles del reporte
CREATE POLICY "reviews_select_public"
  ON specialist_reviews FOR SELECT
  USING (true);

-- Inserción: solo el service_role (servidor Vercel) puede registrar revisiones
CREATE POLICY "reviews_insert_service_only"
  ON specialist_reviews FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Actualización y eliminación: bloqueadas para todos
CREATE POLICY "reviews_update_blocked"
  ON specialist_reviews FOR UPDATE
  USING (false);

CREATE POLICY "reviews_delete_blocked"
  ON specialist_reviews FOR DELETE
  USING (false);

-- =========================================================
-- TABLA: specialists
-- =========================================================
ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "specialists_select_service" ON specialists;
DROP POLICY IF EXISTS "specialists_update_service" ON specialists;
DROP POLICY IF EXISTS "specialists_insert_service" ON specialists;
DROP POLICY IF EXISTS "specialists_delete_service" ON specialists;
DROP POLICY IF EXISTS "specialists_select_service_only" ON specialists;
DROP POLICY IF EXISTS "specialists_insert_service_only" ON specialists;
DROP POLICY IF EXISTS "specialists_update_service_only" ON specialists;
DROP POLICY IF EXISTS "specialists_delete_blocked" ON specialists;

-- Ningún acceso vía anon key: toda la tabla está gestionada exclusivamente
-- por el servidor (service_role) para autenticación y gestión de especialistas.
CREATE POLICY "specialists_select_service_only"
  ON specialists FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "specialists_insert_service_only"
  ON specialists FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "specialists_update_service_only"
  ON specialists FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "specialists_delete_blocked"
  ON specialists FOR DELETE
  USING (false);
