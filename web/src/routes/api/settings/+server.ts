// PUT /api/settings — guarda las preferencias compartidas (tema, voz, velocidad, etc.).
import type { RequestHandler } from './$types';
import { autorizar, json } from '$lib/server/sync';

export const PUT: RequestHandler = async (event) => {
	const DB = autorizar(event);
	const s = (await event.request.json()) as { json: unknown; updatedAt?: number };
	const now = s.updatedAt ?? Date.now();
	await DB.prepare(
		`INSERT INTO settings (id,json,updatedAt) VALUES ('app',?,?)
		 ON CONFLICT(id) DO UPDATE SET json=excluded.json,updatedAt=excluded.updatedAt`
	)
		.bind(JSON.stringify(s.json), now)
		.run();
	return json({ ok: true, updatedAt: now });
};
