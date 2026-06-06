<script lang="ts">
	// Set de iconos de trazo fino (portado del handoff de diseño). Heredan currentColor.
	// El tamaño lo fija el contexto via CSS (.iconbtn svg, .center-play svg, etc.).
	type Nombre =
		| 'play'
		| 'pause'
		| 'back'
		| 'prev'
		| 'next'
		| 'settings'
		| 'help'
		| 'close'
		| 'focus'
		| 'page'
		| 'sun'
		| 'moon'
		| 'plus'
		| 'search'
		| 'volume';

	let { name }: { name: Nombre } = $props();
</script>

{#if name === 'play'}
	<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M8 5.6c0-.86.94-1.39 1.67-.93l9.2 5.9c.7.45.7 1.48 0 1.93l-9.2 5.9c-.73.46-1.67-.07-1.67-.93V5.6Z" />
	</svg>
{:else if name === 'pause'}
	<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<rect x="6.5" y="5" width="3.6" height="14" rx="1.3" />
		<rect x="13.9" y="5" width="3.6" height="14" rx="1.3" />
	</svg>
{:else}
	<svg
		class="ic"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={name === 'help' ? 1.6 : 1.6}
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if name === 'back'}
			<path d="M14.5 5 8 12l6.5 7" />
		{:else if name === 'prev'}
			<path d="M11 6 5 12l6 6" /><path d="M19 6l-6 6 6 6" />
		{:else if name === 'next'}
			<path d="M13 6l6 6-6 6" /><path d="M5 6l6 6-6 6" />
		{:else if name === 'settings'}
			<circle cx="12" cy="12" r="2.6" />
			<path
				d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M19.8 7.5l-1.9 1.1M6.1 15.4l-1.9 1.1"
			/>
		{:else if name === 'help'}
			<circle cx="12" cy="12" r="9" />
			<path d="M9.4 9.2a2.6 2.6 0 0 1 5 .8c0 1.7-2.4 2-2.4 3.6" />
			<path d="M12 17.3h.01" stroke-width="2" />
		{:else if name === 'close'}
			<path d="M6 6l12 12M18 6 6 18" />
		{:else if name === 'focus'}
			<circle cx="12" cy="12" r="3" />
			<path d="M5 5h2M17 5h2M5 19h2M17 19h2M12 4.5v1M12 18.5v1" />
		{:else if name === 'page'}
			<rect x="5" y="4" width="14" height="16" rx="1.6" />
			<path d="M8.4 8.5h7.2M8.4 12h7.2M8.4 15.5h4.5" />
		{:else if name === 'sun'}
			<circle cx="12" cy="12" r="4" />
			<path
				d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4"
			/>
		{:else if name === 'moon'}
			<path d="M20 13.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 9.5Z" />
		{:else if name === 'plus'}
			<path d="M12 5v14M5 12h14" />
		{:else if name === 'search'}
			<circle cx="11" cy="11" r="6.2" /><path d="m20 20-3.6-3.6" />
		{:else if name === 'volume'}
			<path d="M5 9.5h3l4-3.2v11.4l-4-3.2H5z" />
			<path d="M15.5 9.2a3.4 3.4 0 0 1 0 5.6" />
		{/if}
	</svg>
{/if}
