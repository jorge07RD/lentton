// Persistencia con IndexedDB (via idb). Los EPUB pesan: NO usar localStorage.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Book, ReadingPosition } from '$lib/types';

// Preferencias del usuario.
export interface Settings {
	theme: 'auto' | 'light' | 'dark';
	provider: 'kokoro' | 'webspeech';
	voice: string;
	speed: number; // 0.5 – 2.0
	mode: 'foco' | 'completo'; // vista de lectura: foco u oración / página completa
}

export const SETTINGS_POR_DEFECTO: Settings = {
	theme: 'auto',
	provider: 'kokoro',
	voice: 'ef_dora',
	speed: 1.0,
	mode: 'foco'
};

interface LenttonDB extends DBSchema {
	books: { key: string; value: Book };
	positions: { key: string; value: ReadingPosition };
	settings: { key: string; value: Settings };
}

const NOMBRE_DB = 'lentton';
const VERSION = 1;
const CLAVE_SETTINGS = 'app'; // única fila de settings

let dbPromise: Promise<IDBPDatabase<LenttonDB>> | null = null;

function getDB(): Promise<IDBPDatabase<LenttonDB>> {
	if (!dbPromise) {
		dbPromise = openDB<LenttonDB>(NOMBRE_DB, VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
				if (!db.objectStoreNames.contains('positions'))
					db.createObjectStore('positions', { keyPath: 'bookId' });
				if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
			}
		});
	}
	return dbPromise;
}

// --- Libros ---

export async function saveBook(book: Book): Promise<void> {
	const db = await getDB();
	await db.put('books', book);
}

export async function getBook(id: string): Promise<Book | undefined> {
	const db = await getDB();
	return db.get('books', id);
}

export async function getAllBooks(): Promise<Book[]> {
	const db = await getDB();
	const libros = await db.getAll('books');
	return libros.sort((a, b) => b.addedAt - a.addedAt);
}

export async function deleteBook(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('books', id);
	await db.delete('positions', id);
}

// --- Posición de lectura ---

export async function savePosition(pos: ReadingPosition): Promise<void> {
	const db = await getDB();
	await db.put('positions', pos);
}

export async function getPosition(bookId: string): Promise<ReadingPosition | undefined> {
	const db = await getDB();
	return db.get('positions', bookId);
}

// --- Preferencias ---

export async function getSettings(): Promise<Settings> {
	const db = await getDB();
	const guardado = await db.get('settings', CLAVE_SETTINGS);
	return { ...SETTINGS_POR_DEFECTO, ...guardado };
}

export async function saveSettings(settings: Settings): Promise<void> {
	const db = await getDB();
	await db.put('settings', settings, CLAVE_SETTINGS);
}
