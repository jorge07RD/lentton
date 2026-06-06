<script lang="ts">
	// Fase 5: lectura con foco + narración encadenada (Kokoro / Web Speech) con prefetch.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getBook, getPosition, savePosition, getSettings, saveSettings, type Settings } from '$lib/db';
	import { getVoices, VOCES_FALLBACK, type Voice } from '$lib/api';
	import { debounce } from '$lib/debounce';
	import { aplanar, type OracionPlana } from '$lib/progress';
	import { Narrador } from '$lib/narration/controller.svelte';
	import { KokoroProvider } from '$lib/narration/kokoro';
	import { WebSpeechProvider } from '$lib/narration/webspeech';
	import type { NarrationProvider } from '$lib/narration/types';
	import type { Book } from '$lib/types';

	const RADIO = 2;
	const PALABRAS_POR_MINUTO = 200;

	let book = $state<Book | null>(null);
	let planas = $state<OracionPlana[]>([]);
	let narrador = $state<Narrador | null>(null);
	let cargando = $state(true);
	let tema = $state<'auto' | 'light' | 'dark'>('auto');
	let prefiereOscuro = $state(false);
	let chromeVisible = $state(true);
	let opts = $state<{ voice: string; speed: number }>({ voice: 'ef_dora', speed: 1 });
	let proveedorId = $state<'kokoro' | 'webspeech'>('kokoro');
	let voces = $state<Voice[]>(VOCES_FALLBACK);
	let mostrarAjustes = $state(false);
	let mostrarAyuda = $state(false);
	let listo = $state(false); // evita persistir settings durante la carga inicial

	// Proveedores (se crean una vez en el navegador).
	const proveedores: Record<string, NarrationProvider> = {};

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
			const settings: Settings = await getSettings();
			tema = settings.theme;
			opts = { voice: settings.voice, speed: settings.speed };

			const pos = await getPosition(id);
			let inicio = 0;
			if (pos) {
				const i = lista.findIndex(
					(o) => o.chapterIndex === pos.chapterIndex && o.sentenceIndex === pos.sentenceIndex
				);
				if (i >= 0) inicio = i;
			}

			proveedores.kokoro = new KokoroProvider();
			proveedores.webspeech = new WebSpeechProvider();
			proveedorId = settings.provider;
			const inicial = proveedores[settings.provider] ?? proveedores.kokoro;
			const n = new Narrador(inicial, opts);
			n.setContenido(
				lista.map((o) => o.texto),
				inicio
			);

			book = b;
			planas = lista;
			narrador = n;
			cargando = false;
			listo = true;

			// Cargar voces del servidor en segundo plano (no bloquea la lectura).
			getVoices().then((v) => v.length && (voces = v));
		})();
	});

	// Persistir preferencias cuando cambian (con debounce para el slider de velocidad).
	const guardarSettings = debounce((s: Settings) => saveSettings(s), 300);
	$effect(() => {
		if (!listo) return;
		const s: Settings = {
			theme: tema,
			provider: proveedorId,
			voice: opts.voice,
			speed: opts.speed
		};
		guardarSettings(s);
	});

	// Preferencia de color del sistema (para tema 'auto').
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		prefiereOscuro = mq.matches;
		const fn = (e: MediaQueryListEvent) => (prefiereOscuro = e.matches);
		mq.addEventListener('change', fn);
		return () => mq.removeEventListener('change', fn);
	});

	const temaEfectivo = $derived(tema === 'auto' ? (prefiereOscuro ? 'dark' : 'light') : tema);

	// Guardar posición con debounce al cambiar el índice.
	const guardar = debounce((id: string, ci: number, si: number) => {
		savePosition({ bookId: id, chapterIndex: ci, sentenceIndex: si, updatedAt: Date.now() });
	}, 500);

	const idx = $derived(narrador?.idx ?? 0);

	$effect(() => {
		const o = planas[idx];
		if (o && bookId) guardar(bookId, o.chapterIndex, o.sentenceIndex);
	});

	// Detener la narración al salir de la página.
	$effect(() => () => narrador?.stop());

	const ventana = $derived(
		planas.map((o, i) => ({ o, i, dist: i - idx })).filter((x) => Math.abs(x.dist) <= RADIO)
	);
	const actual = $derived(planas[idx]);
	const progreso = $derived(planas.length ? (idx + 1) / planas.length : 0);
	const reproduciendo = $derived(narrador?.estado === 'playing');

	const minutosRestantes = $derived.by(() => {
		let palabras = 0;
		for (let i = idx; i < planas.length; i++) palabras += contarPalabras(planas[i].texto);
		return Math.ceil(palabras / PALABRAS_POR_MINUTO);
	});
	function contarPalabras(s: string): number {
		return s.trim() ? s.trim().split(/\s+/).length : 0;
	}

	function capRelativo(delta: number) {
		if (!actual || !narrador) return;
		const objetivo = actual.chapterIndex + delta;
		const i = planas.findIndex((o) => o.chapterIndex === objetivo && o.sentenceIndex === 0);
		if (i >= 0) narrador.irA(i);
		mostrarChrome();
	}

	function opacidad(dist: number): number {
		const a = Math.abs(dist);
		if (a === 0) return 1;
		if (a === 1) return 0.5;
		if (a === 2) return 0.22;
		return 0.1;
	}

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
		if (!narrador) return;
		// '?' abre/cierra la ayuda; Escape cierra cualquier overlay.
		if (e.key === '?') {
			e.preventDefault();
			mostrarAyuda = !mostrarAyuda;
			return;
		}
		if (e.key === 'Escape') {
			mostrarAyuda = false;
			mostrarAjustes = false;
			return;
		}
		switch (e.key) {
			case ' ':
				e.preventDefault();
				narrador.toggle(); // reproducir / pausar / reanudar
				break;
			case 'ArrowRight':
				e.preventDefault();
				narrador.avanzar();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				narrador.retroceder();
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
		mostrarChrome();
	}

	function ciclarTema() {
		tema = tema === 'auto' ? 'light' : tema === 'light' ? 'dark' : 'auto';
	}

	function cambiarProveedor(id: string) {
		if (narrador && proveedores[id]) {
			proveedorId = id as 'kokoro' | 'webspeech';
			narrador.setProvider(proveedores[id]);
		}
	}

	function setVoz(v: string) {
		opts = { ...opts, voice: v };
		narrador?.setOpts(opts);
	}
	function setVelocidad(v: number) {
		opts = { ...opts, speed: v };
		narrador?.setOpts(opts);
	}
