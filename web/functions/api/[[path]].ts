// API de sincronización de Lentton (Cloudflare Pages Functions).
// Memoria compartida personal en D1 (SQLite): metadatos, contenido de libros
// (JSON), portadas (base64), posiciones y ajustes. Protegida por una clave.

interface Env {
	DB: D1Database;
	SYNC_KEY?: string;
}

type Ctx = { request: Request; env: Env };

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' }
	});

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
				const row = await env.DB.prepare(
					'SELECT content,coverType,coverB64 FROM books WHERE id=?'
				)
					.bind(id)
					.first<{ content: string; coverType: string | null; coverB64: string | null }>();
				if (!row) return json({ error: 'no existe' }, 404);
				const book = JSON.parse(row.content);
				const cover = row.coverType && row.coverB64 ? { type: row.coverType, base64: row.coverB64 } : null;
				return json({ ...book, cover });
			}
			if (m === 'PUT') {
				const body = (await request.json()) as {
					book: { id: string; title: string; author?: string; addedAt: number; chapters: unknown };
					cover?: { type: string; base64: string } | null;
				};
				const b = body.book;
				const now = Date.now();
				await env.DB.prepare(
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
			}
			if (m === 'DELETE') {
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
