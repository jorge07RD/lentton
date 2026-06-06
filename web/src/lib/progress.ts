// Utilidades de progreso de lectura, compartidas por biblioteca y lector.
import type { Book, ReadingPosition } from '$lib/types';

/** Total de oraciones del libro. */
export function totalOraciones(book: Book): number {
	return book.chapters.reduce((n, c) => n + c.sentences.length, 0);
}

/** Índice lineal (0-based) de una posición dentro de todo el libro. */
export function indiceLineal(book: Book, chapterIndex: number, sentenceIndex: number): number {
	let n = 0;
	for (let i = 0; i < chapterIndex && i < book.chapters.length; i++) {
		n += book.chapters[i].sentences.length;
	}
	return n + sentenceIndex;
}

/** Fracción de avance 0..1 de una posición (cuántas oraciones quedan ya leídas). */
export function fraccionProgreso(book: Book, pos: ReadingPosition | undefined): number {
	const total = totalOraciones(book);
	if (total === 0) return 0;
	if (!pos) return 0;
	return Math.min(1, indiceLineal(book, pos.chapterIndex, pos.sentenceIndex) / total);
}
