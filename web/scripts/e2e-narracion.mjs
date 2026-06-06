// E2E de narración (Fase 5): clic en play -> Kokoro reproduce y AVANZA solo.
// Requiere: app servida en BASE_URL y server TTS en marcha (API_URL del front -> :8000).
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEpubBuffer } from './fixture-epub.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const EXEC = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const epubPath = join(tmpdir(), 'prueba.epub');
await writeFile(epubPath, await crearEpubBuffer());

const browser = await chromium.launch({
	executablePath: EXEC,
	headless: true,
	args: ['--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const fallos = [];
const errores = [];
const BENIGNOS = /favicon\.ico|manifest\.webmanifest/;
page.on('console', (m) => {
	if (m.type() === 'error' && !BENIGNOS.test(m.location()?.url ?? '') && !BENIGNOS.test(m.text()))
		errores.push(m.text());
});
const check = (c, m) => !c && fallos.push(m);

try {
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type=file]', epubPath);
	await page.waitForSelector('.tarjeta');
	await page.click('.tarjeta');
	await page.waitForSelector('.foco .oracion.actual');

	const oracionInicial = await page.textContent('.oracion.actual');

	// Clic en play (gesto de usuario => Kokoro descarga y reproduce).
	await page.click('.play');
	// El icono debe pasar a "pausa".
	await page.waitForFunction(() => document.querySelector('.play')?.textContent?.includes('⏸'), {
		timeout: 5000
	});

	// Esperar a que la oración actual cambie SOLA (auto-avance al terminar el audio).
	await page.waitForFunction(
		(prev) => document.querySelector('.oracion.actual')?.textContent !== prev,
		oracionInicial,
		{ timeout: 30000 }
	);
	const oracionTras = await page.textContent('.oracion.actual');
	check(oracionTras !== oracionInicial, `avanzó solo: "${oracionInicial}" -> "${oracionTras}"`);

	// Pausar y comprobar que el icono vuelve a play.
	await page.click('.play');
	await page.waitForFunction(() => document.querySelector('.play')?.textContent?.includes('▶'), {
		timeout: 5000
	});

	// Cambiar de proveedor en caliente no debe romper.
	await page.selectOption('.proveedor', 'webspeech');
	await page.waitForTimeout(300);
	check((await page.locator('.proveedor').inputValue()) === 'webspeech', 'cambió a webspeech');
} catch (e) {
	fallos.push(`excepción: ${e.message}`);
} finally {
	await browser.close();
}

check(errores.length === 0, `errores de consola: ${errores.join(' | ')}`);
if (fallos.length) {
	console.error('❌ FALLOS:\n - ' + fallos.join('\n - '));
	process.exit(1);
}
console.log('✅ E2E narración OK');
