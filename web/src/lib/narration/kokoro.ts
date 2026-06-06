// Proveedor de narración con Kokoro (servidor FastAPI). Cachea los Blob por
// hash text+voice+speed y prefetchea las siguientes oraciones para no dejar huecos.
import { API_URL } from '$lib/api';
import type { NarrationProvider, SpeakOpts } from './types';

export class KokoroProvider implements NarrationProvider {
	id = 'kokoro' as const;
	label = 'Kokoro (servidor)';

	// Caché de blobs por clave. Guardamos la promesa para deduplicar peticiones en vuelo.
	private cache = new Map<string, Promise<Blob>>();
	private audio: HTMLAudioElement | null = null;
	private url: string | null = null;
	private settle: (() => void) | null = null;

	private clave(text: string, opts: SpeakOpts): string {
		return `${text}|${opts.voice ?? ''}|${opts.speed ?? 1}`;
	}

	/** Pide (o reutiliza de caché) el audio de una oración como Blob. */
	private pedir(text: string, opts: SpeakOpts): Promise<Blob> {
		const k = this.clave(text, opts);
		let p = this.cache.get(k);
		if (!p) {
			p = fetch(`${API_URL}/tts`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text, voice: opts.voice, speed: opts.speed })
			}).then((r) => {
				if (!r.ok) throw new Error(`TTS ${r.status}`);
				return r.blob();
			});
			// Si falla, no dejar la promesa rota cacheada: permitir reintento.
			p.catch(() => this.cache.delete(k));
			this.cache.set(k, p);
		}
		return p;
	}

	prefetch(text: string, opts: SpeakOpts): void {
		if (text) this.pedir(text, opts).catch(() => {});
	}

	async play(text: string, opts: SpeakOpts): Promise<void> {
		const blob = await this.pedir(text, opts);
		this.detener(); // limpiar audio anterior
		const url = URL.createObjectURL(blob);
		this.url = url;
		const a = new Audio(url);
		this.audio = a;
		await new Promise<void>((resolve) => {
			this.settle = resolve;
			a.onended = () => this.settle?.();
			a.onerror = () => this.settle?.();
			// REVISAR: el navegador bloquea autoplay sin gesto; play() debe nacer de un click/tecla.
			a.play().catch(() => this.settle?.());
		});
		this.settle = null;
		this.detener();
	}

	/** Pausa y libera el audio actual (sin resolver la promesa pendiente). */
	private detener(): void {
		if (this.audio) {
			this.audio.pause();
			this.audio.onended = null;
			this.audio.onerror = null;
			this.audio = null;
		}
		if (this.url) {
			URL.revokeObjectURL(this.url);
			this.url = null;
		}
	}

	pause(): void {
		this.audio?.pause();
	}

	resume(): void {
		this.audio?.play().catch(() => {});
	}

	stop(): void {
		const s = this.settle;
		this.settle = null;
		this.detener();
		s?.(); // resolver la promesa pendiente para que el bucle del controlador continúe
	}
}
