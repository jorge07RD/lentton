// Modelos de datos de la app. Comentados en español por convención del proyecto.

export interface Book {
	id: string; // hash SHA-256 del archivo EPUB
	title: string;
	author?: string;
	cover?: Blob;
	chapters: Chapter[];
	addedAt: number;
}

export interface Chapter {
	title: string;
	sentences: string[]; // ya segmentadas con Intl.Segmenter
}

export interface ReadingPosition {
	bookId: string;
	chapterIndex: number;
	sentenceIndex: number;
	updatedAt: number;
}
