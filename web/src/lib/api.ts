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

export interface Voice {
	id: string;
	es: boolean;
	gender: 'f' | 'm';
}

// Voces españolas conocidas, usadas si el servidor no responde (modo offline).
export const VOCES_FALLBACK: Voice[] = [
	{ id: 'ef_dora', es: true, gender: 'f' },
	{ id: 'em_alex', es: true, gender: 'm' },
	{ id: 'em_santa', es: true, gender: 'm' }
];

/** Pide las voces al servidor; si falla, devuelve solo las españolas conocidas. */
export async function getVoices(): Promise<Voice[]> {
	try {
		const res = await fetch(`${API_URL}/voices`);
		if (!res.ok) throw new Error(`voices ${res.status}`);
		const data = await res.json();
		return (data.voices as Voice[]).filter((v) => v.es);
	} catch {
		return VOCES_FALLBACK;
	}
}
