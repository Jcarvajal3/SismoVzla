-- ==========================================================================
-- MIGRACIÓN: Desactivar credenciales de demo en producción
-- Fecha: 2026-07-01
-- Motivo: Las credenciales DEMO-SPEC-2026 y SPEC-ADMIN-001 estaban activas
--         en producción, permitiendo acceso no autorizado al portal de especialistas.
-- ==========================================================================

-- Desactivar especialistas de demo para prevenir acceso no autorizado.
-- Nota: Se usa DO UPDATE en lugar de simple UPDATE para poder ejecutar esta
-- migración de forma idempotente sin afectar cuentas reales de especialistas.
UPDATE specialists
SET is_active = FALSE
WHERE access_code IN ('DEMO-SPEC-2026', 'SPEC-ADMIN-001');

-- Para activar en desarrollo local solamente:
-- UPDATE specialists SET is_active = TRUE WHERE access_code = 'DEMO-SPEC-2026';
