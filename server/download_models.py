"""Descarga los archivos de modelo de kokoro-onnx a server/models/.

Uso:
    uv run python download_models.py            # modelo completo (mejor calidad)
    uv run python download_models.py --int8     # modelo cuantizado (~92MB, más rápido)
"""

import sys
import urllib.request
from pathlib import Path

BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
MODELOS = Path(__file__).parent / "models"


def descargar(url: str, destino: Path) -> None:
    if destino.exists() and destino.stat().st_size > 0:
        print(f"✓ Ya existe: {destino.name}")
        return
    print(f"↓ Descargando {destino.name} desde {url}")

    def progreso(bloques: int, tam_bloque: int, total: int) -> None:
        if total > 0:
            pct = min(100, bloques * tam_bloque * 100 // total)
            print(f"\r  {pct}%", end="", flush=True)

    urllib.request.urlretrieve(url, destino, progreso)
    print(f"\r✓ {destino.name} ({destino.stat().st_size // 1_000_000} MB)")


def main() -> None:
    MODELOS.mkdir(exist_ok=True)
    onnx = "kokoro-v1.0.int8.onnx" if "--int8" in sys.argv else "kokoro-v1.0.onnx"
    # Guardamos siempre con el mismo nombre para que el server no dependa de la variante.
    descargar(f"{BASE}/{onnx}", MODELOS / "kokoro.onnx")
    descargar(f"{BASE}/voices-v1.0.bin", MODELOS / "voices.bin")
    print("\nListo. Arrancá el server con: uv run uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
