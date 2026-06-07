// Sincronización con la memoria compartida (Cloudflare D1 + R2 vía /api).
// IndexedDB sigue siendo la caché local/offline; esto empuja y trae cambios.
// Estrategia simple last-write-wins por updatedAt. App personal (una clave).
import {
	getAllBooks,
	getBook,
	saveBook,
	getAllPositions,
	savePosition,
	getSettings,
	saveSettings,
	type Settings
} from './db';
import type { Book, ReadingPosition } from './types';

const BASE = '/api';
const LS_KEY = 'lentton.syncKey';

export function getSyncKey(): string {
	if (typeof localStorage === 'undefined') return '';
	return localStorage.getItem(LS_KEY) ?? '';
}
export function setSyncKey(k: string): void {
	if (typeof localStorage === 'undefined') return;
	if (k) localStorage.setItem(LS_KEY, k);
	else localStorage.removeItem(LS_KEY);
}
export function syncHabilitado(): boolean {
	return !!getSyncKey();
}

function headers(): Record<string, string> {
	return { 'content-type': 'application/json', 'x-lentton-key': getSyncKey() };
}

// --- base64 <-> blob ---
async function blobABase64(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let bin = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(bin);
}
function base64ABlob(b64: string, type: string): Blob {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type });
}

// --- API ---
interface EstadoRemoto {
	books: { id: string; updatedAt: number }[];
	positions: (ReadingPosition & { updatedAt: number })[];
	settings: { json: Settings; updatedAt: number } | null;
}

async function pull(): Promise<EstadoRemoto> {
	const r = await fetch(`${BASE}/state`, { headers: headers() });
	if (!r.ok) throw new Error(`state ${r.status}`);
	return r.json();
}

export async function pushBook(book: Book): Promise<void> {
	const { cover, ...sinCover } = book;
	const body = {
		book: sinCover,
		cover: cover ? { type: cover.type || 'image/jpeg', base64: await blobABase64(cover) } : null
	};
	await fetch(`${BASE}/book/${book.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
}

export async function pushPosition(p: ReadingPosition): Promise<void> {
	if (!syncHabilitado()) return;
	await fetch(`${BASE}/position/${p.bookId}`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify({
			chapterIndex: p.chapterIndex,
			sentenceIndex: p.sentenceIndex,
			updatedAt: p.updatedAt
		})
	}).catch(() => {});
}

export async function pushSettings(s: Settings): Promise<void> {
	if (!syncHabilitado()) return;
	await fetch(`${BASE}/settings`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify({ json: s, updatedAt: s.updatedAt ?? Date.now() })
	}).catch(() => {});
}

export async function deleteRemoto(id: string): Promise<void> {
	if (!syncHabilitado()) return;
	await fetch(`${BASE}/book/${id}`, { method: 'DELETE', headers: headers() }).catch(() => {});
}

async function descargarLibro(id: string): Promise<Book | null> {
	const r = await fetch(`${BASE}/book/${id}`, { headers: headers() });
	if (!r.ok) return null;
	const data = await r.json();
	const { cover, ...rest } = data;
	const book = rest as Book;
	if (cover?.base64) book.cover = base64ABlob(cover.base64, cover.type);
	return book;
}

/** Reconciliación completa: trae lo remoto y empuja lo local. */
export async function sincronizar(): Promise<{ cambios: boolean }> {
	if (!syncHabilitado()) return { cambios: false };
	const remoto = await pull(); // lanza si falla (offline / sin api)
	let cambios = false;

	// --- Libros ---
	const locales = await getAllBooks();
	const idsLocales = new Set(locales.map((b) => b.id));
	const idsRemotos = new Set(remoto.books.map((b) => b.id));
	// Remotos que no tengo: descargar.
	for (const rb of remoto.books) {
		if (!idsLocales.has(rb.id)) {
			const book = await descargarLibro(rb.id);
			if (book) {
				await saveBook(book);
				cambios = true;
			}
		}
	}
	// Locales que no están en remoto: subir.
	for (const lb of locales) {
		if (!idsRemotos.has(lb.id)) {
			const full = await getBook(lb.id);
			if (full) await pushBook(full);
		}
	}

	// --- Posiciones (last-write-wins) ---
	const posLocales = new Map((await getAllPositions()).map((p) => [p.bookId, p]));
	const posRemotas = new Map(remoto.positions.map((p) => [p.bookId, p]));
	const bookIds = new Set([...posLocales.keys(), ...posRemotas.keys()]);
	for (const bid of bookIds) {
		const l = posLocales.get(bid);
		const r = posRemotas.get(bid);
		if (r && (!l || r.updatedAt > l.updatedAt)) {
			await savePosition(r);
			cambios = true;
		} else if (l && (!r || l.updatedAt > r.updatedAt)) {
			await pushPosition(l);
		}
	}

	// --- Ajustes (last-write-wins) ---
	const sLocal = await getSettings();
	const sRemoto = remoto.settings;
	if (sRemoto && sRemoto.updatedAt > (sLocal.updatedAt ?? 0)) {
		await saveSettings({ ...sLocal, ...sRemoto.json, updatedAt: sRemoto.updatedAt }, true);
		cambios = true;
	} else if ((sLocal.updatedAt ?? 0) > (sRemoto?.updatedAt ?? 0)) {
		await pushSettings(sLocal);
	}

	return { cambios };
}
