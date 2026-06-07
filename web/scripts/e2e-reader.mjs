// E2E biblioteca -> lector -> navegación -> modo -> reanudar (diseño nuevo).
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
const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });

const errores = [];
const BENIGNOS = /favicon\.ico|manifest\.webmanifest|fonts\.(googleapis|gstatic)/;
page.on('console', (m) => {
	if (m.type() !== 'error') return;
	const url = m.location()?.url ?? '';
	if (BENIGNOS.test(url) || BENIGNOS.test(m.text())) return;
	errores.push(`${m.text()} ${url}`.trim());
});
page.on('pageerror', (e) => errores.push(String(e)));

const fallos = [];
const check = (c, m) => !c && fallos.push(m);
const captura = async (n) => {
	try {
		await page.screenshot({ path: `${OUT}-${n}.png` });
	} catch (e) {
		console.warn(`(captura ${n} omitida: ${e.message})`);
	}
};
// El rail usa text-transform:uppercase, así que comparamos en minúsculas.
const railTexto = async () => (await page.locator('.rail').innerText().catch(() => '')).toLowerCase();

try {
	// 1) Biblioteca
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.setInputFiles('input[type=file]', epubPath);
	await page.waitForSelector('.book', { timeout: 10000 });
	const titulo = await page.textContent('.book-title');
	check(titulo === 'El libro de prueba', `título en biblioteca: ${titulo}`);
	await captura('1-biblioteca');

	// 2) Abrir lector
	await page.click('.book');
	await page.waitForSelector('.reader .sentence.active', { timeout: 10000 });
	const cap0 = await railTexto();
	check(cap0.includes('capítulo primero'), `capítulo inicial en franja: ${cap0}`);
	const activas = await page.locator('.sentence.active').count();
	check(activas === 1, `exactamente una oración activa (${activas})`);
	await captura('2-foco');

	// 3) Modo foco: oración lejana atenuada (opacity baja)
	const opFoco = await page.locator('.sentence').last().evaluate((el) => getComputedStyle(el).opacity);
	check(Number(opFoco) < 0.35, `en foco la oración lejana se atenúa (op=${opFoco})`);

	// 4) Tecla F -> página completa: lejana visible
	await page.keyboard.press('f');
	await page.waitForSelector('.reader.mode-full', { timeout: 3000 });
	await page.waitForTimeout(700);
	const opFull = await page.locator('.sentence').last().evaluate((el) => getComputedStyle(el).opacity);
	check(Number(opFull) > 0.6, `en completo la oración lejana es visible (op=${opFull})`);
	await captura('3-completo');

	// 4 bis) Tercer modo: Libro (hoja paginada con número de página)
	await page.keyboard.press('f');
	await page.waitForSelector('.reader.mode-book .leaf', { timeout: 3000 });
	const pie = await page.locator('.leaf-foot').innerText();
	check(/pág/i.test(pie), `el modo libro muestra número de página (${pie})`);
	await captura('4-libro');
	await page.keyboard.press('f'); // libro -> foco

	// 5) Avanzar con ArrowRight cambia la oración activa
	const o0 = await page.textContent('.sentence.active');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	const o1 = await page.textContent('.sentence.active');
	check(o1 !== o0, `la oración activa cambió tras avanzar (${o1})`);

	// 6) Avanzar hasta el capítulo 2
	for (let i = 0; i < 20 && !(await railTexto()).includes('capítulo segundo'); i++) {
		await page.keyboard.press('ArrowRight');
	}
	check((await railTexto()).includes('capítulo segundo'), 'se llegó al capítulo segundo');

	// 7) Reanudar: recargar y comprobar que sigue en el capítulo 2
	await page.waitForTimeout(700);
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForSelector('.reader .sentence.active');
	check((await railTexto()).includes('capítulo segundo'), 'reanudó en el capítulo segundo');
	check(/\d/.test(await page.textContent('.rail-pct')), 'la franja muestra %');
} catch (e) {
	fallos.push(`excepción: ${e.message}`);
} finally {
	await browser.close();
}

check(errores.length === 0, `errores de consola: ${errores.join(' | ')}`);
console.log(`Capturas en: ${OUT}-*.png`);
if (fallos.length) {
	console.error('\n❌ FALLOS:\n - ' + fallos.join('\n - '));
	process.exit(1);
}
console.log('✅ E2E OK');
