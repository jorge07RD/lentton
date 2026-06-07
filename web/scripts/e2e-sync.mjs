// E2E de memoria compartida: subo un libro en el "dispositivo A" y aparece en el "B".
// Requiere `wrangler pages dev` en BASE_URL (sirve la app + /api con D1/R2 locales).
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEpubBuffer } from './fixture-epub.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8788';
const EXEC = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const KEY = process.env.SYNC_KEY ?? 'clave-de-prueba-local';
const epubPath = join(tmpdir(), 'prueba.epub');
await writeFile(epubPath, await crearEpubBuffer());

const fallos = [];
const check = (c, m) => !c && fallos.push(m);
const setKey = `localStorage.setItem('lentton.syncKey', ${JSON.stringify(KEY)})`;

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
try {
	// --- Dispositivo A: subir libro (se empuja al servidor) ---
	const ctxA = await browser.newContext();
	await ctxA.addInitScript(setKey);
	const a = await ctxA.newPage();
	await a.goto(BASE, { waitUntil: 'domcontentloaded' });
	await a.setInputFiles('input[type=file]', epubPath);
	await a.waitForSelector('.book');
	await a.waitForFunction(() => !!document.querySelector('.book-title'));

	// Esperar a que el servidor tenga el libro (push es en segundo plano).
	let enServidor = false;
	for (let i = 0; i < 30; i++) {
		const r = await fetch(`${BASE}/api/state`, { headers: { 'x-lentton-key': KEY } });
		const s = await r.json();
		if (s.books.some((b) => b.title === 'El libro de prueba')) {
			enServidor = true;
			break;
		}
		await new Promise((res) => setTimeout(res, 500));
	}
	check(enServidor, 'el libro llegó al servidor tras subirlo en A');

	// --- Dispositivo B: contexto nuevo (otra "máquina"), debe traer el libro ---
	const ctxB = await browser.newContext();
	await ctxB.addInitScript(setKey);
	const b = await ctxB.newPage();
	await b.goto(BASE, { waitUntil: 'domcontentloaded' });
	// La biblioteca arranca vacía y la sync trae el libro -> aparece la tarjeta.
	await b.waitForFunction(
		() => [...document.querySelectorAll('.book-title')].some((e) => e.textContent === 'El libro de prueba'),
		null,
		{ timeout: 15000 }
	);
	check(true, 'el libro apareció en B por sincronización');

	// Abrirlo en B y comprobar que se puede leer (contenido vino del servidor).
	await b.click('.book');
	await b.waitForSelector('.reader .sentence.active', { timeout: 8000 });
	const txt = await b.textContent('.sentence.active');
	check(!!txt, `B puede leer el libro sincronizado (${txt?.trim()})`);
} catch (e) {
	fallos.push(`excepción: ${e.message}`);
} finally {
	await browser.close();
}

if (fallos.length) {
	console.error('❌ FALLOS:\n - ' + fallos.join('\n - '));
	process.exit(1);
}
console.log('✅ E2E sync OK');
