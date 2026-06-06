// E2E: persistencia de preferencias (velocidad) + overlay de ayuda (diseño nuevo). Contra dev.
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEpubBuffer } from './fixture-epub.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const EXEC = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const epubPath = join(tmpdir(), 'prueba.epub');
await writeFile(epubPath, await crearEpubBuffer());

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
const fallos = [];
const check = (c, m) => !c && fallos.push(m);

async function abrirLector() {
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type=file]', epubPath).catch(() => {});
	await page.waitForSelector('.book');
	await page.click('.book');
	await page.waitForSelector('.reader .sentence.active');
}

try {
	await abrirLector();

	// Abrir ajustes y cambiar la velocidad.
	await page.click('button[title="Ajustes de voz"]');
	await page.waitForSelector('.sheet.in .slider');
	await page.fill('.sheet .slider', '1.5');
	await page.dispatchEvent('.sheet .slider', 'input');
	await page.waitForTimeout(600); // debounce de guardado

	// Recargar y comprobar persistencia.
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForSelector('.reader .sentence.active');
	await page.click('button[title="Ajustes de voz"]');
	await page.waitForSelector('.sheet.in .slider');
	const vel = await page.inputValue('.sheet .slider');
	check(vel === '1.5', `velocidad persistida: ${vel}`);
	await page.click('button[aria-label="Cerrar"]');

	// Overlay de ayuda con '?'.
	await page.keyboard.press('?');
	await page.waitForSelector('.help', { timeout: 3000 });
	check(await page.locator('.help-card').isVisible(), 'ayuda visible con ?');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);
	check((await page.locator('.help').count()) === 0, 'ayuda se cierra con Esc');
} catch (e) {
	fallos.push(`excepción: ${e.message}`);
} finally {
	await browser.close();
}

if (fallos.length) {
	console.error('❌ FALLOS:\n - ' + fallos.join('\n - '));
	process.exit(1);
}
console.log('✅ E2E pulido OK');
