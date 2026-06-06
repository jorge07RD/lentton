// Tema global: aplica data-theme al documento y lo persiste en settings (IndexedDB).
// Compartido por biblioteca y lector.
import { getSettings, saveSettings } from './db';

let efectivo = $state<'light' | 'dark'>('light');

/** Tema aplicado actualmente ('light' | 'dark'). Reactivo. */
export function temaActual(): 'light' | 'dark' {
	return efectivo;
}

function aplicar(t: 'light' | 'dark') {
	efectivo = t;
	if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
}

/** Inicializa desde settings; 'auto' se resuelve según el sistema. */
export async function initTema(): Promise<void> {
	const s = await getSettings();
	let t: 'light' | 'dark';
	if (s.theme === 'auto') {
		t =
			typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';
	} else {
		t = s.theme;
	}
	aplicar(t);
}

/** Alterna claro/oscuro y lo guarda. */
export async function alternarTema(): Promise<void> {
	const nuevo = efectivo === 'dark' ? 'light' : 'dark';
	aplicar(nuevo);
	const s = await getSettings();
	await saveSettings({ ...s, theme: nuevo });
}
