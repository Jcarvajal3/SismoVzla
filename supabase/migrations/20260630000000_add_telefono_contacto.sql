-- Agregar la columna para guardar el número de teléfono opcional del usuario
ALTER TABLE reports ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(50);
