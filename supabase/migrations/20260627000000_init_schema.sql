-- Step 1: Enable PostGIS (for spatial map indexing)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Create specialists table
CREATE TABLE IF NOT EXISTS specialists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  access_code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  nombre VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  telefono VARCHAR(20),
  especialidad VARCHAR(100) DEFAULT 'ingeniero_civil',
  colegio_profesional VARCHAR(200),
  numero_colegiado VARCHAR(50),
  last_login TIMESTAMPTZ,
  reviews_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_specialists_access_code ON specialists(access_code);

-- Step 3: Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  estado VARCHAR(100),
  municipio VARCHAR(100),
  parroquia VARCHAR(200),
  direccion TEXT,
  nombre_edificio VARCHAR(300),
  tipo_inmueble VARCHAR(50) NOT NULL DEFAULT 'casa',
  piso INTEGER,
  descripcion_usuario TEXT,
  image_urls TEXT[] DEFAULT '{}',
  ai_diagnosis JSONB,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  nivel_riesgo VARCHAR(20),
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_nivel_riesgo ON reports(nivel_riesgo);
CREATE INDEX IF NOT EXISTS idx_reports_estado ON reports(estado);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Step 4: Create specialist_reviews table
CREATE TABLE IF NOT EXISTS specialist_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id),
  nivel_riesgo_corregido VARCHAR(20) NOT NULL,
  tipo_dano TEXT[] DEFAULT '{}',
  elementos_afectados TEXT[] DEFAULT '{}',
  diagnostico TEXT NOT NULL,
  recomendaciones TEXT,
  requiere_evacuacion BOOLEAN DEFAULT false,
  requiere_inspeccion_urgente BOOLEAN DEFAULT false,
  nombre_especialista VARCHAR(200),
  colegio_profesional VARCHAR(200),
  numero_colegiado VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_reviews_report_id ON specialist_reviews(report_id);

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;

-- Reports policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'reports_select'
  ) THEN
    CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'reports_insert'
  ) THEN
    CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'reports_update'
  ) THEN
    CREATE POLICY "reports_update" ON reports FOR UPDATE USING (true);
  END IF;
END
$$;

-- Reviews policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'specialist_reviews' AND policyname = 'reviews_select'
  ) THEN
    CREATE POLICY "reviews_select" ON specialist_reviews FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'specialist_reviews' AND policyname = 'reviews_insert'
  ) THEN
    CREATE POLICY "reviews_insert" ON specialist_reviews FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- Specialists policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'specialists' AND policyname = 'specialists_select_service'
  ) THEN
    CREATE POLICY "specialists_select_service" ON specialists FOR SELECT USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'specialists' AND policyname = 'specialists_update_service'
  ) THEN
    CREATE POLICY "specialists_update_service" ON specialists FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- Step 6: Create public bucket in storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('damage-photos', 'damage-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for public damage photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read damage photos'
  ) THEN
    CREATE POLICY "Public read damage photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'damage-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can upload damage photos'
  ) THEN
    CREATE POLICY "Anyone can upload damage photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'damage-photos');
  END IF;
END
$$;

-- Step 7: Insert test specialists
INSERT INTO specialists (access_code, nombre, especialidad, colegio_profesional, numero_colegiado)
VALUES
  ('DEMO-SPEC-2026', 'Ing. Demo (Prueba)', 'ingeniero_estructural', 'CIV', '000000'),
  ('SPEC-ADMIN-001', 'Administrador', 'ingeniero_civil', 'CIV', '000001')
ON CONFLICT (access_code) DO NOTHING;
