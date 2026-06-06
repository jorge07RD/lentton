"""Servidor TTS de Lentton (FastAPI + kokoro-onnx).

Expone:
  GET  /health  -> estado del server y si el modelo está cargado.
  GET  /voices  -> voces disponibles (con las españolas marcadas).
  POST /tts     -> sintetiza una oración y devuelve audio WAV (con caché por hash).
"""

import hashlib
import io
from contextlib import asynccontextmanager
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

# REVISAR: en producción restringir los orígenes; en dev permitimos el server de Vite.
ORIGENES_PERMITIDOS = ["http://localhost:5173", "http://127.0.0.1:5173"]

DIR_BASE = Path(__file__).resolve().parent.parent
RUTA_MODELO = DIR_BASE / "models" / "kokoro.onnx"
RUTA_VOCES = DIR_BASE / "models" / "voices.bin"
DIR_CACHE = DIR_BASE / "cache"

# Idioma de síntesis. Las voces españolas de Kokoro usan español (prefijo "e").
IDIOMA = "es"

# Estado compartido del proceso.
estado: dict = {"kokoro": None, "cache_mem": {}}


def _cargar_kokoro():
    """Carga el modelo kokoro-onnx una sola vez, con espeak-ng vía espeakng-loader."""
    from kokoro_onnx import Kokoro
    from kokoro_onnx.config import EspeakConfig
    import espeakng_loader

    # espeak-ng no está instalado en el sistema: usamos la librería que trae el paquete.
    espeak = EspeakConfig(
        lib_path=espeakng_loader.get_library_path(),
        data_path=espeakng_loader.get_data_path(),
    )
    return Kokoro(str(RUTA_MODELO), str(RUTA_VOCES), espeak_config=espeak)


@asynccontextmanager
async def lifespan(app: FastAPI):
    DIR_CACHE.mkdir(exist_ok=True)
    if RUTA_MODELO.exists() and RUTA_VOCES.exists():
        print("Cargando modelo kokoro-onnx…")
        estado["kokoro"] = _cargar_kokoro()
        print("Modelo cargado.")
    else:
        # REVISAR: faltan los modelos; ejecutar `uv run python download_models.py`.
        print(f"AVISO: no se encontró el modelo en {RUTA_MODELO}. /tts responderá 503.")
    yield


app = FastAPI(title="Lentton TTS", version="0.4.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TtsRequest(BaseModel):
    text: str = Field(min_length=1)
    voice: str = "ef_dora"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": estado["kokoro"] is not None}


@app.get("/voices")
def voices() -> dict:
    """Lista las voces disponibles; marca las españolas (id que empieza por 'e')."""
    kokoro = estado["kokoro"]
    if kokoro is None:
        raise HTTPException(503, "Modelo no cargado")
    ids = sorted(kokoro.get_voices())
    voces = [
        {
            "id": v,
            "es": v.startswith("e"),
            # Convención de Kokoro: 2ª letra f=femenina, m=masculina.
            "gender": "f" if len(v) > 1 and v[1] == "f" else "m",
        }
        for v in ids
    ]
    return {"voices": voces, "default": "ef_dora" if "ef_dora" in ids else ids[0]}


def _hash(req: TtsRequest) -> str:
    clave = f"{req.text}|{req.voice}|{req.speed}".encode()
    return hashlib.sha256(clave).hexdigest()


@app.post("/tts")
def tts(req: TtsRequest) -> Response:
    kokoro = estado["kokoro"]
    if kokoro is None:
        raise HTTPException(503, "Modelo no cargado. Ejecutá download_models.py")

    h = _hash(req)

    # 1) Caché en memoria.
    if h in estado["cache_mem"]:
        return Response(estado["cache_mem"][h], media_type="audio/wav")

    # 2) Caché en disco.
    ruta = DIR_CACHE / f"{h}.wav"
    if ruta.exists():
        datos = ruta.read_bytes()
        estado["cache_mem"][h] = datos
        return Response(datos, media_type="audio/wav")

    # 3) Generar.
    try:
        samples, sr = kokoro.create(req.text, voice=req.voice, speed=req.speed, lang=IDIOMA)
    except Exception as e:  # noqa: BLE001 - devolvemos el error al cliente
        raise HTTPException(500, f"Error de síntesis: {e}") from e

    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="WAV", subtype="PCM_16")
    datos = buf.getvalue()

    ruta.write_bytes(datos)
    estado["cache_mem"][h] = datos
    return Response(datos, media_type="audio/wav")
