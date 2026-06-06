// E2E Fase 6: la app y un libro guardado abren SIN conexión (PWA). Contra preview (build).
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEpubBuffer } from './fixture-epub.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const EXEC = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const epubPath = join(tmpdir(), 'prueba.epub');
await writeFile(epubPath, await crearEpubBuffer());

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await context.newPage();
const fallos = [];
const check = (c, m) => !c && fallos.push(m);

try {
	// 1) Online: cargar app, registrar SW y guardar un libro.
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type=file]', epubPath);
	await page.waitForSelector('.book');
	const url = page.url();

	// Esperar a que el SW tome el control (con tope, para no colgarse).
	await page
		.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 })
		.catch(() => fallos.push('el SW no tomó control en 15s'));

	// Recargar una vez ONLINE ya con el SW al mando: así la navegación pasa por el
	// SW y queda en la caché de runtime (PWA: el offline funciona desde la 2ª visita).
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForSelector('.book');
	await page.waitForTimeout(500);

	// 2) Offline: recargar la biblioteca (servida desde la caché de navegación).
	await context.setOffline(true);
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
	await page.waitForSelector('.book', { timeout: 8000 });
	check((await page.locator('.book').count()) > 0, 'biblioteca carga offline con el libro');

	// 3) Offline: abrir el lector (ruta dinámica vía navigateFallback + IndexedDB).
	await page.click('.book');
	await page.waitForSelector('.reader .sentence.active', { timeout: 8000 });
	const oracion = await page.textContent('.sentence.active');
	check(!!oracion, `lector abre offline (oración: ${oracion})`);
} catch (e) {
	fallos.push(`excepción: ${e.message}`);
} finally {
	await browser.close();
}

if (fallos.length) {
	console.error('❌ FALLOS:\n - ' + fallos.join('\n - '));
	process.exit(1);
}
console.log('✅ E2E offline OK');
