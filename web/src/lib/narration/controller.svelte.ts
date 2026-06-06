// Controlador de reproducción: máquina de estados (idle | playing | paused).
// Reproduce la oración i, prefetchea i+1 e i+2, y al terminar avanza a i+1.
import type { NarrationProvider, SpeakOpts } from './types';

export type EstadoNarrador = 'idle' | 'playing' | 'paused';

export class Narrador {
	estado = $state<EstadoNarrador>('idle');
	idx = $state(0);

	private provider: NarrationProvider;
	private textos: string[] = [];
	private opts: SpeakOpts = {};
	// "Época": cada salto / cambio de proveedor la incrementa para cancelar bucles viejos.
	private epoca = 0;

	constructor(provider: NarrationProvider, opts: SpeakOpts) {
		this.provider = provider;
		this.opts = opts;
	}

	setContenido(textos: string[], idxInicial = 0): void {
		this.textos = textos;
		this.idx = Math.max(0, Math.min(idxInicial, textos.length - 1));
	}

	setOpts(opts: SpeakOpts): void {
		this.opts = opts;
	}

	get providerId(): NarrationProvider['id'] {
		return this.provider.id;
	}

	/** Cambia de proveedor en caliente, reanudando si estaba sonando. */
	setProvider(provider: NarrationProvider): void {
		const activo = this.estado === 'playing';
		this.provider.stop();
		this.epoca++;
		this.estado = 'idle';
		this.provider = provider;
		if (activo) this.play();
	}

	/** Arranca (o continúa) la lectura encadenada desde idx. */
	async play(): Promise<void> {
		if (this.estado === 'playing') return;
		this.estado = 'playing';
		const epoca = ++this.epoca;

		while (this.estado === 'playing' && this.idx < this.textos.length && epoca === this.epoca) {
			const i = this.idx;
			// Prefetch de las siguientes para no dejar huecos entre oraciones.
			this.provider.prefetch(this.textos[i + 1] ?? '', this.opts);
			this.provider.prefetch(this.textos[i + 2] ?? '', this.opts);

			try {
				await this.provider.play(this.textos[i], this.opts);
			} catch {
				break;
			}

			// Si entretanto hubo salto/cambio/stop, abandonar este bucle.
			if (epoca !== this.epoca) return;
			if (this.estado !== 'playing') return;
			// Avanzar solo si el usuario no saltó manualmente durante la reproducción.
			if (this.idx === i) this.idx = i + 1;
		}

		if (epoca === this.epoca && this.idx >= this.textos.length) {
			this.idx = this.textos.length - 1;
			this.estado = 'idle';
		}
	}

	pause(): void {
		if (this.estado === 'playing') {
			this.estado = 'paused';
			this.provider.pause();
		}
	}

	resume(): void {
		if (this.estado === 'paused') {
			this.estado = 'playing';
			this.provider.resume();
		}
	}

	/** Espacio: alterna entre reproducir, pausar y reanudar. */
	toggle(): void {
		if (this.estado === 'playing') this.pause();
		else if (this.estado === 'paused') this.resume();
		else this.play();
	}

	/** Salta a una oración. Reanuda la reproducción si estaba activa. */
	irA(i: number): void {
		const objetivo = Math.max(0, Math.min(i, this.textos.length - 1));
		const activo = this.estado === 'playing';
		this.provider.stop();
		this.epoca++;
		this.estado = 'idle';
		this.idx = objetivo;
		if (activo) this.play();
	}

	avanzar(): void {
		this.irA(this.idx + 1);
	}
	retroceder(): void {
		this.irA(this.idx - 1);
	}

	stop(): void {
		this.provider.stop();
		this.epoca++;
		this.estado = 'idle';
	}
}
