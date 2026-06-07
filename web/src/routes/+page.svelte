<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { parseEpub } from '$lib/epub/parseEpub';
	import { getAllBooks, saveBook, getPosition, savePosition, deleteBook } from '$lib/db';
	import { fraccionProgreso } from '$lib/progress';
	import { temaActual, alternarTema, initTema } from '$lib/theme.svelte';
	import {
		sincronizar,
		syncHabilitado,
		getSyncKey,
		setSyncKey,
		pushBook,
		pushPosition,
		deleteRemoto
	} from '$lib/sync';
	import Icon from '$lib/components/Icon.svelte';
	import type { Book } from '$lib/types';

	// Paletas tipográficas para portadas sin imagen (del handoff): [fondo, tinta].
	const PALETAS: [string, string][] = [
		['#3f5848', '#eef2ea'],
		['#9a5b43', '#fbeee6'],
		['#27303a', '#e9edf2'],
		['#5a3f54', '#f3e9f0'],
		['#a9853e', '#fbf3df'],
		['#46555c', '#eaf1f3'],
		['#8a4a3a', '#f8e9e3'],
		['#2f5340', '#e7f0e9'],
		['#2d5a55', '#e4f1ef']
	];
	function paleta(id: string): [string, string] {
		let h = 0;
		for (const c of id) h = (h + c.charCodeAt(0)) % PALETAS.length;
		return PALETAS[h];
	}

	interface Fila {
		book: Book;
		progreso: number;
		coverUrl: string | null;
	}

	let filas = $state<Fila[]>([]);
	let cargando = $state(true);
	let parseando = $state(false);
	let error = $state('');
	let sincronizando = $state(false);
	let input: HTMLInputElement;

	async function cargarBiblioteca() {
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

	// IMPORTANTE: carga única al montar, NO un $effect. cargarBiblioteca() lee `filas`
	// (revoca las coverUrl) y luego la reescribe; dentro de un $effect eso crea una
	// dependencia reactiva que reejecuta el efecto en bucle infinito (y dispara
	// sincronizar() sin parar → cientos de miles de peticiones a /api). Con onMount
	// corre una sola vez.
	onMount(() => {
		(async () => {
			await cargarBiblioteca();
			// Sincronizar en segundo plano con la memoria compartida (si hay clave).
			await sincronizarYRefrescar();
		})();
	});

	async function sincronizarYRefrescar() {
		if (!syncHabilitado()) return;
		sincronizando = true;
		try {
			const { cambios } = await sincronizar();
			if (cambios) {
				await initTema(); // por si llegaron prefs nuevas
				await cargarBiblioteca();
			}
		} catch {
			/* offline o API no disponible: seguimos con lo local */
		} finally {
			sincronizando = false;
		}
	}

	async function configurarSync() {
		const actual = getSyncKey();
		const k = prompt(
			'Clave de sincronización (la misma en todos tus dispositivos; vacío = desactivar):',
			actual
		);
		if (k === null) return;
		setSyncKey(k.trim());
		await sincronizarYRefrescar();
	}

	const leyendo = $derived(filas.filter((f) => f.progreso > 0 && f.progreso < 1));
	const resto = $derived(filas.filter((f) => f.progreso === 0 || f.progreso >= 1));

	async function alSubir(e: Event) {
		const el = e.target as HTMLInputElement;
		const file = el.files?.[0];
		el.value = '';
		if (!file) return;
		parseando = true;
		error = '';
		try {
			const book = await parseEpub(file);
			await saveBook(book);
			let pos = await getPosition(book.id);
			if (!pos) {
				pos = { bookId: book.id, chapterIndex: 0, sentenceIndex: 0, updatedAt: Date.now() };
				await savePosition(pos);
			}
			await cargarBiblioteca();
			if (syncHabilitado()) pushBook(book).then(() => pos && pushPosition(pos));
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
		deleteRemoto(id);
		await cargarBiblioteca();
	}
</script>

<input
	bind:this={input}
	class="hidden-file"
	type="file"
	accept=".epub,application/epub+zip"
	onchange={alSubir}
/>

<div class="library route">
	<div class="lib-inner">
		<div class="lib-head">
			<div>
				<div class="wordmark">focus<span class="dot"></span></div>
				<div class="lib-sub">Leé con la vista. O dejá que te lean.</div>
			</div>
			<div class="lib-actions">
				<button
					class="iconbtn"
					onclick={configurarSync}
					title={syncHabilitado() ? 'Sincronización activa' : 'Configurar sincronización'}
					aria-label="Sincronización"
					style={syncHabilitado() ? 'color:var(--accent)' : ''}
					class:girando={sincronizando}
				>
					<Icon name="cloud" />
				</button>
				<button class="iconbtn" onclick={alternarTema} title="Tema" aria-label="Tema">
					<Icon name={temaActual() === 'dark' ? 'sun' : 'moon'} />
				</button>
				<button
					class="iconbtn"
					onclick={() => input.click()}
					title="Añadir EPUB"
					aria-label="Añadir EPUB"
				>
					<Icon name="plus" />
				</button>
			</div>
		</div>

		{#if error}<p class="lib-sub" style="color:#b00020">Error: {error}</p>{/if}

		{#if cargando}
			<p class="lib-sub">Cargando biblioteca…</p>
		{:else if filas.length === 0}
			<div class="empty">
				<div class="empty-inner route">
					<div class="empty-mark">
						<svg
							viewBox="0 0 96 96"
							fill="none"
							stroke="currentColor"
							stroke-width="1.4"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M20 26c8-4 18-4 28 0v46c-10-4-20-4-28 0V26Z" />
							<path d="M76 26c-8-4-18-4-28 0v46c10-4 20-4 28 0V26Z" />
							<path d="M48 26v46" opacity=".4" />
						</svg>
					</div>
					<h2>Tu biblioteca espera</h2>
					<p>
						{parseando
							? 'Parseando…'
							: 'Todavía no hay nada para leer. Añadí un libro y dejá que las palabras —y la voz— hagan el resto.'}
					</p>
					<button class="btn btn-accent" onclick={() => input.click()}>
						<Icon name="plus" /> Añadir un libro
					</button>
				</div>
			</div>
		{:else}
			{#if leyendo.length > 0}
				<div class="lib-section-label meta">Seguir leyendo</div>
				<div class="grid" style="margin-bottom:48px">
					{#each leyendo as fila (fila.book.id)}
						{@render tarjeta(fila)}
					{/each}
				</div>
			{/if}

			<div class="lib-section-label meta">Tu estantería</div>
			<div class="grid">
				{#each resto as fila (fila.book.id)}
					{@render tarjeta(fila)}
				{/each}
			</div>
		{/if}
	</div>
</div>

{#snippet tarjeta(fila: Fila)}
	{@const pct = Math.round(fila.progreso * 100)}
	{@const fresh = fila.progreso === 0}
	{@const done = fila.progreso >= 1}
	{@const pal = paleta(fila.book.id)}
	<div class="book-cell">
		<button
			class="book"
			class:book-unread={fresh}
			onclick={() => goto(`/read/${fila.book.id}`)}
		>
			{#if fila.coverUrl}
				<div class="cover has-img">
					<img class="cover-img" src={fila.coverUrl} alt="Portada de {fila.book.title}" />
				</div>
			{:else}
				<div class="cover" style="background:{pal[0]};color:{pal[1]}">
					<div></div>
					<div>
						<div class="cover-title">{fila.book.title}</div>
						<div class="cover-rule"></div>
						{#if fila.book.author}<div class="cover-author" style="margin-top:9px">{fila.book.author}</div>{/if}
					</div>
				</div>
			{/if}
			<div class="book-meta">
				<div>
					<div class="book-title">{fila.book.title}</div>
					{#if fila.book.author}<div class="book-author">{fila.book.author}</div>{/if}
				</div>
				<div class="progress">
					<div class="progress-track">
						<div class="progress-fill" style:width="{fresh ? 0 : pct}%"></div>
					</div>
					<div class="progress-pct">{done ? '✓' : fresh ? 'Nuevo' : pct + '%'}</div>
				</div>
			</div>
		</button>
		<button
			class="book-del"
			title="Eliminar"
			aria-label="Eliminar"
			onclick={(e) => eliminar(e, fila.book.id)}
		>
			<Icon name="close" />
		</button>
	</div>
{/snippet}
