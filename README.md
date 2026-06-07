# Lentton — Lector con foco y narración por IA

App de **lectura con foco**: subís un EPUB, se resalta la oración actual (atenuando las vecinas) y
se narra con voz (TTS), avanzando automáticamente al terminar cada oración.

## Estructura

```
lentton/
├── web/      # SvelteKit 2 + Svelte 5 + TS + PWA (cliente)
└── server/   # FastAPI + kokoro-onnx (TTS), venv uv con Python 3.12
```

## Desarrollo

### Servidor TTS

```bash
cd server
uv run python download_models.py     # 1ª vez: descarga el modelo kokoro (~325MB)
uv run uvicorn app.main:app --reload --port 8000
```

Voces en español disponibles: `ef_dora` (f), `em_alex` (m), `em_santa` (m).

### Front

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

La URL del servidor se configura con `PUBLIC_API_URL` (ver `web/.env.example`).

## Despliegue gratis (usar desde el celular)

La app es una **PWA estática**: se sube gratis a Cloudflare Pages y se instala en el
celular. Sin servidor, narra con la **voz del navegador** (Web Speech); si Kokoro no
responde, la app **cae sola** a esa voz. La voz Kokoro de calidad solo está disponible
cuando tengas el servidor encendido (local o donde lo hostees).

### Opción A — Cloudflare Pages conectando el repo (recomendada)

1. Subí el repo a GitHub.
2. En Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, elegí el repo.
3. Configurá el build:
   - **Root directory:** `web`
   - **Build command:** `npm run build`
   - **Build output directory:** `build`
   - (Opcional) Variable `PUBLIC_API_URL` con la URL de tu servidor TTS si tenés uno.
4. Deploy. Te queda una URL `https://<algo>.pages.dev`.

### Opción B — Subir la carpeta ya construida (sin Git)

```bash
cd web
npm run build                 # genera web/build
npx wrangler pages deploy build --project-name lentton
```

(O en Netlify: arrastrá la carpeta `web/build` a app.netlify.com/drop.)

### Instalar en el celular

Abrí la URL en el navegador del celu → menú → **“Agregar a pantalla de inicio”**.
Queda como una app; los libros se guardan en el dispositivo y funciona sin conexión.

> El `web/static/_redirects` ya deja resueltas las rutas internas (SPA) al recargar.

## Memoria compartida entre dispositivos (opcional)

Por defecto los libros viven en el dispositivo (IndexedDB). Para tener **memoria
compartida** (subir un libro en la compu y seguir leyéndolo en el celu, con la
posición y las preferencias sincronizadas) hay una API serverless con **Cloudflare
D1** (SQLite): guarda metadatos, contenido de los libros, posiciones y ajustes (sin
R2, así no hace falta tarjeta). IndexedDB sigue siendo la caché local/offline; la
sincronización es last-write-wins. Es para uso **personal**: se protege con una
clave secreta (`SYNC_KEY`).

### Crear la base y desplegar

```bash
cd web
npx wrangler d1 create lentton          # copiá el database_id -> wrangler.toml
npx wrangler d1 execute lentton --remote --file=./schema.sql   # crea las tablas
npx wrangler pages project create lentton --production-branch main
printf "TU_CLAVE" | npx wrangler pages secret put SYNC_KEY --project-name lentton
npm run build && npx wrangler pages deploy build --project-name lentton --branch main
```

> Si conectás el repo por Git en vez de `wrangler deploy`, configurá el binding
> **D1 (DB)** y el secreto **SYNC_KEY** en el dashboard del proyecto Pages →
> *Settings → Functions/Variables*.

### Activar en cada dispositivo

Abrí la app → icono de **nube** ☁ → ingresá la misma `SYNC_KEY`. Listo: los libros,
la posición de lectura y las preferencias se comparten.

### Probar la sincronización en local

```bash
cd web
npm run build
npm run cf:schema          # aplica el esquema a la D1 local
npm run cf:dev             # app + /api con D1/R2 locales en http://localhost:8788
# (clave local de prueba en web/.dev.vars: SYNC_KEY=clave-de-prueba-local)
```

## Estado

- [x] **Fase 0** — Scaffold (web + server + git, `/health`, CORS, PWA base)
- [x] **Fase 1** — Ingesta de EPUB (`npm run test:epub`)
- [x] **Fase 2** — Persistencia y biblioteca
- [x] **Fase 3** — UI de foco (lectura sin audio) (`npm run test:e2e` con server arriba)
- [x] **Fase 4** — Backend TTS con kokoro-onnx (`/tts` WAV, `/voices`, caché)
- [x] **Fase 5** — Integración de narración (Kokoro/Web Speech + prefetch) (`npm run test:narracion`)
- [x] **Fase 6** — Pulido: velocidad/voz persistidas, PWA offline, ayuda (`?`)

## Pruebas

```bash
cd web
npm run test:epub        # parser de EPUB (tsx + linkedom)
npm run test:e2e         # biblioteca + lector (requiere dev en :5173)
npm run test:pulido      # persistencia de prefs + ayuda (dev :5173)
npm run test:narracion   # auto-avance con Kokoro (dev :5173 + TTS :8000)
npm run test:offline     # PWA offline (requiere preview en :4173)
```
