# 🇻🇪 EstructuraScan — Evaluación Sísmica de Daños Post-Terremoto

Plataforma web ultra-ligera (Single Page Application, SPA) diseñada para que ciudadanos afectados por eventos sísmicos en Venezuela registren daños en inmuebles mediante fotos y geolocalización. El sistema ofrece un diagnóstico preliminar del riesgo utilizando un motor de análisis automatizado y centraliza los reportes en un mapa interactivo para habilitar un flujo de trabajo donde especialistas e ingenieros civiles puedan validar los diagnósticos.

---

## 🚀 Características Principales

*   **Interfaz SPA Responsiva:** Carga ultra-rápida en dispositivos móviles antiguos con un diseño oscuro premium.
*   **Compresión de Imágenes Local:** Utiliza Canvas API para comprimir fotografías de hasta 4MB a ~300KB antes de subirlas, optimizando el uso de datos móviles.
*   **Geolocalización Asistida:** Detección automática por GPS del navegador y geocodificación inversa con Nominatim (OpenStreetMap) para autocompletar la dirección de los inmuebles.
*   **Diagnóstico Automatizado:** Integra un motor de análisis basado en directrices de la escala ATC-20 (inspección de seguridad post-sismo).
*   **Mapa de Calor y Daños:** Visualización geográfica con Leaflet.js de los reportes, con estadísticas acumuladas calculadas en caliente.
*   **Panel para Especialistas:** Inicio de sesión mediante código de acceso exclusivo (`DEMO-SPEC-2026` para pruebas), donde ingenieros pueden validar o corregir los niveles de riesgo del reporte y asentar una firma profesional técnica.
*   **Botón de Emergencia (SOS):** Llamada directa rápida al 911 y Protección Civil (171) con un checklist interactivo de seguridad.

---

## 🛠️ Stack Tecnológico

