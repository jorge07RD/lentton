// Smoke test del parser de EPUB fuera del navegador.
// Genera un EPUB mínimo en español, poliyfillea DOMParser con linkedom y ejecuta parseEpub.
// Uso: node scripts/smoke-epub.mjs
import { DOMParser } from 'linkedom';
import { crearEpubBuffer } from './fixture-epub.mjs';

// Polyfill de DOMParser (el navegador lo trae nativo; aquí usamos linkedom).
globalThis.DOMParser = DOMParser;

const { parseEpub } = await import('../src/lib/epub/parseEpub.ts');

const buf = await crearEpubBuffer();
const file = new File([buf], 'prueba.epub', { type: 'application/epub+zip' });

// --- Ejecutar el parser ---
const libro = await parseEpub(file);

console.log('id        :', libro.id.slice(0, 16), '…');
console.log('title     :', libro.title);
console.log('author    :', libro.author);
console.log('capítulos :', libro.chapters.length);
for (const c of libro.chapters) {
	console.log(`  - "${c.title}" (${c.sentences.length} oraciones)`);
	for (const s of c.sentences) console.log(`      · ${s}`);
}

// --- Aserciones básicas ---
const errores = [];
if (libro.title !== 'El libro de prueba') errores.push('título incorrecto');
if (libro.author !== 'Jorge Autor') errores.push('autor incorrecto');
if (libro.chapters.length !== 2) errores.push('debería haber 2 capítulos');
if (libro.chapters[0].title !== 'Capítulo primero') errores.push('título cap1 incorrecto');
const totalOraciones = libro.chapters.reduce((n, c) => n + c.sentences.length, 0);
if (totalOraciones < 6) errores.push(`muy pocas oraciones: ${totalOraciones}`);

if (errores.length) {
	console.error('\n❌ FALLOS:', errores.join('; '));
	process.exit(1);
}
console.log('\n✅ Smoke test OK');
