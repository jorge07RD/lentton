// App 100% cliente: sin SSR (usamos IndexedDB, Intl.Segmenter, etc. en el navegador).
// El adapter-static genera un fallback index.html para servir las rutas dinamicas.
export const ssr = false;
export const prerender = false;
