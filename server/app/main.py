"""Servidor TTS de Lentton (FastAPI).

Fase 0: solo expone /health y configura CORS para el front de Vite.
Las rutas /tts y /voices con kokoro-onnx se agregan en la Fase 4.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# REVISAR: en produccion restringir los origenes; en dev permitimos el server de Vite.
ORIGENES_PERMITIDOS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app = FastAPI(title="Lentton TTS", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Comprobacion de vida usada por el front para verificar conectividad."""
    return {"status": "ok"}
