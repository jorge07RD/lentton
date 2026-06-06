// Cliente HTTP del servidor TTS (FastAPI + kokoro-onnx).
// La URL base es configurable por entorno; por defecto el server local de la Fase 0.
import { env } from '$env/dynamic/public';

export const API_URL = env.PUBLIC_API_URL ?? 'http://localhost:8000';

export interface HealthResponse {
	status: string;
}

/** Comprueba que el servidor TTS responde. Lanza si la respuesta no es ok. */
export async function getHealth(): Promise<HealthResponse> {
	const res = await fetch(`${API_URL}/health`);
	if (!res.ok) throw new Error(`Servidor respondio ${res.status}`);
	return res.json();
}
