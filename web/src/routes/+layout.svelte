<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { initTema } from '$lib/theme.svelte';
	// Estilos globales (tokens del handoff de diseño).
	import '$lib/styles/lentton.css';
	import '$lib/styles/library.css';
	import '$lib/styles/reader.css';

	let { children } = $props();

	onMount(() => {
		initTema();
		// Registrar el service worker de la PWA (Workbox genera /sw.js en el build).
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch(() => {});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
