<script lang="ts">
	// Fase 3: UI de lectura con foco. Ventana de ~5 oraciones con la actual al 100%
	// y las vecinas atenuadas. Chrome mínimo autoocultable, navegación por teclado.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getBook, getPosition, savePosition } from '$lib/db';
	import { debounce } from '$lib/debounce';
	import { aplanar, type OracionPlana } from '$lib/progress';
	import type { Book } from '$lib/types';

	const RADIO = 2; // oraciones visibles a cada lado de la actual
	const PALABRAS_POR_MINUTO = 200; // estimación de lectura silenciosa

	let book = $state<Book | null>(null);
	let planas = $state<OracionPlana[]>([]);
	let idx = $state(0);
	let cargando = $state(true);
	let tema = $state<'auto' | 'light' | 'dark'>('auto');
	let chromeVisible = $state(true);
	let prefiereOscuro = $state(false);

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
			const lista = aplanar(b);
			const pos = await getPosition(id);
			let inicio = 0;
			if (pos) {
				const i = lista.findIndex(
					(o) => o.chapterIndex === pos.chapterIndex && o.sentenceIndex === pos.sentenceIndex
				);
				if (i >= 0) inicio = i;
			}
			book = b;
			planas = lista;
			idx = inicio;
			cargando = false;
		})();
	});

	// Detectar preferencia de color del sistema (para tema 'auto').
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		prefiereOscuro = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (prefiereOscuro = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	const temaEfectivo = $derived(tema === 'auto' ? (prefiereOscuro ? 'dark' : 'light') : tema);

	// Guardar posición con debounce cuando cambia el índice.
	const guardar = debounce((id: string, ci: number, si: number) => {
		savePosition({ bookId: id, chapterIndex: ci, sentenceIndex: si, updatedAt: Date.now() });
	}, 500);

	$effect(() => {
		const o = planas[idx];
		if (o && bookId) guardar(bookId, o.chapterIndex, o.sentenceIndex);
	});

	// Ventana de oraciones a renderizar.
	const ventana = $derived(
		planas
			.map((o, i) => ({ o, i, dist: i - idx }))
			.filter((x) => Math.abs(x.dist) <= RADIO)
	);

	const actual = $derived(planas[idx]);
	const progreso = $derived(planas.length ? (idx + 1) / planas.length : 0);

	// Palabras restantes y tiempo estimado.
	const minutosRestantes = $derived.by(() => {
		let palabras = 0;
		for (let i = idx; i < planas.length; i++) palabras += contarPalabras(planas[i].texto);
		return Math.ceil(palabras / PALABRAS_POR_MINUTO);
	});

	function contarPalabras(s: string): number {
		return s.trim() ? s.trim().split(/\s+/).length : 0;
	}

	function irA(i: number) {
		idx = Math.max(0, Math.min(planas.length - 1, i));
		mostrarChrome();
	}
	function capRelativo(delta: number) {
		if (!actual) return;
		const objetivo = actual.chapterIndex + delta;
		const i = planas.findIndex((o) => o.chapterIndex === objetivo && o.sentenceIndex === 0);
		if (i >= 0) irA(i);
	}

	// Opacidad por distancia al foco.
	function opacidad(dist: number): number {
		const a = Math.abs(dist);
		if (a === 0) return 1;
		if (a === 1) return 0.5;
		if (a === 2) return 0.22;
		return 0.1;
	}

	// --- Autoocultado del chrome ---
	let timerChrome: ReturnType<typeof setTimeout> | undefined;
	function mostrarChrome() {
		chromeVisible = true;
		clearTimeout(timerChrome);
		timerChrome = setTimeout(() => (chromeVisible = false), 3000);
	}
	$effect(() => {
		mostrarChrome();
		return () => clearTimeout(timerChrome);
	});

	function onKey(e: KeyboardEvent) {
		switch (e.key) {
			case ' ':
			case 'ArrowRight':
				e.preventDefault();
				irA(idx + 1);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				irA(idx - 1);
				break;
			case 'ArrowDown':
				e.preventDefault();
				capRelativo(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				capRelativo(-1);
				break;
		}
	}

	function ciclarTema() {
		tema = tema === 'auto' ? 'light' : tema === 'light' ? 'dark' : 'auto';
	}
</script>

<svelte:window onkeydown={onKey} onpointermove={mostrarChrome} />

{#if cargando}
	<p class="aviso">Cargando…</p>
{:else if !book}
	<p class="aviso">Libro no encontrado. <a href="/">Volver a la biblioteca</a></p>
{:else}
	<div class="lector" data-theme={temaEfectivo}>
		<!-- Chrome superior -->
		<header class="chrome top" class:oculto={!chromeVisible}>
			<button class="icono" onclick={() => goto('/')} title="Biblioteca">←</button>
			<span class="cap">{actual?.chapterTitle}</span>
			<button class="icono" onclick={ciclarTema} title="Tema: {tema}">
				{tema === 'dark' ? '🌙' : tema === 'light' ? '☀️' : '🌓'}
			</button>
		</header>

		<!-- Ventana de foco -->
		<div class="foco">
			{#each ventana as item (item.i)}
				<button
					class="oracion"
					class:actual={item.dist === 0}
					style:opacity={opacidad(item.dist)}
					onclick={() => irA(item.i)}
				>
					{item.o.texto}
				</button>
			{/each}
		</div>

		<!-- Chrome inferior -->
		<footer class="chrome bottom" class:oculto={!chromeVisible}>
			<div class="barra"><div class="relleno" style:width="{progreso * 100}%"></div></div>
			<div class="estado">
				<span>{Math.round(progreso * 100)}%</span>
				<span>~{minutosRestantes} min restantes</span>
			</div>
		</footer>
	</div>
{/if}

<style>
	.aviso {
		text-align: center;
		margin-top: 4rem;
		font-family: system-ui, sans-serif;
	}

	.lector {
		--bg: #faf8f4;
		--fg: #1a1a1a;
		--muted: #999;
		--acento: #4a7;
		position: fixed;
		inset: 0;
		background: var(--bg);
		color: var(--fg);
		display: flex;
		flex-direction: column;
		transition: background 0.3s;
	}
	.lector[data-theme='dark'] {
		--bg: #16161a;
		--fg: #e8e6e0;
		--muted: #666;
	}

	.chrome {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		font-family: system-ui, sans-serif;
		color: var(--muted);
		transition: opacity 0.4s;
		z-index: 2;
	}
	.chrome.oculto {
		opacity: 0;
		pointer-events: none;
	}
	.top {
		top: 0;
		justify-content: space-between;
		gap: 1rem;
	}
	.top .cap {
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.icono {
		background: none;
		border: none;
		color: var(--muted);
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
	}
	.bottom {
		bottom: 0;
		flex-direction: column;
		gap: 0.4rem;
	}
	.barra {
		width: 100%;
		height: 3px;
		background: color-mix(in srgb, var(--muted) 30%, transparent);
		border-radius: 2px;
		overflow: hidden;
	}
	.relleno {
		height: 100%;
		background: var(--acento);
		transition: width 0.3s;
	}
	.estado {
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-size: 0.78rem;
	}

	/* Ventana de foco centrada */
	.foco {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.6rem;
		max-width: 65ch;
		margin: 0 auto;
		padding: 4rem 1.5rem;
		width: 100%;
		box-sizing: border-box;
	}
	.oracion {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.6rem;
		line-height: 1.7;
		text-align: left;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
		transition:
			opacity 0.4s ease,
			font-size 0.3s ease;
	}
	.oracion.actual {
		font-weight: 600;
	}

	@media (max-width: 600px) {
		.oracion {
			font-size: 1.3rem;
		}
	}
</style>
