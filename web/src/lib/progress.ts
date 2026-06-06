// Utilidades de progreso de lectura, compartidas por biblioteca y lector.
import type { Book, ReadingPosition } from '$lib/types';

// Oración aplanada con su posición y capítulo, para la ventana de foco.
export interface OracionPlana {
	texto: string;
	chapterIndex: number;
	sentenceIndex: number;
	chapterTitle: string;
}

// Párrafo del lector: oraciones con su índice global y si es diálogo (speaker).
export interface Parrafo {
	speaker: boolean;
	sentences: { texto: string; gi: number }[];
}

/** Detecta inicio de diálogo (raya, comilla angular o guion). */
function esDialogo(s: string): boolean {
	return /^\s*[—«"“-]/.test(s);
}

/** Reconstruye los párrafos de un capítulo con índices globales (para el lector). */
export function parrafosDeCapitulo(book: Book, chapterIndex: number): Parrafo[] {
	const cap = book.chapters[chapterIndex];
	if (!cap) return [];
	// Offset global = oraciones de capítulos previos.
	let base = 0;
	for (let i = 0; i < chapterIndex; i++) base += book.chapters[i].sentences.length;

	const n = cap.sentences.length;
	// Si no hay límites de párrafo (libros viejos), todo es un único párrafo.
	const starts = cap.paraStarts && cap.paraStarts.length ? cap.paraStarts : [0];

	const parrafos: Parrafo[] = [];
	for (let p = 0; p < starts.length; p++) {
		const ini = starts[p];
		const fin = p + 1 < starts.length ? starts[p + 1] : n;
		const sentences = [];
		for (let k = ini; k < fin; k++) {
			sentences.push({ texto: cap.sentences[k], gi: base + k });
		}
		if (sentences.length) {
			parrafos.push({ speaker: esDialogo(sentences[0].texto), sentences });
		}
	}
	return parrafos;
}

/** Aplana todas las oraciones del libro en orden lineal de lectura. */
export function aplanar(book: Book): OracionPlana[] {
	const out: OracionPlana[] = [];
	book.chapters.forEach((cap, ci) => {
		cap.sentences.forEach((texto, si) => {
			out.push({ texto, chapterIndex: ci, sentenceIndex: si, chapterTitle: cap.title });
		});
	});
	return out;
}

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
