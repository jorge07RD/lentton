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
uv run uvicorn app.main:app --reload --port 8000
```

### Front

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

La URL del servidor se configura con `PUBLIC_API_URL` (ver `web/.env.example`).

## Estado

- [x] **Fase 0** — Scaffold (web + server + git, `/health`, CORS, PWA base)
- [ ] Fase 1 — Ingesta de EPUB
- [ ] Fase 2 — Persistencia y biblioteca
- [ ] Fase 3 — UI de foco (lectura sin audio)
- [ ] Fase 4 — Backend TTS con kokoro-onnx
- [ ] Fase 5 — Integración de narración
- [ ] Fase 6 — Pulido (PWA offline, velocidad, voz, ayuda)