</script>

<svelte:window onkeydown={onKey} onpointermove={mostrarChrome} />

{#if cargando}
	<p class="aviso">Cargando…</p>
{:else if !book || !narrador}
	<p class="aviso">Libro no encontrado. <a href="/">Volver a la biblioteca</a></p>
{:else}
	<div class="lector" data-theme={temaEfectivo}>
		<header class="chrome top" class:oculto={!chromeVisible}>
			<button class="icono" onclick={() => goto('/')} title="Biblioteca">←</button>
			<span class="cap">{actual?.chapterTitle}</span>
			<div class="acciones">
				<button class="icono" onclick={ciclarTema} title="Tema: {tema}">
					{tema === 'dark' ? '🌙' : tema === 'light' ? '☀️' : '🌓'}
				</button>
				<button class="icono" onclick={() => (mostrarAyuda = true)} title="Atajos (?)">?</button>
				<button class="icono" onclick={() => (mostrarAjustes = !mostrarAjustes)} title="Ajustes">
					⚙
				</button>
			</div>
		</header>

		<!-- Panel de ajustes (voz, velocidad, proveedor) -->
		{#if mostrarAjustes}
			<div class="panel">
				<label>
					Proveedor
					<select value={proveedorId} onchange={(e) => cambiarProveedor(e.currentTarget.value)}>
						<option value="kokoro">Kokoro (servidor)</option>
						<option value="webspeech">Voz del navegador</option>
					</select>
				</label>
				<label>
					Voz
					<select
						value={opts.voice}
						onchange={(e) => setVoz(e.currentTarget.value)}
						disabled={proveedorId !== 'kokoro'}
					>
						{#each voces as v (v.id)}
							<option value={v.id}>{v.id} ({v.gender === 'f' ? '♀' : '♂'})</option>
						{/each}
					</select>
				</label>
				<label>
					Velocidad: {opts.speed.toFixed(2)}×
					<input
						type="range"
						min="0.5"
						max="2"
						step="0.05"
						value={opts.speed}
						oninput={(e) => setVelocidad(Number(e.currentTarget.value))}
					/>
				</label>
			</div>
		{/if}

		<div class="foco">
			{#each ventana as item (item.i)}
				<button
					class="oracion"
					class:actual={item.dist === 0}
					style:opacity={opacidad(item.dist)}
					onclick={() => narrador?.irA(item.i)}
				>
					{item.o.texto}
				</button>
			{/each}
		</div>

		<!-- Botón central de reproducción -->
		<button
			class="play"
			class:oculto={!chromeVisible && reproduciendo}
			onclick={() => narrador?.toggle()}
			title="Espacio"
		>
			{reproduciendo ? '⏸' : '▶'}
		</button>

		<footer class="chrome bottom" class:oculto={!chromeVisible}>
			<div class="barra"><div class="relleno" style:width="{progreso * 100}%"></div></div>
			<div class="estado">
				<span>{Math.round(progreso * 100)}%</span>
				<span>~{minutosRestantes} min restantes</span>
			</div>
		</footer>

		<!-- Overlay de ayuda con atajos de teclado -->
		{#if mostrarAyuda}
			<div
				class="overlay"
				role="button"
				tabindex="0"
				onclick={() => (mostrarAyuda = false)}
				onkeydown={(e) => e.key === 'Enter' && (mostrarAyuda = false)}
			>
				<div class="ayuda">
					<h2>Atajos de teclado</h2>
					<dl>
						<dt>Espacio</dt><dd>Reproducir / pausar</dd>
						<dt>→ / ←</dt><dd>Oración siguiente / anterior</dd>
						<dt>↓ / ↑</dt><dd>Capítulo siguiente / anterior</dd>
						<dt>Clic en oración</dt><dd>Saltar a esa oración</dd>
						<dt>?</dt><dd>Mostrar / ocultar esta ayuda</dd>
						<dt>Esc</dt><dd>Cerrar</dd>
					</dl>
					<p class="cerrar">Hacé clic o pulsá Esc para cerrar</p>
				</div>
			</div>
		{/if}
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
		flex: 1;
	}
	.acciones {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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
	.play {
		position: absolute;
		bottom: 3.5rem;
		left: 50%;
		transform: translateX(-50%);
		width: 3.2rem;
		height: 3.2rem;
		border-radius: 50%;
		border: none;
		background: var(--acento);
		color: #fff;
		font-size: 1.3rem;
		cursor: pointer;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
		transition: opacity 0.4s;
		z-index: 3;
	}
	.play.oculto {
		opacity: 0;
		pointer-events: none;
	}
	.panel {
		position: absolute;
		top: 3.2rem;
		right: 1rem;
		z-index: 4;
		background: var(--bg);
		border: 1px solid color-mix(in srgb, var(--muted) 40%, transparent);
		border-radius: 0.6rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		min-width: 14rem;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
	}
	.panel label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		color: var(--fg);
	}
	.panel select,
	.panel input[type='range'] {
		width: 100%;
	}
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 5;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: system-ui, sans-serif;
	}
	.ayuda {
		background: var(--bg);
		color: var(--fg);
		border-radius: 0.8rem;
		padding: 1.5rem 2rem;
		max-width: 22rem;
	}
	.ayuda h2 {
		margin-top: 0;
	}
	.ayuda dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
	}
	.ayuda dt {
		font-weight: 600;
		white-space: nowrap;
	}
	.ayuda dd {
		margin: 0;
		color: var(--muted);
	}
	.cerrar {
		margin-bottom: 0;
		margin-top: 1.2rem;
		font-size: 0.78rem;
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 600px) {
		.oracion {
			font-size: 1.3rem;
		}
	}
</style>
