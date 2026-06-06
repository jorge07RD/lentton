// Smoke test del parser de EPUB fuera del navegador.
// Genera un EPUB mínimo en español, poliyfillea DOMParser con linkedom y ejecuta parseEpub.
// Uso: node scripts/smoke-epub.mjs
import JSZip from 'jszip';
import { DOMParser } from 'linkedom';

// Polyfill de DOMParser (el navegador lo trae nativo; aquí usamos linkedom).
globalThis.DOMParser = DOMParser;

const { parseEpub } = await import('../src/lib/epub/parseEpub.ts');

// --- Construir un EPUB de prueba ---
const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip');
zip.file(
	'META-INF/container.xml',
	`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
);
zip.file(
	'OEBPS/content.opf',
	`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>El libro de prueba</dc:title>
    <dc:creator>Jorge Autor</dc:creator>
    <dc:identifier id="bookid">urn:uuid:prueba-123</dc:identifier>
    <dc:language>es</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
);
zip.file(
	'OEBPS/ch1.xhtml',
	`<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>C1</title></head><body>
  <h1>Capítulo primero</h1>
  <p>Esto es la primera oración. Y esta es la segunda, con una coma. ¿Una pregunta?</p>
  <p>Un segundo párrafo<br/>con un salto de línea. Fin del párrafo.</p>
</body></html>`
);
zip.file(
	'OEBPS/ch2.xhtml',
	`<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>C2</title></head><body>
  <h2>Capítulo segundo</h2>
  <p>Otra oración del capítulo dos. ¡Y una exclamación!</p>
</body></html>`
);

const buf = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
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
