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
