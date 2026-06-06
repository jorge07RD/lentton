// Parseo de EPUB en el cliente: JSZip para descomprimir, DOMParser para el XML/XHTML
// e Intl.Segmenter para segmentar en oraciones. Sin dependencias pesadas extra.
import JSZip from 'jszip';
import type { Book, Chapter } from '$lib/types';
import { hashBuffer } from './hash';

// Etiquetas cuyo final implica un salto de bloque (párrafo) en el texto extraído.
const ETIQUETAS_BLOQUE = new Set([
	'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'LI', 'BLOCKQUOTE',
	'PRE', 'TR', 'FIGURE', 'FIGCAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR'
]);
// Etiquetas a ignorar por completo (no aportan texto legible).
const ETIQUETAS_IGNORADAS = new Set(['SCRIPT', 'STYLE', 'IMG', 'SVG', 'HEAD', 'NAV']);

// Segmentador de oraciones en español (nativo del navegador).
const segmentador = new Intl.Segmenter('es', { granularity: 'sentence' });

/** Resuelve una ruta href relativa respecto al directorio de un archivo base (el .opf). */
function resolverRuta(base: string, href: string): string {
	const hrefLimpio = href.split('#')[0]; // descartar fragmento
	const partesBase = base.split('/').slice(0, -1); // directorio del base
	for (const parte of hrefLimpio.split('/')) {
		if (parte === '.' || parte === '') continue;
		if (parte === '..') partesBase.pop();
		else partesBase.push(parte);
	}
	return partesBase.join('/');
}

/** Extrae texto de un nodo preservando saltos de bloque como '\n'. */
function extraerTexto(nodo: Node): string {
	let salida = '';
	// nodeType: 3 = TEXT_NODE, 1 = ELEMENT_NODE (constantes estándar del DOM).
	for (const hijo of Array.from(nodo.childNodes)) {
		if (hijo.nodeType === 3) {
			salida += hijo.textContent ?? '';
		} else if (hijo.nodeType === 1) {
			const el = hijo as Element;
			const tag = el.tagName.toUpperCase();
			if (ETIQUETAS_IGNORADAS.has(tag)) continue;
			if (tag === 'BR') {
				salida += '\n';
				continue;
			}
			salida += extraerTexto(el);
			if (ETIQUETAS_BLOQUE.has(tag)) salida += '\n';
		}
	}
	return salida;
}

/** Convierte un documento XHTML en oraciones segmentadas, párrafo a párrafo. */
function documentoAOraciones(doc: Document): string[] {
	const cuerpo = doc.body ?? doc.documentElement;
	const bruto = extraerTexto(cuerpo);
	const oraciones: string[] = [];
	for (const bloque of bruto.split('\n')) {
		const parrafo = bloque.replace(/\s+/g, ' ').trim();
		if (!parrafo) continue;
		for (const { segment } of segmentador.segment(parrafo)) {
			const oracion = segment.trim();
			if (oracion) oraciones.push(oracion);
		}
	}
	return oraciones;
}

/** Título del capítulo: primer encabezado del documento, o un genérico. */
function tituloCapitulo(doc: Document, indice: number): string {
	const h = doc.querySelector('h1, h2, h3, h4, h5, h6');
	const texto = h?.textContent?.replace(/\s+/g, ' ').trim();
	return texto || `Capítulo ${indice + 1}`;
}

