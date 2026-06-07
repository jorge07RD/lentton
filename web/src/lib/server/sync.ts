// Utilidades compartidas de la API de sincronizacion (endpoints /api/*).
// Memoria personal en D1 (SQLite), protegida por una clave secreta (SYNC_KEY).
import { json, error, type RequestEvent } from '@sveltejs/kit';

export { json };

/**
 * Valida el entorno y la clave. Devuelve la D1 lista para usar.
 * Lanza (via `error`) 503 si no hay sync configurado y 401 si la clave es invalida.
 */
export function autorizar(event: RequestEvent): D1Database {
	const env = event.platform?.env;
	if (!env?.DB) throw error(503, 'sync no configurado en el servidor');
	if (!env.SYNC_KEY) throw error(503, 'sync no configurado en el servidor');
	if (event.request.headers.get('x-lentton-key') !== env.SYNC_KEY)
		throw error(401, 'clave invalida');
	return env.DB;
}
