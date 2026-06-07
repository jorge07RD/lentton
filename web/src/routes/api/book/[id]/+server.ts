// /api/book/:id — descarga (GET), alta/actualizacion (PUT) y borrado (DELETE) de un libro.
import type { RequestHandler } from './$types';
import { autorizar, json } from '$lib/server/sync';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	const DB = autorizar(event);
	const id = event.params.id!;
	const row = await DB.prepare('SELECT content,coverType,coverB64 FROM books WHERE id=?')
		.bind(id)
		.first<{ content: string; coverType: string | null; coverB64: string | null }>();
	if (!row) throw error(404, 'no existe');
	const book = JSON.parse(row.content);
	const cover = row.coverType && row.coverB64 ? { type: row.coverType, base64: row.coverB64 } : null;
	return json({ ...book, cover });
};

export const PUT: RequestHandler = async (event) => {
	const DB = autorizar(event);
	const id = event.params.id!;
	const body = (await event.request.json()) as {
		book: { id: string; title: string; author?: string; addedAt: number; chapters: unknown };
		cover?: { type: string; base64: string } | null;
	};
	const b = body.book;
	const now = Date.now();
	await DB.prepare(
		`INSERT INTO books (id,title,author,addedAt,updatedAt,content,coverType,coverB64)
		 VALUES (?,?,?,?,?,?,?,?)
		 ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,
		   updatedAt=excluded.updatedAt,content=excluded.content,
		   coverType=excluded.coverType,coverB64=excluded.coverB64`
	)
		.bind(
			id,
			b.title,
			b.author ?? null,
			b.addedAt,
			now,
			JSON.stringify(b),
			body.cover?.type ?? null,
			body.cover?.base64 ?? null
		)
		.run();
	return json({ ok: true, updatedAt: now });
};

export const DELETE: RequestHandler = async (event) => {
	const DB = autorizar(event);
	const id = event.params.id!;
	await DB.prepare('DELETE FROM books WHERE id=?').bind(id).run();
	await DB.prepare('DELETE FROM positions WHERE bookId=?').bind(id).run();
	return json({ ok: true });
};
