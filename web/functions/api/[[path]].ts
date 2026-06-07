// API de sincronización de Lentton (Cloudflare Pages Functions).
// Memoria compartida personal: D1 (SQLite) para metadatos/posición/ajustes y
// R2 para el contenido de los libros y las portadas. Protegida por una clave.

interface Env {
	DB: D1Database;
	BOOKS: R2Bucket;
	SYNC_KEY?: string;
}

type Ctx = { request: Request; env: Env };

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' }
	});

function abToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let bin = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(bin);
}
function base64ToAb(b64: string): ArrayBuffer {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes.buffer;
}

export const onRequest = async (context: Ctx): Promise<Response> => {
	const { request, env } = context;
	const url = new URL(request.url);
	const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

	if (!env.SYNC_KEY) return json({ error: 'sync no configurado en el servidor' }, 503);
	if (request.headers.get('x-lentton-key') !== env.SYNC_KEY)
		return json({ error: 'clave inválida' }, 401);

	const [recurso, id] = parts;
	const m = request.method;

	try {
		// GET /api/state — todo lo liviano para la sincronización inicial.
		if (recurso === 'state' && m === 'GET') {
			const books = await env.DB.prepare(
				'SELECT id,title,author,addedAt,updatedAt,coverType FROM books'
			).all();
			const positions = await env.DB.prepare(
				'SELECT bookId,chapterIndex,sentenceIndex,updatedAt FROM positions'
			).all();
			const settings = await env.DB.prepare('SELECT json,updatedAt FROM settings WHERE id=?')
				.bind('app')
				.first<{ json: string; updatedAt: number }>();
			return json({
				books: books.results ?? [],
				positions: positions.results ?? [],
				settings: settings ? { json: JSON.parse(settings.json), updatedAt: settings.updatedAt } : null
			});
		}

		// /api/book/:id
		if (recurso === 'book' && id) {
			if (m === 'GET') {
				const obj = await env.BOOKS.get(`book/${id}.json`);
				if (!obj) return json({ error: 'no existe' }, 404);
				const book = JSON.parse(await obj.text());
				const fila = await env.DB.prepare('SELECT coverType FROM books WHERE id=?')
					.bind(id)
					.first<{ coverType: string | null }>();
				let cover = null;
				if (fila?.coverType) {
					const c = await env.BOOKS.get(`cover/${id}`);
					if (c) cover = { type: fila.coverType, base64: abToBase64(await c.arrayBuffer()) };
				}
				return json({ ...book, cover });
			}
			if (m === 'PUT') {
				const body = (await request.json()) as {
					book: { id: string; title: string; author?: string; addedAt: number; chapters: unknown };
					cover?: { type: string; base64: string } | null;
				};
				const b = body.book;
				const now = Date.now();
				await env.BOOKS.put(`book/${id}.json`, JSON.stringify(b));
				let coverType: string | null = null;
				if (body.cover) {
					await env.BOOKS.put(`cover/${id}`, base64ToAb(body.cover.base64), {
						httpMetadata: { contentType: body.cover.type }
					});
					coverType = body.cover.type;
				}
				await env.DB.prepare(
					`INSERT INTO books (id,title,author,addedAt,updatedAt,coverType)
					 VALUES (?,?,?,?,?,?)
					 ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,updatedAt=excluded.updatedAt,coverType=excluded.coverType`
				)
					.bind(id, b.title, b.author ?? null, b.addedAt, now, coverType)
					.run();
				return json({ ok: true, updatedAt: now });
			}
			if (m === 'DELETE') {
				await env.BOOKS.delete(`book/${id}.json`);
				await env.BOOKS.delete(`cover/${id}`);
				await env.DB.prepare('DELETE FROM books WHERE id=?').bind(id).run();
				await env.DB.prepare('DELETE FROM positions WHERE bookId=?').bind(id).run();
				return json({ ok: true });
			}
		}

		// PUT /api/position/:id
		if (recurso === 'position' && id && m === 'PUT') {
			const p = (await request.json()) as {
				chapterIndex: number;
				sentenceIndex: number;
				updatedAt?: number;
			};
			const now = p.updatedAt ?? Date.now();
			await env.DB.prepare(
				`INSERT INTO positions (bookId,chapterIndex,sentenceIndex,updatedAt)
				 VALUES (?,?,?,?)
				 ON CONFLICT(bookId) DO UPDATE SET chapterIndex=excluded.chapterIndex,sentenceIndex=excluded.sentenceIndex,updatedAt=excluded.updatedAt`
			)
				.bind(id, p.chapterIndex, p.sentenceIndex, now)
				.run();
			return json({ ok: true, updatedAt: now });
		}

		// PUT /api/settings
		if (recurso === 'settings' && m === 'PUT') {
			const s = (await request.json()) as { json: unknown; updatedAt?: number };
			const now = s.updatedAt ?? Date.now();
			await env.DB.prepare(
				`INSERT INTO settings (id,json,updatedAt) VALUES ('app',?,?)
				 ON CONFLICT(id) DO UPDATE SET json=excluded.json,updatedAt=excluded.updatedAt`
			)
				.bind(JSON.stringify(s.json), now)
				.run();
			return json({ ok: true, updatedAt: now });
		}

		return json({ error: 'ruta no encontrada' }, 404);
	} catch (e) {
		return json({ error: String(e) }, 500);
	}
};
