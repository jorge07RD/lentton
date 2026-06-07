import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	// adapter-cloudflare: toda la app (shell SPA + endpoints /api) se sirve desde un
	// unico _worker.js. Asi /api/* SIEMPRE ejecuta el endpoint (no hay ambiguedad de
	// _routes.json/Functions como con adapter-static). La app sigue siendo 100% cliente
	// (ssr=false en +layout.ts); el worker solo sirve el shell y la API de sync (D1).
	kit: { adapter: adapter() }
};

export default config;
