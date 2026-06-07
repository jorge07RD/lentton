// GET /api/state — todo lo liviano para la sincronizacion inicial (sin contenido).
import type { RequestHandler } from './$types';
import { autorizar, json } from '$lib/server/sync';

export const GET: RequestHandler = async (event) => {
	const DB = autorizar(event);
	const books = await DB.prepare(
		'SELECT id,title,author,addedAt,updatedAt,coverType FROM books'
	).all();
	const positions = await DB.prepare(
		'SELECT bookId,chapterIndex,sentenceIndex,updatedAt FROM positions'
	).all();
	const settings = await DB.prepare('SELECT json,updatedAt FROM settings WHERE id=?')
		.bind('app')
		.first<{ json: string; updatedAt: number }>();
	return json({
		books: books.results ?? [],
		positions: positions.results ?? [],
		settings: settings ? { json: JSON.parse(settings.json), updatedAt: settings.updatedAt } : null
	});
};
