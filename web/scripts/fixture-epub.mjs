// Genera un EPUB 3 mínimo en español, reutilizado por el smoke test y el e2e.
import JSZip from 'jszip';

export async function crearEpubBuffer() {
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
  <p>Un segundo párrafo con varias oraciones. Aquí va otra más. Y una tercera para tener contexto.</p>
</body></html>`
	);
	zip.file(
		'OEBPS/ch2.xhtml',
		`<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>C2</title></head><body>
  <h2>Capítulo segundo</h2>
  <p>Otra oración del capítulo dos. ¡Y una exclamación! Una oración final del libro.</p>
</body></html>`
	);
	return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}
