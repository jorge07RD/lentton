<script lang="ts">
	import { getHealth, API_URL } from '$lib/api';

	// Estado de la comprobacion de conectividad con el servidor TTS (Fase 0).
	let estado = $state<'comprobando' | 'ok' | 'error'>('comprobando');
	let detalle = $state('');

	$effect(() => {
		getHealth()
			.then((r) => {
				estado = 'ok';
				detalle = r.status;
			})
			.catch((e) => {
				estado = 'error';
				detalle = e instanceof Error ? e.message : String(e);
			});
	});
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
</main>

<style>
	main {
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	.health {
		margin-top: 2rem;
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
</style>
