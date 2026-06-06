<script lang="ts">
	import { goto } from '$app/navigation';
	import { parseEpub } from '$lib/epub/parseEpub';
	import { getAllBooks, saveBook, getPosition, savePosition, deleteBook } from '$lib/db';
	import { fraccionProgreso } from '$lib/progress';
	import type { Book } from '$lib/types';

	interface FilaLibro {
		book: Book;
		progreso: number; // 0..1
		coverUrl: string | null;
	}

	let filas = $state<FilaLibro[]>([]);
	let cargando = $state(true);
	let parseando = $state(false);
	let error = $state('');

	async function cargarBiblioteca() {
		// Revocar URLs previas para no fugar memoria.
		for (const f of filas) if (f.coverUrl) URL.revokeObjectURL(f.coverUrl);
		const libros = await getAllBooks();
		filas = await Promise.all(
			libros.map(async (book) => {
				const pos = await getPosition(book.id);
				return {
					book,
					progreso: fraccionProgreso(book, pos),
					coverUrl: book.cover ? URL.createObjectURL(book.cover) : null
				};
			})
		);
		cargando = false;
	}

	$effect(() => {
		cargarBiblioteca();
	});

	async function alSubir(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // permitir resubir el mismo archivo
		if (!file) return;
		parseando = true;
		error = '';
		try {
			const book = await parseEpub(file);
			await saveBook(book);
			// Si es nuevo, crear posición inicial; si ya existía, conservar la guardada.
			if (!(await getPosition(book.id))) {
				await savePosition({
					bookId: book.id,
					chapterIndex: 0,
					sentenceIndex: 0,
					updatedAt: Date.now()
				});
			}
			await cargarBiblioteca();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			parseando = false;
		}
	}

	async function eliminar(e: MouseEvent, id: string) {
		e.stopPropagation();
		if (!confirm('¿Eliminar este libro de la biblioteca?')) return;
		await deleteBook(id);
		await cargarBiblioteca();
	}
</script>

<header class="cabecera">
	<h1>Lentton</h1>
	<label class="boton-subir">
		{parseando ? 'Parseando…' : '+ Añadir EPUB'}
		<input type="file" accept=".epub,application/epub+zip" onchange={alSubir} hidden />
	</label>
</header>

{#if error}<p class="error">Error: {error}</p>{/if}

{#if cargando}
	<p class="vacio">Cargando biblioteca…</p>
{:else if filas.length === 0}
	<p class="vacio">Tu biblioteca está vacía. Añadí un EPUB para empezar.</p>
{:else}
	<ul class="grilla">
		{#each filas as fila (fila.book.id)}
			<li>
				<button class="tarjeta" onclick={() => goto(`/read/${fila.book.id}`)}>
					<div class="cover" class:sin-cover={!fila.coverUrl}>
						{#if fila.coverUrl}
							<img src={fila.coverUrl} alt="Portada de {fila.book.title}" />
						{:else}
							<span>{fila.book.title}</span>
						{/if}
					</div>
					<div class="info">
						<strong>{fila.book.title}</strong>
						{#if fila.book.author}<span class="autor">{fila.book.author}</span>{/if}
						<div class="barra"><div class="relleno" style:width="{fila.progreso * 100}%"></div></div>
						<span class="pct">{Math.round(fila.progreso * 100)}%</span>
					</div>
				</button>
				<button class="eliminar" title="Eliminar" onclick={(e) => eliminar(e, fila.book.id)}>✕</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.cabecera {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 60rem;
		margin: 1.5rem auto;
		padding: 0 1rem;
	}
	.cabecera h1 {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	.boton-subir {
		cursor: pointer;
		background: #111;
		color: #fff;
		padding: 0.6rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.95rem;
	}
	.error {
		max-width: 60rem;
		margin: 0 auto;
		padding: 0 1rem;
		color: #b00020;
	}
	.vacio {
		text-align: center;
		color: #888;
		margin-top: 4rem;
		font-family: system-ui, sans-serif;
	}
	.grilla {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1.25rem;
		max-width: 60rem;
		margin: 0 auto;
		padding: 1rem;
	}
	.grilla li {
		position: relative;
	}
	.tarjeta {
		display: block;
		width: 100%;
		text-align: left;
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		font-family: system-ui, sans-serif;
	}
	.cover {
		aspect-ratio: 2 / 3;
		border-radius: 0.4rem;
		overflow: hidden;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
		background: #ddd;
	}
	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cover.sin-cover {
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0.5rem;
		background: linear-gradient(135deg, #4a4a6a, #2a2a3a);
		color: #fff;
		font-weight: 600;
		font-size: 0.85rem;
	}
	.info {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.info strong {
		font-size: 0.9rem;
		line-height: 1.2;
	}
	.autor {
		font-size: 0.8rem;
		color: #777;
	}
	.barra {
		height: 4px;
		background: #e0e0e0;
		border-radius: 2px;
		margin-top: 0.3rem;
		overflow: hidden;
	}
	.relleno {
		height: 100%;
		background: #4a7;
	}
	.pct {
		font-size: 0.75rem;
		color: #999;
	}
	.eliminar {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border-radius: 50%;
		width: 1.6rem;
		height: 1.6rem;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.grilla li:hover .eliminar {
		opacity: 1;
	}
</style>