1.  **Frontend:**
    *   Vanilla HTML5, CSS3 (Variables, Grids, Transitions, Keyframes) y JavaScript (ES6+).
    *   [Leaflet.js](https://leafletjs.com/) (Visualización de Mapas).
    *   [Supabase JS Client SDK](https://supabase.com/docs/reference/javascript/introduction) (Lectura en tiempo real).
2.  **Backend (Serverless):**
    *   [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions) (Node.js 18+).
3.  **Base de Datos y Almacenamiento:**
    *   [Supabase PostgreSQL](https://supabase.com/) (Tablas relacionales indexadas con RLS activado).
    *   [Supabase Storage](https://supabase.com/docs/guides/storage) (Bucket público `damage-photos`).
4.  **Motor de Análisis:**
    *   API externa para análisis estructural automatizado.

---

## 📁 Estructura del Proyecto

```
terremoto_vzla_project/
├── index.html                  # Página principal SPA
├── css/
│   └── styles.css              # Design system completo
├── js/
│   ├── app.js                  # Router SPA + inicialización + orquestador global
│   ├── camera.js               # Captura de fotos + compresión local Canvas
│   ├── analysis.js             # Envío de reportes + renderizado de diagnóstico preliminar
│   ├── location.js             # Geolocalización GPS + reverse geocoding
│   ├── map.js                  # Mapa Leaflet + marcadores + estadísticas
│   ├── specialist.js           # Login, tabs y modal de revisión especialista
│   └── supabase-client.js      # Cliente de Supabase para el navegador
├── api/                        # Vercel Serverless Functions
│   ├── config.js               # Endpoint seguro para servir variables públicas
│   ├── analyze.js              # Proxy de análisis + subida a Storage + inserción DB
│   ├── reports.js              # Consulta y filtrado de reportes
│   └── specialist.js           # Acciones del panel de especialistas (Login/Review)
├── supabase/                   # Archivos de configuración de Supabase
│   ├── migrations/
│   │   └── 20260627000000_init_schema.sql # Esquema SQL inicial
│   └── config.toml
├── vercel.json                 # Configuración de hosting de Vercel
├── package.json                # Dependencias del servidor Node.js
├── .gitignore                  # Archivos ignorados por Git
└── .env                        # Variables de entorno locales (NO subir a Git)
```

---

## ⚙️ Configuración e Instalación

### 1. Requisitos Previos

*   **Node.js** (versión 18 o superior).
*   **Supabase CLI** (instalado localmente).
*   Una cuenta y proyecto activo en **Supabase**.
*   Una API Key para el servicio del motor de análisis.

### 2. Clonar y Configurar el Proyecto Localmente

1.  Instala las dependencias del servidor:
    ```bash
    npm install
    ```
2.  Crea tu archivo `.env` copiando el ejemplo:
    ```bash
    cp .env.example .env
    ```
3.  Edita el archivo `.env` e ingresa tus llaves secretas:
    ```env
    # API Key del motor de análisis
    GEMINI_API_KEY=AIzaSy...tu_key_aqui

    # Supabase (Configuración del servidor)
    SUPABASE_URL=https://tu-proyecto.supabase.co
    SUPABASE_ANON_KEY=eyJhbGci...tu_anon_public_key
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...tu_service_role_secret_key
    ```

### 3. Vincular y Desplegar Base de Datos en Supabase

El esquema de base de datos e RLS ya está configurado en un archivo de migración local.

1.  Inicia sesión en Supabase CLI si no lo has hecho:
    ```bash
    supabase login
    ```
2.  Vincula el proyecto utilizando tu `Project Ref` (ejemplo: `xlylodcinromqqjjupph`):
    ```bash
    supabase link --project-ref xlylodcinromqqjjupph
    ```
3.  Sube y aplica la migración SQL al servidor de base de datos de Supabase:
    ```bash
    supabase db push
    ```

Esto creará automáticamente las tablas `reports`, `specialists`, `specialist_reviews`, habilitará el bucket de almacenamiento público `damage-photos` y sus políticas de acceso, e insertará los especialistas de demostración:
*   Código de especialista demo: `DEMO-SPEC-2026`

---

## 💻 Ejecución Local

Para ejecutar las serverless functions y servir los archivos estáticos simultáneamente, utiliza la herramienta de Vercel localmente:

1.  Instala Vercel CLI de forma global (si no lo tienes):
    ```bash
    npm install -g vercel
    ```
2.  Ejecuta el servidor de desarrollo local:
    ```bash
    vercel dev
    ```

El proyecto estará disponible por defecto en `http://localhost:3000`.

---

## ☁️ Despliegue en Producción (Vercel)

1.  Asegúrate de empujar tus cambios a un repositorio de GitHub.
2.  Conecta tu repositorio a un nuevo proyecto en el dashboard de **Vercel**.
3.  En la configuración del proyecto, asegúrate de marcar:
    *   **Framework Preset:** `Other` (o dejar en blanco ya que lee `vercel.json` automáticamente).
4.  Agrega las **Variables de Entorno** (Environment Variables) idénticas a las de tu archivo `.env`:
    *   `GEMINI_API_KEY` (Llave del servicio de análisis)
    *   `SUPABASE_URL`
    *   `SUPABASE_ANON_KEY`
    *   `SUPABASE_SERVICE_ROLE_KEY`
5.  Haz click en **Deploy**. Vercel publicará tu aplicación con CDN global.

---

## 🔒 Políticas de Seguridad (RLS)

La base de datos tiene habilitado **Row Level Security (RLS)** para proteger los datos frente a accesos maliciosos desde la web:
*   `reports`: Lectura pública (`SELECT`) e inserción pública (`INSERT`) permitida. Actualizaciones (`UPDATE`) solo disponibles a través de funciones del servidor usando la llave `service_role`.
*   `specialist_reviews`: Lectura pública permitida. Inserciones solo autorizadas para especialistas autenticados mediante las credenciales del servidor.
*   `specialists`: Solo accesible a nivel del servidor (bloqueado completamente para peticiones directas desde navegadores).
