// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="@cloudflare/workers-types" />
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			// Bindings de Cloudflare Pages disponibles en los endpoints /api (event.platform.env).
			env: {
				DB: D1Database;
				SYNC_KEY?: string;
			};
		}
	}
}

export {};
