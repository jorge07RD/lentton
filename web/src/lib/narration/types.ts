// Interfaz común de los proveedores de narración (clave para conmutar en caliente).

export interface SpeakOpts {
	voice?: string;
	speed?: number; // 0.5 – 2.0
}

export interface NarrationProvider {
	id: 'kokoro' | 'webspeech';
	label: string;
	/** Pre-genera/descarga el audio sin reproducir. No-op si no aplica. */
	prefetch(text: string, opts: SpeakOpts): void;
	/** Reproduce la oración. La promesa resuelve cuando TERMINA de hablar. */
	play(text: string, opts: SpeakOpts): Promise<void>;
	pause(): void;
	resume(): void;
	stop(): void;
}
