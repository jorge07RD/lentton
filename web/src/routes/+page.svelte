<script lang="ts">
	import { getHealth, API_URL } from '$lib/api';
	import { parseEpub } from '$lib/epub/parseEpub';
	import type { Book } from '$lib/types';

	// Estado de la comprobación de conectividad con el servidor TTS (Fase 0).
	let estado = $state<'comprobando' | 'ok' | 'error'>('comprobando');
	let detalle = $state('');

	$effect(() => {
		getHealth()
			.then((r) => ((estado = 'ok'), (detalle = r.status)))
			.catch((e) => ((estado = 'error'), (detalle = e instanceof Error ? e.message : String(e))));
	});

	// Verificación de parseo de EPUB (Fase 1). Se reemplaza por la biblioteca en la Fase 2.
	let libro = $state<Book | null>(null);
	let parseando = $state(false);
	let errorParseo = $state('');
	let coverUrl = $state<string | null>(null);

	async function alSubir(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		parseando = true;
		errorParseo = '';
		libro = null;
		if (coverUrl) URL.revokeObjectURL(coverUrl);
		coverUrl = null;
		try {
			libro = await parseEpub(file);
			if (libro.cover) coverUrl = URL.createObjectURL(libro.cover);
		} catch (err) {
			errorParseo = err instanceof Error ? err.message : String(err);
		} finally {
			parseando = false;
		}
	}

	const totalOraciones = $derived(
		libro ? libro.chapters.reduce((n, c) => n + c.sentences.length, 0) : 0
	);
</script>

<main>
	<h1>Lentton</h1>
	<p>Lector con foco y narración por voz.</p>

	<section class="health" data-estado={estado}>
		{#if estado === 'comprobando'}
			<span>Comprobando servidor en {API_URL}…</span>
		{:else if estado === 'ok'}
			<span>✓ Servidor TTS: {detalle}</span>
		{:else}
			<span>✗ Sin conexión con {API_URL} ({detalle})</span>
		{/if}
	</section>

	<section class="subir">
		<label>
			<strong>Subir EPUB</strong>
			<input type="file" accept=".epub,application/epub+zip" onchange={alSubir} />
		</label>
		{#if parseando}<p>Parseando…</p>{/if}
		{#if errorParseo}<p class="error">Error: {errorParseo}</p>{/if}
	</section>

	{#if libro}
		<section class="resultado">
			<header>
				{#if coverUrl}<img src={coverUrl} alt="Portada" class="cover" />{/if}
				<div>
					<h2>{libro.title}</h2>
					{#if libro.author}<p class="autor">{libro.author}</p>{/if}
					<p class="meta">
						{libro.chapters.length} capítulos · {totalOraciones} oraciones
					</p>
				</div>
			</header>

			{#each libro.chapters as cap, i (i)}
				<details open={i === 0}>
					<summary>{cap.title} ({cap.sentences.length})</summary>
					<div class="parrafo">
						{#each cap.sentences as o, j (j)}<span class="oracion">{o} </span>{/each}
					</div>
				</details>
			{/each}
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 45rem;
		margin: 3rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	.health {
		margin-top: 1.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #f0f0f0;
	}
	.health[data-estado='ok'] {
		background: #e6f6e6;
	}
	.health[data-estado='error'] {
		background: #fbe6e6;
	}
	.subir {
		margin: 1.5rem 0;
	}
	.subir label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.error {
		color: #b00020;
	}
	.resultado header {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.cover {
		width: 90px;
		height: auto;
		border-radius: 4px;
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
	}
	.autor {
		color: #555;
		margin: 0.25rem 0;
	}
	.meta {
		color: #888;
		font-size: 0.9rem;
	}
	details {
		margin: 0.5rem 0;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.5rem;
	}
	summary {
		cursor: pointer;
		font-weight: 600;
	}
	.parrafo {
		margin-top: 0.5rem;
		line-height: 1.7;
	}
	.oracion:nth-child(even) {
		background: #f5f5f5;
	}
</style>