/** Parsea un archivo EPUB completo a nuestro modelo Book. */
export async function parseEpub(file: File): Promise<Book> {
	const dom = new DOMParser();
	// Leer los bytes una sola vez: sirven para el hash (id) y para descomprimir.
	const buf = await file.arrayBuffer();
	const id = await hashBuffer(buf);
	const zip = await JSZip.loadAsync(buf);

	// 1) container.xml → ruta del .opf
	const containerXml = await leerTexto(zip, 'META-INF/container.xml');
	if (!containerXml) throw new Error('EPUB inválido: falta META-INF/container.xml');
	const container = dom.parseFromString(containerXml, 'application/xml');
	const rootfile = container.querySelector('rootfile')?.getAttribute('full-path');
	if (!rootfile) throw new Error('EPUB inválido: no se encontró el rootfile (.opf)');

	// 2) Parsear el .opf: manifest, spine y metadata
	const opfXml = await leerTexto(zip, rootfile);
	if (!opfXml) throw new Error(`EPUB inválido: no se pudo leer ${rootfile}`);
	const opf = dom.parseFromString(opfXml, 'application/xml');

	// Manifest: id -> { href absoluto, media-type, properties }
	const manifest = new Map<string, { href: string; tipo: string; props: string }>();
	for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
		const idItem = item.getAttribute('id');
		const href = item.getAttribute('href');
		if (!idItem || !href) continue;
		manifest.set(idItem, {
			href: resolverRuta(rootfile, href),
			tipo: item.getAttribute('media-type') ?? '',
			props: item.getAttribute('properties') ?? ''
		});
	}

	// Metadata Dublin Core
	const dc = (campo: string) =>
		opf.getElementsByTagName(`dc:${campo}`)[0]?.textContent?.trim() ||
		opf.querySelector(campo)?.textContent?.trim();
	const title = dc('title') || file.name.replace(/\.epub$/i, '');
	const author = dc('creator') || undefined;

	// 3) Spine: orden de lectura. REVISAR: común a EPUB 2 (NCX) y 3 (nav).
	const chapters: Chapter[] = [];
	const itemrefs = Array.from(opf.querySelectorAll('spine > itemref'));
	let indice = 0;
	for (const ref of itemrefs) {
		const idref = ref.getAttribute('idref');
		if (!idref) continue;
		const item = manifest.get(idref);
		// Solo documentos XHTML/HTML; saltar otros recursos del spine.
		if (!item || !/x?html/i.test(item.tipo)) continue;
		const html = await leerTexto(zip, item.href);
		if (!html) continue;
		const doc = dom.parseFromString(html, 'application/xhtml+xml');
		// REVISAR: si el parseo XHTML falla (EPUB mal formados), reintentar como HTML.
		const docFinal = doc.querySelector('parsererror')
			? dom.parseFromString(html, 'text/html')
			: doc;
		const sentences = documentoAOraciones(docFinal);
		if (sentences.length === 0) continue; // saltar páginas vacías (portadas, etc.)
		chapters.push({ title: tituloCapitulo(docFinal, indice), sentences });
		indice++;
	}

	if (chapters.length === 0) throw new Error('No se pudo extraer texto del EPUB');

	// 4) Portada (opcional)
	const cover = await extraerPortada(zip, opf, manifest);

	return { id, title, author, cover, chapters, addedAt: Date.now() };
}

/** Lee un archivo del zip como texto, tolerando rutas con o sin barra inicial. */
async function leerTexto(zip: JSZip, ruta: string): Promise<string | null> {
	const f = zip.file(ruta) ?? zip.file(ruta.replace(/^\//, ''));
	return f ? f.async('string') : null;
}

/** Busca la portada por properties="cover-image" (EPUB3) o <meta name="cover"> (EPUB2). */
async function extraerPortada(
	zip: JSZip,
	opf: Document,
	manifest: Map<string, { href: string; tipo: string; props: string }>
): Promise<Blob | undefined> {
	let item: { href: string; tipo: string } | undefined;
	// EPUB3: item con properties que incluye "cover-image".
	for (const it of manifest.values()) {
		if (it.props.split(/\s+/).includes('cover-image')) {
			item = it;
			break;
		}
	}
	// EPUB2: <meta name="cover" content="idDelItem">.
	if (!item) {
		const metaCover = Array.from(opf.querySelectorAll('metadata > meta')).find(
			(m) => m.getAttribute('name') === 'cover'
		);
		const idPortada = metaCover?.getAttribute('content');
		if (idPortada) item = manifest.get(idPortada);
	}
	if (!item) return undefined;
	const archivo = zip.file(item.href) ?? zip.file(item.href.replace(/^\//, ''));
	if (!archivo) return undefined;
	const blob = await archivo.async('blob');
	return item.tipo ? blob.slice(0, blob.size, item.tipo) : blob;
}
