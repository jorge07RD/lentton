// E2E Fase 6: persistencia de preferencias (velocidad) y overlay de ayuda. Contra dev.
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
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const fallos = [];
const check = (c, m) => !c && fallos.push(m);

async function abrirLector() {
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type=file]', epubPath).catch(() => {});
	await page.waitForSelector('.tarjeta');
	await page.click('.tarjeta');
	await page.waitForSelector('.foco .oracion.actual');
}

try {
	await abrirLector();

	// Abrir ajustes y cambiar la velocidad.
	await page.click('button[title="Ajustes"]');
	await page.waitForSelector('.panel input[type=range]');
	await page.fill('.panel input[type=range]', '1.5');
	await page.dispatchEvent('.panel input[type=range]', 'input');
	await page.waitForTimeout(600); // esperar el debounce de saveSettings

	// Recargar y comprobar que persistió.
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForSelector('.foco .oracion.actual');
	await page.click('button[title="Ajustes"]');
	await page.waitForSelector('.panel input[type=range]');
	const vel = await page.inputValue('.panel input[type=range]');
	check(vel === '1.5', `velocidad persistida: ${vel}`);

	// Overlay de ayuda con '?'.
	await page.keyboard.press('?');
	await page.waitForSelector('.ayuda', { timeout: 3000 });
	check(await page.locator('.ayuda').isVisible(), 'ayuda visible con ?');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);
	check(!(await page.locator('.ayuda').count()), 'ayuda se cierra con Esc');
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
