// Debounce simple: agrupa llamadas seguidas y ejecuta una sola vez tras `ms` de calma.
export function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	ms: number
): (...args: A) => void {
	let t: ReturnType<typeof setTimeout> | undefined;
	return (...args: A) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}
