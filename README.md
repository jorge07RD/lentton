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
