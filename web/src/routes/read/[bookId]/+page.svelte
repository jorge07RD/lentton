<script lang="ts">
	// Lector — diseño del handoff (foco/página, cromo autoocultable, franja, sheet, ayuda).
	// Conserva el backend real: Narrador + Kokoro/WebSpeech + IndexedDB.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getBook, getPosition, savePosition, getSettings, saveSettings } from '$lib/db';
	import { getVoices, VOCES_FALLBACK, API_URL, type Voice } from '$lib/api';
	import { debounce } from '$lib/debounce';
	import { aplanar, parrafosDeCapitulo, type OracionPlana, type Parrafo } from '$lib/progress';
	import { Narrador } from '$lib/narration/controller.svelte';
	import { KokoroProvider } from '$lib/narration/kokoro';
	import { WebSpeechProvider } from '$lib/narration/webspeech';
	import { temaActual, alternarTema } from '$lib/theme.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { NarrationProvider } from '$lib/narration/types';
	import type { Book } from '$lib/types';

	const PPM_PAGINA = 280; // palabras por página estimada
	const WPM = 185; // palabras por minuto (estimación de tiempo)
	const MUESTRA = 'Los ojos verdes, una leyenda.';

	type Modo = 'foco' | 'completo' | 'libro';
	const ETIQUETA_MODO: Record<Modo, string> = {
		foco: 'Modo foco',
		completo: 'Página completa',
		libro: 'Modo libro'
	};

	let book = $state<Book | null>(null);
	let planas = $state<OracionPlana[]>([]);
	let narrador = $state<Narrador | null>(null);
	let cargando = $state(true);
	let modo = $state<Modo>('foco');
	let opts = $state<{ voice: string; speed: number }>({ voice: 'ef_dora', speed: 1 });
	let proveedorId = $state<'kokoro' | 'webspeech'>('kokoro');
	let voces = $state<Voice[]>(VOCES_FALLBACK);
	let ajustesAbierto = $state(false);
	let ayudaAbierta = $state(false);
	let chromeHidden = $state(false);
	let toast = $state('');
	let listo = $state(false);
	let scrollEl = $state<HTMLElement | null>(null);
	let primerCentrado = true;

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
			const s = await getSettings();
			modo = s.mode;
			opts = { voice: s.voice, speed: s.speed };

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
			proveedorId = s.provider;
			// Si Kokoro no responde (sin servidor, p.ej. en el celu), caemos a la voz
			// del navegador automáticamente para que la narración siga funcionando.
			const n = new Narrador(
				proveedores[s.provider] ?? proveedores.kokoro,
				opts,
				proveedores.webspeech,
				() => {
					proveedorId = 'webspeech';
					flash('Sin servidor: voz del navegador');
				}
			);
			n.setContenido(
				lista.map((o) => o.texto),
				inicio
			);

			book = b;
			planas = lista;
			narrador = n;
			cargando = false;
			listo = true;
			getVoices().then((v) => v.length && (voces = v));
		})();
	});

	// --- Persistencia ---
	const guardarPos = debounce((id: string, ci: number, si: number) => {
		savePosition({ bookId: id, chapterIndex: ci, sentenceIndex: si, updatedAt: Date.now() });
	}, 500);
	const guardarPrefs = debounce(async (patch: Record<string, unknown>) => {
		const s = await getSettings();
		await saveSettings({ ...s, ...patch });
	}, 300);

	const idx = $derived(narrador?.idx ?? 0);
	const actual = $derived(planas[idx]);
	const reproduciendo = $derived(narrador?.estado === 'playing');
	const claseModo = $derived(
		modo === 'completo' ? 'mode-full' : modo === 'libro' ? 'mode-book' : 'mode-focus'
	);

	$effect(() => {
		const o = planas[idx];
		if (o && bookId) guardarPos(bookId, o.chapterIndex, o.sentenceIndex);
	});
	$effect(() => {
		if (listo) guardarPrefs({ provider: proveedorId, voice: opts.voice, speed: opts.speed, mode: modo });
	});
	$effect(() => () => narrador?.stop());

	// --- Párrafos del capítulo actual ---
	const parrafos = $derived<Parrafo[]>(
		book && actual ? parrafosDeCapitulo(book, actual.chapterIndex) : []
	);

	// --- Modo Libro: paginación por palabras ---
	const PAGINA_PALABRAS = 230;
	// Índices globales donde empieza un párrafo (para reagrupar en la hoja).
	const inicioParrafo = $derived.by(() => {
		const s = new Set<number>();
		if (!book) return s;
		let base = 0;
		for (const cap of book.chapters) {
			const st = cap.paraStarts?.length ? cap.paraStarts : [0];
			for (const k of st) s.add(base + k);
			base += cap.sentences.length;
		}
		return s;
	});
	// Páginas: cada una es una lista de índices globales de oración.
	const paginasLibro = $derived.by(() => {
		const out: number[][] = [];
		let cur: number[] = [];
		let w = 0;
		for (let i = 0; i < planas.length; i++) {
			// Cortar página en un límite de párrafo si ya pasamos el presupuesto.
			if (w >= PAGINA_PALABRAS && inicioParrafo.has(i) && cur.length) {
				out.push(cur);
				cur = [];
				w = 0;
			}
			cur.push(i);
			w += contarPalabras(planas[i].texto);
		}
		if (cur.length) out.push(cur);
		return out;
	});
	const paginaLibroIdx = $derived(
		Math.max(0, paginasLibro.findIndex((p) => idx >= p[0] && idx <= p[p.length - 1]))
	);
	// Párrafos de la página actual, reagrupados.
	const paginaParrafos = $derived.by<Parrafo[]>(() => {
		const pg = paginasLibro[paginaLibroIdx];
		if (!pg) return [];
		const paras: Parrafo[] = [];
		let curr: Parrafo | null = null;
		for (const gi of pg) {
			if (curr === null || inicioParrafo.has(gi)) {
				curr = { speaker: /^\s*[—«"“-]/.test(planas[gi].texto), sentences: [] };
				paras.push(curr);
			}
			curr.sentences.push({ texto: planas[gi].texto, gi });
		}
		return paras;
	});
	function irPaginaLibro(delta: number) {
		const p = paginaLibroIdx + delta;
		if (p >= 0 && p < paginasLibro.length) narrador?.irA(paginasLibro[p][0]);
		despertar();
	}

	// --- Matemática de progreso ---
	function contarPalabras(s: string): number {
		return s.trim() ? s.trim().split(/\s+/).length : 0;
	}
	const totalPalabras = $derived(planas.reduce((n, o) => n + contarPalabras(o.texto), 0));
	const palabrasHasta = $derived.by(() => {
		let w = 0;
		for (let i = 0; i <= idx && i < planas.length; i++) w += contarPalabras(planas[i].texto);
		return w;
	});
	const frac = $derived(planas.length ? (idx + 1) / planas.length : 0);
	const pct = $derived(Math.round(frac * 100));
	const totalSec = $derived((totalPalabras / (WPM * opts.speed)) * 60);
	const paginas = $derived(Math.max(1, Math.ceil(totalPalabras / PPM_PAGINA)));
	const paginaActual = $derived(
		Math.min(paginas, Math.floor(Math.max(0, palabrasHasta - 1) / PPM_PAGINA) + 1)
	);

	function fmt(sec: number): string {
		sec = Math.max(0, Math.round(sec));
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return m + ':' + String(s).padStart(2, '0');
	}
	function fmtRate(r: number): string {
		return r.toFixed(2).replace(/0$/, '') + '×';
	}

	// Opacidad por distancia a la oración activa (gradiente del modo foco).
	function opacidad(gi: number): number {
		return Math.max(0.06, 1 - Math.abs(gi - idx) * 0.36);
	}

	// --- Centrar la oración activa ---
	function centrar(suave: boolean) {
		const sc = scrollEl;
		if (!sc) return;
		const el = sc.querySelector<HTMLElement>(`[data-gi="${idx}"]`);
		if (!el) return;
		sc.scrollTo({
			top: el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2,
			behavior: suave ? 'smooth' : 'auto'
		});
	}
	let modoPrevio: Modo | null = null;
	let idxPrevio = -1;
	$effect(() => {
		const cambioModo = modo !== modoPrevio;
		const cambioIdx = idx !== idxPrevio;
		void parrafos.length;
		modoPrevio = modo;
		idxPrevio = idx;
		if (modo === 'libro' || !scrollEl) return; // el modo libro pagina, no centra por scroll

		// Solo cambió el modo: la letra y la viñeta animan ~0.6s; un único re-centrado
		// suave al final (sin scroll inmediato que pelee con la animación).
		if (cambioModo && !cambioIdx) {
			const t = setTimeout(() => centrar(true), 620);
			return () => clearTimeout(t);
		}

		// Cambió la oración (o carga inicial): centrar enseguida.
		requestAnimationFrame(() => {
			centrar(!primerCentrado);
			primerCentrado = false;
		});
	});

	// --- Autoocultado del cromo ---
	let timer: ReturnType<typeof setTimeout> | undefined;
	function despertar() {
		chromeHidden = false;
		clearTimeout(timer);
		timer = setTimeout(() => (chromeHidden = true), 2500);
	}
	$effect(() => {
		despertar();
		const fn = () => despertar();
		window.addEventListener('mousemove', fn, { passive: true });
		window.addEventListener('touchstart', fn, { passive: true });
		return () => {
			clearTimeout(timer);
			window.removeEventListener('mousemove', fn);
			window.removeEventListener('touchstart', fn);
		};
	});

	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast === msg ? (toast = '') : null), 1500);
	}
	function setModo(m: Modo) {
		if (modo === m) return;
		modo = m;
		flash(ETIQUETA_MODO[m]);
		despertar();
	}
	function ciclarModo() {
		const orden: Modo[] = ['foco', 'completo', 'libro'];
		setModo(orden[(orden.indexOf(modo) + 1) % orden.length]);
	}

	function onSurfaceClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.sentence')) return;
		chromeHidden = !chromeHidden;
		if (!chromeHidden) despertar();
	}

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement).tagName === 'INPUT') return;
		if (!narrador) return;
		despertar();
		if (e.key === 'Escape') {
			if (ayudaAbierta) ayudaAbierta = false;
			else if (ajustesAbierto) ajustesAbierto = false;
			else goto('/');
			return;
		}
		if (e.key === '?') {
			e.preventDefault();
			ayudaAbierta = !ayudaAbierta;
			return;
		}
		if (e.key === 'f' || e.key === 'F') {
			e.preventDefault();
			ciclarModo();
			return;
		}
		if (e.code === 'Space') {
			e.preventDefault();
			narrador.toggle();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
			e.preventDefault();
			narrador.avanzar();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
			e.preventDefault();
			narrador.retroceder();
		}
	}

	function scrub(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const f = (e.clientX - r.left) / r.width;
		despertar();
		narrador?.irA(Math.round(f * (planas.length - 1)));
	}

	// --- Voz / proveedor ---
	function cambiarProveedor(id: 'kokoro' | 'webspeech') {
		proveedorId = id;
		if (narrador && proveedores[id]) narrador.setProvider(proveedores[id]);
	}
	function elegirVoz(item: { provider: 'kokoro' | 'webspeech'; voice?: string }) {
		if (item.provider === 'kokoro' && item.voice) {
			opts = { ...opts, voice: item.voice };
			narrador?.setOpts(opts);
			if (proveedorId !== 'kokoro') cambiarProveedor('kokoro');
		} else {
			cambiarProveedor('webspeech');
		}
		previsualizar(item.provider, item.voice);
	}
	function setVelocidad(v: number) {
		opts = { ...opts, speed: v };
		narrador?.setOpts(opts);
	}

	let preview: HTMLAudioElement | null = null;
	async function previsualizar(provider: 'kokoro' | 'webspeech', voice?: string) {
		narrador?.pause();
		if (provider === 'webspeech') {
			if (typeof window === 'undefined' || !window.speechSynthesis) return;
			window.speechSynthesis.cancel();
			const u = new SpeechSynthesisUtterance(MUESTRA);
			u.lang = 'es-ES';
			u.rate = opts.speed;
			window.speechSynthesis.speak(u);
			return;
		}
		try {
			preview?.pause();
			const res = await fetch(`${API_URL}/tts`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: MUESTRA, voice, speed: opts.speed })
			});
			if (!res.ok) return;
			const url = URL.createObjectURL(await res.blob());
			preview = new Audio(url);
			preview.onended = () => URL.revokeObjectURL(url);
			preview.play().catch(() => {});
		} catch {
			/* sin servidor: ignorar */
		}
	}

	// Lista de voces para el sheet: voces de Kokoro + opción navegador.
	interface ItemVoz {
		key: string;
		name: string;
		lang: string;
		provider: 'kokoro' | 'webspeech';
		voice?: string;
	}
	const itemsVoz = $derived<ItemVoz[]>([
		...voces.map((v) => ({
			key: v.id,
			name: v.id,
			lang: `español · ${v.gender === 'f' ? 'femenina' : 'masculina'} · Kokoro`,
			provider: 'kokoro' as const,
			voice: v.id
		})),
		{ key: 'webspeech', name: 'Voz del navegador', lang: 'offline · sistema', provider: 'webspeech' }
	]);
	function vozActiva(item: ItemVoz): boolean {
		return proveedorId === 'webspeech'
			? item.provider === 'webspeech'
			: item.provider === 'kokoro' && item.voice === opts.voice;
	}
	function inicial(s: string): string {
		const m = s.match(/[A-Za-zÁÉÍÓÚÑ]/);
		return (m ? m[0] : '·').toUpperCase();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if cargando}
	<p style="text-align:center;margin-top:30vh" class="ink-2">Cargando…</p>
{:else if !book || !narrador}
	<p style="text-align:center;margin-top:30vh" class="ink-2">
		Libro no encontrado. <a href="/" class="ink">Volver a la biblioteca</a>
	</p>
{:else}
	<div
		class="reader route {claseModo}"
		class:chrome-hidden={chromeHidden}
		class:hide-cursor={chromeHidden && reproduciendo}
	>
		{#if modo === 'libro'}
			<!-- Modo libro: hoja de papel paginada -->
			<div class="book-stage">
				<button
					class="leaf-nav prev"
					title="Página anterior"
					aria-label="Página anterior"
					disabled={paginaLibroIdx <= 0}
					onclick={() => irPaginaLibro(-1)}><Icon name="prev" /></button
				>
				{#key paginaLibroIdx}
					<article class="leaf turn">
						{#each paginaParrafos as p, pi (pi)}
							<p class:speaker={p.speaker}>
								{#each p.sentences as s (s.gi)}<span
										class="sentence"
										class:active={s.gi === idx}
										data-gi={s.gi}
										role="button"
										tabindex="-1"
										onclick={() => {
											despertar();
											narrador?.irA(s.gi);
										}}
										onkeydown={() => {}}>{s.texto} </span
									>{/each}
							</p>
						{/each}
						<div class="leaf-foot meta">
							{actual?.chapterTitle} · pág {paginaLibroIdx + 1} / {paginasLibro.length}
						</div>
					</article>
				{/key}
				<button
					class="leaf-nav next"
					title="Página siguiente"
					aria-label="Página siguiente"
					disabled={paginaLibroIdx >= paginasLibro.length - 1}
					onclick={() => irPaginaLibro(1)}><Icon name="next" /></button
				>
			</div>
		{:else}
			<!-- Superficie de lectura (foco / página completa) -->
			<div
				class="read-scroll"
				bind:this={scrollEl}
				onclick={onSurfaceClick}
				onkeydown={() => {}}
				role="presentation"
			>
				<div class="read-col">
					{#each parrafos as p, pi (pi)}
						<p class:speaker={p.speaker}>
							{#each p.sentences as s (s.gi)}<span
									class="sentence"
									class:active={s.gi === idx}
									data-gi={s.gi}
									style:--o={opacidad(s.gi)}
									role="button"
									tabindex="-1"
									onclick={(e) => {
										e.stopPropagation();
										despertar();
										narrador?.irA(s.gi);
									}}
									onkeydown={() => {}}>{s.texto} </span
								>{/each}
						</p>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Franja lateral -->
		<div class="rail">
			<div class="rail-text">{actual?.chapterTitle}</div>
			<div class="rail-prog"><i style:height="{pct}%"></i></div>
			<div class="rail-text">pág {paginaActual} / {paginas}</div>
			<div class="rail-text rail-pct">{pct}%</div>
		</div>

		<!-- Play central -->
		<button
			class="center-play"
			class:playing={reproduciendo}
			class:faded={reproduciendo}
			title={reproduciendo ? 'Pausar (Espacio)' : 'Narrar (Espacio)'}
			onclick={(e) => {
				e.stopPropagation();
				despertar();
				narrador?.toggle();
			}}
		>
			<Icon name={reproduciendo ? 'pause' : 'play'} />
		</button>

		<!-- Cromo superior -->
		<div class="chrome chrome-top">
			<button class="iconbtn" onclick={() => goto('/')} title="Biblioteca (Esc)" aria-label="Biblioteca">
				<Icon name="back" />
			</button>
			<div class="chrome-title">
				<div class="t">{book.title}</div>
				{#if book.author}<div class="a">{book.author}</div>{/if}
			</div>
			<div class="chrome-grp">
				<div class="modeswitch">
					<button class={modo === 'foco' ? 'on' : ''} onclick={() => setModo('foco')} title="Foco">
						<Icon name="focus" /> Foco
					</button>
					<button
						class={modo === 'completo' ? 'on' : ''}
						onclick={() => setModo('completo')}
						title="Página completa"
					>
						<Icon name="page" /> Página
					</button>
					<button class={modo === 'libro' ? 'on' : ''} onclick={() => setModo('libro')} title="Libro">
						<Icon name="book" /> Libro
					</button>
				</div>
				<button class="iconbtn" onclick={alternarTema} title="Tema" aria-label="Tema">
					<Icon name={temaActual() === 'dark' ? 'sun' : 'moon'} />
				</button>
				<button class="iconbtn" onclick={() => (ayudaAbierta = true)} title="Ayuda (?)" aria-label="Ayuda">
					<Icon name="help" />
				</button>
				<button
					class="iconbtn"
					onclick={() => (ajustesAbierto = true)}
					title="Ajustes de voz"
					aria-label="Ajustes"
				>
					<Icon name="settings" />
				</button>
			</div>
		</div>

		<!-- Cromo inferior: transporte -->
		<div class="chrome chrome-bottom">
			<div class="transport">
				<div class="transport-bar">
					<div class="transport-time">{fmt(frac * totalSec)}</div>
					<div
						class="scrub"
						onclick={scrub}
						onkeydown={() => {}}
						role="slider"
						aria-label="Progreso"
						aria-valuenow={pct}
						tabindex="-1"
					>
						<div class="scrub-fill" style:width="{pct}%"></div>
						<div class="scrub-knob" style:left="{pct}%"></div>
					</div>
					<div class="transport-time r">{fmt(totalSec)}</div>
				</div>
				<div class="transport-controls">
					<button
						class="iconbtn"
						onclick={() => narrador?.retroceder()}
						title="Oración anterior"
						aria-label="Oración anterior"><Icon name="prev" /></button
					>
					<button
						class="iconbtn"
						style="width:46px;height:46px;color:var(--accent)"
						onclick={() => narrador?.toggle()}
						aria-label="Reproducir/pausar"
					>
						<Icon name={reproduciendo ? 'pause' : 'play'} />
					</button>
					<button
						class="iconbtn"
						onclick={() => narrador?.avanzar()}
						title="Oración siguiente"
						aria-label="Oración siguiente"><Icon name="next" /></button
					>
					<button class="speed-chip" onclick={() => (ajustesAbierto = true)} title="Velocidad">
						{fmtRate(opts.speed)}
					</button>
				</div>
			</div>
		</div>

		<!-- Sheet de ajustes -->
		<div
			class="scrim"
			class:in={ajustesAbierto}
			class:hidden-file={!ajustesAbierto}
			onclick={() => (ajustesAbierto = false)}
			role="presentation"
		></div>
		<aside class="sheet" class:in={ajustesAbierto} aria-label="Ajustes de narración">
			<div class="sheet-head">
				<h3>Ajustes</h3>
				<button class="iconbtn" onclick={() => (ajustesAbierto = false)} aria-label="Cerrar">
					<Icon name="close" />
				</button>
			</div>
			<div class="sheet-body">
				<div class="set-group">
					<div class="set-label"><span class="l">Tema</span></div>
					<div class="seg">
						<button
							class={temaActual() === 'light' ? 'on' : ''}
							onclick={() => temaActual() !== 'light' && alternarTema()}><Icon name="sun" /> Claro</button
						>
						<button
							class={temaActual() === 'dark' ? 'on' : ''}
							onclick={() => temaActual() !== 'dark' && alternarTema()}><Icon name="moon" /> Oscuro</button
						>
					</div>
				</div>

				<div class="set-group">
					<div class="set-label">
						<span class="l">Velocidad de lectura</span>
						<span class="v">{fmtRate(opts.speed)}</span>
					</div>
					<input
						type="range"
						class="slider"
						min="0.5"
						max="2"
						step="0.05"
						value={opts.speed}
						oninput={(e) => setVelocidad(Number(e.currentTarget.value))}
					/>
					<div class="slider-ticks"><span>0,5×</span><span>1×</span><span>1,5×</span><span>2×</span></div>
				</div>

				<div class="set-group">
					<div class="set-label">
						<span class="l">Voz</span>
						<span class="v">{voces.length} disponibles</span>
					</div>
					<div class="voice-list">
						{#each itemsVoz as item (item.key)}
							<button
								class="voice"
								class:on={vozActiva(item)}
								data-voz={item.key}
								onclick={() => elegirVoz(item)}
							>
								<div class="voice-ava">{inicial(item.name)}</div>
								<div class="voice-info">
									<div class="voice-name">{item.name}</div>
									<div class="voice-lang">{item.lang}</div>
								</div>
								<div
									class="voice-play"
									role="button"
									tabindex="-1"
									aria-label="Previsualizar"
									onclick={(e) => {
										e.stopPropagation();
										previsualizar(item.provider, item.voice);
									}}
									onkeydown={() => {}}
								>
									<Icon name="volume" />
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</aside>

		<!-- Ayuda -->
		{#if ayudaAbierta}
			<div
				class="help in"
				onclick={() => (ayudaAbierta = false)}
				onkeydown={() => {}}
				role="presentation"
			>
				<div
					class="help-card"
					onclick={(e) => e.stopPropagation()}
					onkeydown={() => {}}
					role="dialog"
					tabindex="-1"
				>
					<h2>Cómo leer en Lentton</h2>
					<p class="lead">
						Una sola cosa a la vez. El texto se atenúa alrededor de la oración que suena; todo lo
						demás se aparta.
					</p>
					<div class="help-group">
						<h4>Narración</h4>
						<div class="kbd-row">
							<span class="desc">Reproducir o pausar la voz</span>
							<span class="kbd-keys"><span class="kbd">Espacio</span></span>
						</div>
						<div class="kbd-row">
							<span class="desc">Oración siguiente / anterior</span>
							<span class="kbd-keys"><span class="kbd">↑</span><span class="kbd">↓</span></span>
						</div>
						<div class="kbd-row">
							<span class="desc">Tocá una oración para saltar a ella</span>
							<span class="kbd-keys"><span class="kbd">Clic</span></span>
						</div>
					</div>
					<div class="help-group">
						<h4>Vista</h4>
						<div class="kbd-row">
							<span class="desc">Alternar foco y página completa</span>
							<span class="kbd-keys"><span class="kbd">F</span></span>
						</div>
						<div class="kbd-row">
							<span class="desc">Mostrar u ocultar los controles</span>
							<span class="kbd-keys"><span class="kbd">Toque</span></span>
						</div>
						<div class="kbd-row">
							<span class="desc">Volver a la biblioteca</span>
							<span class="kbd-keys"><span class="kbd">Esc</span></span>
						</div>
					</div>
					<p class="help-hint">Los controles se ocultan solos mientras leés. Movés y vuelven.</p>
				</div>
			</div>
		{/if}

		<div class="toast" class:in={toast}>{toast}</div>
	</div>
{/if}
