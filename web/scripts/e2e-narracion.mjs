// E2E de narración (diseño nuevo): play central -> Kokoro reproduce y AVANZA solo.
// Requiere app en BASE_URL y server TTS en marcha (:8000).
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
const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
const fallos = [];
const errores = [];
const BENIGNOS = /favicon\.ico|manifest\.webmanifest|fonts\.(googleapis|gstatic)/;
page.on('console', (m) => {
	if (m.type() === 'error' && !BENIGNOS.test(m.location()?.url ?? '') && !BENIGNOS.test(m.text()))
		errores.push(m.text());
});
const check = (c, m) => !c && fallos.push(m);

try {
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type=file]', epubPath);
	await page.waitForSelector('.book');
	await page.click('.book');
	await page.waitForSelector('.reader .sentence.active');

	const o0 = await page.textContent('.sentence.active');

	// Play central (gesto de usuario => Kokoro descarga y reproduce).
	await page.click('.center-play');
	await page.waitForSelector('.center-play.playing', { timeout: 5000 });

	// Auto-avance: la oración activa cambia sola al terminar el audio.
	await page.waitForFunction(
		(prev) => document.querySelector('.sentence.active')?.textContent !== prev,
		o0,
		{ timeout: 30000 }
	);
	const o1 = await page.textContent('.sentence.active');
	check(o1 !== o0, `avanzó solo: "${o0?.trim()}" -> "${o1?.trim()}"`);

	// Pausar.
	await page.click('.center-play');
	await page.waitForFunction(
		() => !document.querySelector('.center-play')?.classList.contains('playing'),
		null,
		{ timeout: 5000 }
	);

	// Cambiar de proveedor en caliente desde el sheet de ajustes.
	await page.click('button[title="Ajustes de voz"]');
	await page.waitForSelector('.sheet.in');
	await page.click('[data-voz="webspeech"]');
	await page.waitForTimeout(300);
	check(
		await page.locator('[data-voz="webspeech"]').evaluate((el) => el.classList.contains('on')),
		'cambió a la voz del navegador'
	);
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
