// PUT /api/position/:id — guarda la posicion de lectura (last-write-wins por updatedAt).
import type { RequestHandler } from './$types';
import { autorizar, json } from '$lib/server/sync';

export const PUT: RequestHandler = async (event) => {
	const DB = autorizar(event);
	const id = event.params.id!;
	const p = (await event.request.json()) as {
		chapterIndex: number;
		sentenceIndex: number;
		updatedAt?: number;
	};
	const now = p.updatedAt ?? Date.now();
	await DB.prepare(
		`INSERT INTO positions (bookId,chapterIndex,sentenceIndex,updatedAt)
		 VALUES (?,?,?,?)
		 ON CONFLICT(bookId) DO UPDATE SET chapterIndex=excluded.chapterIndex,sentenceIndex=excluded.sentenceIndex,updatedAt=excluded.updatedAt`
	)
		.bind(id, p.chapterIndex, p.sentenceIndex, now)
		.run();
	return json({ ok: true, updatedAt: now });
};
