<script lang="ts">
	// Lector mínimo (Fase 2): carga libro + posición y permite avanzar, guardando
	// la posición con debounce. La UI de foco completa llega en la Fase 3.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getBook, getPosition, savePosition } from '$lib/db';
	import { debounce } from '$lib/debounce';
	import { fraccionProgreso } from '$lib/progress';
	import type { Book } from '$lib/types';

	let book = $state<Book | null>(null);
	let chapterIndex = $state(0);
	let sentenceIndex = $state(0);
	let cargando = $state(true);

	const bookId = $derived(page.params.bookId);

	$effect(() => {
		const id = bookId;
		if (!id) return;
		(async () => {
			const b = await getBook(id);
			if (!b) {
				cargando = false;
				return;
			}
			book = b;
			const pos = await getPosition(id);
			if (pos) {
				chapterIndex = Math.min(pos.chapterIndex, b.chapters.length - 1);
				sentenceIndex = Math.min(pos.sentenceIndex, b.chapters[chapterIndex].sentences.length - 1);
			}
			cargando = false;
		})();
	});

	const guardar = debounce((id: string, c: number, s: number) => {
		savePosition({ bookId: id, chapterIndex: c, sentenceIndex: s, updatedAt: Date.now() });
	}, 500);

	// Persistir cada cambio de posición (con debounce).
	$effect(() => {
		if (book && bookId) guardar(bookId, chapterIndex, sentenceIndex);
	});

	const cap = $derived(book?.chapters[chapterIndex] ?? null);
	const oracion = $derived(cap?.sentences[sentenceIndex] ?? '');
	const progreso = $derived(
		book ? fraccionProgreso(book, { bookId: bookId!, chapterIndex, sentenceIndex, updatedAt: 0 }) : 0
	);

	function avanzar() {
		if (!book) return;
		const c = book.chapters[chapterIndex];
		if (sentenceIndex < c.sentences.length - 1) sentenceIndex++;
		else if (chapterIndex < book.chapters.length - 1) {
			chapterIndex++;
			sentenceIndex = 0;
		}
	}
	function retroceder() {
		if (!book) return;
		if (sentenceIndex > 0) sentenceIndex--;
		else if (chapterIndex > 0) {
			chapterIndex--;
			sentenceIndex = book.chapters[chapterIndex].sentences.length - 1;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'ArrowRight' || e.key === ' ') {
			e.preventDefault();
			avanzar();
		} else if (e.key === 'ArrowLeft') retroceder();
	}}
/>

{#if cargando}
	<p class="aviso">Cargando…</p>
{:else if !book}
	<p class="aviso">Libro no encontrado. <a href="/">Volver</a></p>
{:else}
	<div class="lector">
		<nav>
			<button onclick={() => goto('/')}>← Biblioteca</button>
			<span class="cap">{cap?.title}</span>
			<span class="pct">{Math.round(progreso * 100)}%</span>
		</nav>

		<p class="oracion">{oracion}</p>

		<div class="controles">
			<button onclick={retroceder}>Anterior</button>
			<button onclick={avanzar}>Siguiente</button>
		</div>
	</div>
{/if}

<style>
	.aviso {
		text-align: center;
		margin-top: 4rem;
		font-family: system-ui, sans-serif;
	}
	.lector {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem;
		font-family: system-ui, sans-serif;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		color: #777;
		font-size: 0.85rem;
	}
	.oracion {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-family: Georgia, serif;
		font-size: 1.6rem;
		line-height: 1.6;
	}
	.controles {
		display: flex;
		gap: 1rem;
		justify-content: center;
		padding-bottom: 2rem;
	}
	.controles button {
		padding: 0.6rem 1.4rem;
		font-size: 1rem;
		cursor: pointer;
	}
</style>
