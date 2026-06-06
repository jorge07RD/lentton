// Proveedor de narración con la Web Speech API del navegador (fallback offline).
// prefetch es no-op; play resuelve en onend. onboundary queda para karaoke futuro.
import type { NarrationProvider, SpeakOpts } from './types';

export class WebSpeechProvider implements NarrationProvider {
	id = 'webspeech' as const;
	label = 'Voz del navegador';

	private settle: (() => void) | null = null;

	prefetch(): void {
		// No aplica: la Web Speech API sintetiza al vuelo.
	}

	async play(text: string, opts: SpeakOpts): Promise<void> {
		const synth = window.speechSynthesis;
		synth.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = 'es-ES';
		if (opts.speed) u.rate = opts.speed;
		// Intentar una voz en español si está disponible.
		const voz = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('es'));
		if (voz) u.voice = voz;
		await new Promise<void>((resolve) => {
			this.settle = resolve;
			u.onend = () => this.settle?.();
			u.onerror = () => this.settle?.();
			synth.speak(u);
		});
		this.settle = null;
	}

	pause(): void {
		window.speechSynthesis.pause();
	}

	resume(): void {
		window.speechSynthesis.resume();
	}

	stop(): void {
		const s = this.settle;
		this.settle = null;
		window.speechSynthesis.cancel();
		s?.();
	}
}
