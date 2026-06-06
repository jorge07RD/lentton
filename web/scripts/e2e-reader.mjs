// E2E con Playwright (chromium del sistema): biblioteca -> lector -> navegación -> reanudar.
// Requiere un servidor sirviendo la app (vite preview/dev). URL via BASE_URL (def. 4173).
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEpubBuffer } from './fixture-epub.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const EXEC = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const OUT = join(tmpdir(), 'lentton-e2e');

const epubPath = join(tmpdir(), 'prueba.epub');
await writeFile(epubPath, await crearEpubBuffer());

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

const erroresConsola = [];
// 404 benignos: el navegador pide /favicon.ico automáticamente (usamos .svg) y
// /manifest.webmanifest solo existe en el build de producción, no en dev.
const BENIGNOS = /favicon\.ico|manifest\.webmanifest/;
page.on('console', (m) => {
	if (m.type() !== 'error') return;
	const url = m.location()?.url ?? '';
	if (BENIGNOS.test(url) || BENIGNOS.test(m.text())) return;
	erroresConsola.push(`${m.text()} ${url}`.trim());
});
page.on('pageerror', (e) => erroresConsola.push(String(e)));
page.on(
	'response',
	(r) => r.status() === 404 && !BENIGNOS.test(r.url()) && erroresConsola.push(`404 ${r.url()}`)
);

const fallos = [];
function check(cond, msg) {
	if (!cond) fallos.push(msg);
}
async function captura(nombre) {
	// Las capturas son informativas; no deben hacer fallar el test si el headless falla.
	try {
		await page.screenshot({ path: `${OUT}-${nombre}.png` });
	} catch (e) {
		console.warn(`(captura ${nombre} omitida: ${e.message})`);
	}
}

try {
	// 1) Biblioteca vacía + subir EPUB
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.waitForSelector('.boton-subir');
	await page.setInputFiles('input[type=file]', epubPath);
	await page.waitForSelector('.tarjeta', { timeout: 10000 });
	const titulo = await page.textContent('.tarjeta .info strong');
	check(titulo === 'El libro de prueba', `título en biblioteca: ${titulo}`);
	await captura("1-biblioteca");

	// 2) Abrir lector
	await page.click('.tarjeta');
	await page.waitForSelector('.foco .oracion.actual', { timeout: 10000 });
	const oracion0 = await page.textContent('.oracion.actual');
	const cap0 = await page.textContent('.top .cap');
	check(!!oracion0, 'hay oración actual');
	check(cap0?.includes('Capítulo primero'), `capítulo inicial: ${cap0}`);
	const actuales = await page.locator('.foco .oracion.actual').count();
	check(actuales === 1, `hay exactamente una oración actual (${actuales})`);
	await captura("2-lector");

	// Modo foco: una oración lejana debe estar oculta (opacity 0).
	const lejana = '.foco .oracion:last-child';
	const opFoco = await page.locator(lejana).evaluate((el) => getComputedStyle(el).opacity);
	check(Number(opFoco) < 0.3, `en foco la oración lejana está atenuada (op=${opFoco})`);

	// Cambiar a página completa con 'm': la lejana se vuelve visible.
	await page.keyboard.press('m');
	const modoAttr = await page.locator('.foco').getAttribute('data-modo');
	check(modoAttr === 'completo', `modo cambió a completo (${modoAttr})`);
	await page.waitForTimeout(700); // animación de opacidad
	const opCompleto = await page.locator(lejana).evaluate((el) => getComputedStyle(el).opacity);
	check(Number(opCompleto) > 0.5, `en completo la oración lejana es visible (op=${opCompleto})`);
	await captura("2b-completo");
	await page.keyboard.press('m'); // volver a foco

	// 3) Avanzar con ArrowRight cambia la oración actual
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	const oracion2 = await page.textContent('.oracion.actual');
	check(oracion2 !== oracion0, `la oración actual cambió tras avanzar (${oracion2})`);

	// 4) ArrowDown salta de capítulo
	await page.keyboard.press('ArrowDown');
	const capTras = await page.textContent('.top .cap');
	check(capTras?.includes('Capítulo segundo'), `salto de capítulo: ${capTras}`);
	await captura("3-cap2");

	// 5) Reanudar: recargar y comprobar que NO vuelve a la primera oración
	await page.waitForTimeout(700); // dejar que el debounce guarde
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForSelector('.foco .oracion.actual');
	const capReanudado = await page.textContent('.top .cap');
	check(capReanudado?.includes('Capítulo segundo'), `reanudó en: ${capReanudado}`);

	// 6) Progreso > 0
	const pct = await page.textContent('.estado');
	check(/[1-9]/.test(pct ?? ''), `progreso mostrado: ${pct}`);
} catch (e) {
	fallos.push(`excepción: ${e.message}`);
} finally {
	await browser.close();
}

check(erroresConsola.length === 0, `errores de consola: ${erroresConsola.join(' | ')}`);

console.log(`Capturas en: ${OUT}-*.png`);
if (fallos.length) {
	console.error('\n❌ FALLOS:\n - ' + fallos.join('\n - '));
	process.exit(1);
}
console.log('✅ E2E OK');
