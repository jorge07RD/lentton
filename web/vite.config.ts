import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		// PWA: por ahora manifest minimo + autoUpdate. El precache offline real se afina en la Fase 6.
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Lentton — Lector con foco',
				short_name: 'Lentton',
				description: 'Lectura con foco y narracion por voz, oracion a oracion.',
				theme_color: '#111111',
				background_color: '#111111',
				display: 'standalone',
				lang: 'es',
				icons: [
					{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
				]
			}
		})
	]
});
