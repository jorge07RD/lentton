import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		// PWA: precache del shell + fallback de navegación para que la app y los
		// libros guardados (IndexedDB) abran sin conexión. Web Speech es la voz offline.
		SvelteKitPWA({
			registerType: 'autoUpdate',
			workbox: {
				// Precachear los assets construidos (JS/CSS/iconos).
				globPatterns: ['**/*.{js,css,svg,ico,png,woff,woff2,webmanifest}'],
				// El index.html (fallback SPA) lo escribe adapter-static DESPUÉS de vite-pwa,
				// así que no entra por glob. Lo añadimos a mano: workbox lo descarga ('/')
				// al instalar y navigateFallback lo sirve para cualquier ruta offline.
				additionalManifestEntries: [{ url: '/', revision: `${Date.now()}` }],
				navigateFallback: '/',
				// No usar el fallback para las peticiones al servidor TTS.
				navigateFallbackDenylist: [/^\/tts/, /^\/voices/, /^\/health/]
			},
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
