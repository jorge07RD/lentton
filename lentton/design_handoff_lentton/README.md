# Handoff: Lentton — lectura con foco y narración por voz

## Overview
**Lentton** es una app web de lectura (responsive + PWA) cuya filosofía es *mínimo en pantalla, calma, tipografía protagonista*. Permite leer libros con la vista o dejar que una voz los narre, oración por oración. El diseño cubre 5 pantallas/estados:

1. **Biblioteca** — grilla de portadas tipográficas (portada/título/autor/% de progreso) + estado vacío.
2. **Lector — modo foco** — la oración actual a opacidad plena, las vecinas atenuadas en gradiente, botón play central, cromo superior/inferior autoocultable, franja lateral sutil con capítulo · página · %.
3. **Lector — modo página completa** — todo el texto legible; transición fluida foco↔completo.
4. **Panel de Ajustes** — voz y velocidad de narración (+ tema).
5. **Overlay de Ayuda** — atajos de teclado y gestos.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML/CSS/React (vía Babel en el navegador)** — un prototipo que muestra el aspecto y el comportamiento buscados, **no código de producción para copiar tal cual**. La tarea es **recrear este diseño dentro del entorno del codebase destino** (React, Vue, Svelte, SwiftUI, etc.) usando sus patrones y librerías establecidas. Si todavía no hay un entorno, elegí el framework más apropiado (sugerencia: React + Vite o Next.js, con CSS variables o Tailwind) e implementalo ahí.

El prototipo ya es funcional: incluye un motor de narración real con `window.speechSynthesis` (con fallback temporizado cuando no hay voces del sistema), segmentación de oraciones con `Intl.Segmenter`, persistencia en `localStorage` y un panel de "Tweaks" para ajustar tokens en vivo. Todo esto es buen material de referencia para la implementación real.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciado, animaciones y microinteracciones son finales. Recreá la UI con precisión usando las librerías del codebase. Los valores exactos están en *Design Tokens* más abajo.

---

## Design Tokens

### Tipografía
- **Serif del cuerpo (protagonista):** `Newsreader` (Google Fonts), con cursivas. Stacks alternativos soportados por el prototipo: `Spectral`, `Literata`, `Source Serif 4`. Fallback: `Georgia, serif`.
- **Sans de microetiquetas (único uso de sans):** `Hanken Grotesk`. Solo para etiquetas técnicas en mayúsculas (capítulo · página · % · controles · ticks). Fallback: `ui-sans-serif, system-ui`.
- **Cuerpo de lectura:** tamaño `21px` (ajustable 16–28px), `line-height: 1.72`, `font-weight: 420`, `letter-spacing: -.003em`, `text-wrap: pretty`, `hanging-punctuation: first last`.
- **Ancho de columna:** `34rem` (≈ 65 caracteres), ajustable 26–44rem.
- **Jerarquía por OPACIDAD, no por color.** Helpers de tinta sobre `--ink-rgb`:
  - `ink` 1.0 · `ink-1` .92 · `ink-2` .62 · `ink-3` .40 · `ink-4` .26
- **Microetiqueta `.meta`:** Hanken Grotesk, `11px`, `font-weight 500`, `letter-spacing .14em`, `text-transform: uppercase`, color `ink / .42`.

### Color — Tema claro ("papel cálido")
| Token | Valor |
|---|---|
| `--bg` (fondo) | `#f4efe5` |
| `--bg-2` (pozos hundidos) | `#efe9dc` |
| `--surface` (tarjetas elevadas) | `#fbf8f1` |
| `--surface-2` | `#ffffff` |
| `--ink-rgb` (texto, warm near-black) | `38 33 26` |
| `--hairline` | `rgba(38,33,26,.10)` |
| `--hairline-strong` | `rgba(38,33,26,.16)` |
| `--scrim` | `rgba(34,30,23,.34)` |

### Color — Tema oscuro ("tinta cálida")
| Token | Valor |
|---|---|
| `--bg` | `#14130e` |
| `--bg-2` | `#100f0b` |
| `--surface` | `#1c1a14` |
| `--surface-2` | `#221f18` |
| `--ink-rgb` (warm off-white) | `236 230 217` |
| `--hairline` | `rgba(236,230,217,.12)` |
| `--hairline-strong` | `rgba(236,230,217,.20)` |
| `--scrim` | `rgba(8,7,5,.58)` |

### Acento (verde ÚNICO, usado con mesura: play, progreso, foco)
- Por defecto `--accent: #1f7a5c`. Alternativas curadas: `#2f7d4f`, `#207d6e`, `#5a6e35`.
- Texto sobre acento: `--accent-ink: #ffffff`.
- Usar el acento solo en: botón play, relleno de progreso, oración/palabra activa, % de la franja, voz seleccionada, CTA primario. **Nunca** como color de fondo amplio ni en texto de lectura.

### Sombras
- `--shadow-card` (claro): `0 1px 2px rgba(38,33,26,.05), 0 8px 24px -12px rgba(38,33,26,.18)`
- `--shadow-float` (claro): `0 2px 6px rgba(38,33,26,.10), 0 18px 50px -16px rgba(38,33,26,.32)`
- (oscuro) ver `lentton.css` — sombras más profundas sobre negro.

### Radios
- Portada: `4px 7px 7px 4px` (insinúa lomo de libro).
- Tarjetas/voces: `12px`. Sheets: `20px` (borde superior en mobile). Help card: `20px`.
- Botones / chips / pills / play: `999px` (totalmente redondeado).

### Motion (easings + duraciones)
- `--ease: cubic-bezier(.4,0,.2,1)` · `--ease-out: cubic-bezier(.16,1,.3,1)`
- Atenuado de oración (foco): `opacity .55s var(--ease)`.
- Cromo autoocultable: `opacity .5s` + `translateY(±12px) .5s var(--ease)`.
- Hover de portada: `transform: translateY(-5px) .35s var(--ease-out)`.
- Sheet de ajustes: `transform .42s var(--ease-out)` (entra desde la derecha; desde abajo en mobile).
- Help overlay: scrim `opacity .32s`; tarjeta `transform translateY(14px) scale(.985) → none .42s`.
- Pulso del play activo: `@keyframes breathe` 3.4s, anillo de acento que se expande y desvanece.
- Entrada de ruta: `@keyframes routein` (opacity 0→1, translateY 6px→0) .5s — **importante:** el estado base es visible; la animación solo se aplica bajo `prefers-reduced-motion: no-preference`, para no quedar en opacity 0 en entornos sin animación.

---

## Screens / Views

### 1. Biblioteca
- **Propósito:** elegir un libro para leer/narrar.
- **Layout:** contenedor `max-width: 1040px`, centrado, padding fluido `clamp(28px,6vh,64px) clamp(22px,5vw,56px) 96px`. Scroll vertical propio.
- **Encabezado (`.lib-head`):** flex, `align-items: flex-end`, `space-between`.
  - **Wordmark:** `lentton` en serif `26px`, weight 500, `letter-spacing -.01em`, con un punto de acento (`.dot`, 9×9px, redondo, `--accent`) al final del nombre. Subtítulo en cursiva `15px` ink/.5: *"Leé con la vista. O dejá que te lean."*
  - **Acciones (derecha):** iconos `.iconbtn` (42×42, redondos): Buscar, Tema (sol/luna), Añadir (+). Hover: `background: ink/.06`, color sube a ink/.9; active `scale(.94)`.
- **Secciones:** etiqueta `.meta` ("Seguir leyendo" para libros 0<progreso<1; "Tu estantería" para el resto).
- **Grilla (`.grid`):** `repeat(auto-fill, minmax(168px, 1fr))`, gap `clamp(20px,3vw,36px) clamp(18px,2.4vw,30px)`.
- **Tarjeta de libro (`.book`):** columna, gap 12px. Botón sin estilo.
  - **Portada (`.cover`):** `aspect-ratio: 2/3`, radio de lomo, sombra `--shadow-card`. Fondo de color sólido por libro (paleta tipográfica, ver abajo) con texto claro encima. Pseudo-elementos: `::before` = brillo de lomo (gradiente oscuro en los primeros 7px a la izquierda); `::after` = emboss diagonal sutil. Contenido: título `19px`/500/`line-height 1.16`, subtítulo opcional en cursiva, regla de 26×1.5px (`.cover-rule`, opacity .4), autor en cursiva `11.5px`. Hover: `translateY(-5px)` + `--shadow-float`.
  - **Meta (`.book-meta`):** título `15.5px`/500 ink/.9; autor en cursiva `13px` ink/.5.
  - **Progreso (`.progress`):** track de 2px (`ink/.12`) con relleno `--accent`; a la derecha `%` en Hanken `10.5px` tabular. Estados: `✓` si 100%, `Nuevo` (en color acento) si 0%, `NN%` en progreso.
- **Estado vacío (`.empty`):** centrado. Marca SVG de dos libros abiertos enfrentados (92×92, stroke 1.4, color ink/.3). Título `25px`/500 *"Tu biblioteca espera"*. Párrafo en cursiva `16px` ink/.52. CTA `.btn .btn-accent`: *"Añadir un libro"* con icono +.

#### Paletas de portada (`[fondo, tinta]`)
`sage [#3f5848,#eef2ea]` · `clay [#9a5b43,#fbeee6]` · `ink [#27303a,#e9edf2]` · `plum [#5a3f54,#f3e9f0]` · `ochre [#a9853e,#fbf3df]` · `slate [#46555c,#eaf1f3]` · `rust [#8a4a3a,#f8e9e3]` · `forest [#2f5340,#e7f0e9]` · `sand [#bfa06a,#3a2e18]` · `teal [#2d5a55,#e4f1ef]`

### 2. Lector — modo foco
- **Propósito:** leer/escuchar con foco total en la oración actual.
- **Superficie (`.read-scroll`):** absolute inset:0, scroll vertical, scrollbar oculta. Columna `.read-col` centrada al ancho de medida, padding vertical `46vh … 52vh` (para que la primera/última oración puedan centrarse).
- **Párrafos:** `margin-bottom: 1.05em`, `text-indent: 1.3em` (primer párrafo sin sangría). Párrafos de diálogo (`.speaker`): sin sangría, en cursiva.
- **Oración (`.sentence`):** unidad de foco. En foco, cada oración recibe `--o` (opacidad) por JS según su distancia a la activa (gradiente). La activa: `opacity 1`, color ink pleno. Transición `opacity .55s`.
- **Gradiente/atenuado:** además del `--o` por oración, la superficie lleva una **máscara** `linear-gradient(to bottom, transparent 0%, #000 26%, #000 74%, transparent 100%)` que desvanece arriba/abajo. La intensidad del atenuado es ajustable (token *dimIntensity* 0–100; controla la pendiente de caída de `--o`).
- **Botón play central (`.center-play`):** 76×76, redondo, `backdrop-filter: blur(8px)`, fondo `surface/80%`, borde hairline, icono en `--accent` (30px). Sombra `--shadow-float`. Hover `scale(1.06)`, active `scale(.95)`. Al reproducir: clase `playing` → animación `breathe`; clase `faded` → se desvanece junto con el cromo cuando este se autooculta.
- **Cromo superior (`.chrome-top`):** flex space-between, gradiente de fondo que se funde con `--bg`. Izquierda: volver (←) a biblioteca. Centro: título `14.5px`/500 + autor en cursiva `11.5px` (no interactivo). Derecha: **modeswitch** (segmento Foco/Página con iconos), tema, ayuda (?), ajustes (engranaje).
- **Cromo inferior (`.chrome-bottom`):** **transport** centrado, `min(560px,92vw)`:
  - Barra de scrub: tiempo transcurrido (Hanken 11px tabular) · track de 3px con relleno acento y knob (visible en hover) · tiempo total. Click en el track salta a esa oración.
  - Controles: oración anterior (`«`), play/pausa grande (46px, acento), oración siguiente (`»`), chip de velocidad (ej. `1×`) que abre Ajustes.
- **Franja lateral (`.rail`):** fija al borde derecho, 46px de ancho, `pointer-events: none`. Texto vertical (`writing-mode: vertical-rl`) en Hanken `10.5px`/600 `letter-spacing .22em` uppercase ink/.34: capítulo, "pág N / total", y `%` en acento. Entre medio, una mini barra de progreso vertical (`.rail-prog`, 2×120px, relleno acento). Cuando el cromo se oculta, la franja baja a `opacity .28`.
- **Autoocultado del cromo:** tras *chromeDelay* segundos (def. 2.5s, ajustable 1–6) sin actividad, `.chrome-hidden`: cromo superior/inferior se desvanecen y trasladan ±12px; el play central se desvanece si está reproduciendo; la franja se atenúa; el cursor se oculta (`cursor: none`) si además está reproduciendo. Cualquier `mousemove`/`keydown`/`touchstart`/`scroll` lo vuelve a mostrar y reinicia el timer. Tocar el fondo del texto alterna el cromo manualmente; tocar una oración salta a ella.

### 3. Lector — modo página completa
- Mismo layout y cromo. Diferencias por clase `.mode-full`:
  - Todas las oraciones a `opacity 1` (sin gradiente, sin máscara).
  - La oración activa lleva un **susurro** de acento: fondo `color-mix(accent 9%)` + `box-shadow 0 0 0 3px` del mismo, radio 2px.
- **Transición foco↔completo:** al cambiar de modo, las opacidades de las oraciones animan (`.55s`), la máscara aparece/desaparece y el highlight de la activa hace fundido. Un toast efímero confirma ("Modo foco" / "Página completa"). Atajo: tecla `F`.

### 4. Panel de Ajustes (`.sheet`)
- **Propósito:** voz y velocidad de narración (+ tema).
- **Layout:** sheet lateral derecha `min(420px,100%)`, `transform: translateX(100%) → 0` (.42s). En `≤560px`: sheet inferior, alto `min(84%,640px)`, esquinas superiores redondeadas, entra desde abajo. Scrim detrás (`opacity .3s`, blur 2px) que cierra al click.
- **Cabecera:** título "Ajustes" `19px`/500 + botón cerrar (×).
- **Grupos** (separados por hairline):
  - **Tema:** segmento Claro/Oscuro (`.seg`) con iconos sol/luna.
  - **Velocidad de lectura:** slider `0.5–2×` step `0.05`, valor en acento (ej. `1×`), ticks `0,5× · 1× · 1,5× · 2×`.
  - **Voz:** lista (`.voice`) de hasta 8 voces del sistema (las `es-*` primero). Cada item: avatar circular con inicial (serif), nombre (sin paréntesis), idioma + "· local" si aplica, icono de volumen para previsualizar. Seleccionada: borde acento + fondo `color-mix(accent 7%)` + avatar en acento. Al seleccionar/tocar volumen, se reproduce una muestra ("Los ojos verdes, una leyenda."). Si no hay voces, texto en cursiva explicando que la narración igual avanza por temporizador.

### 5. Overlay de Ayuda (`.help`)
- **Propósito:** enseñar atajos y gestos.
- **Layout:** scrim con blur 7px (cierra al click); tarjeta `min(560px,100%)`, radio 20px, sombra float, padding generoso. Entra con `translateY(14px) scale(.985) → none`.
- **Contenido:** título `27px`/500 "Cómo leer en Lentton"; lead en cursiva. Tres grupos con etiqueta `.meta` (Narración / Vista / Gestos), cada fila (`.kbd-row`) descripción + teclas (`.kbd`, estilo tecla física: Hanken 12px, fondo surface-2, borde + sombra inferior). Pie en cursiva ink/.4. Cierra con `Esc` o click fuera.
  - **Narración:** Espacio = play/pausa · ↑/↓ = oración anterior/siguiente · Clic en oración = saltar.
  - **Vista:** F = foco↔página · Toque = mostrar/ocultar controles · Esc = volver a biblioteca.
  - **Gestos:** centro = narrar · barra = avanzar.

---

## Interactions & Behavior
- **Navegación:** Biblioteca → (click portada) → Lector. ← / `Esc` → Biblioteca. Engranaje → Ajustes. `?` → Ayuda.
- **Narración:** play/pausa con botón central, transport o `Espacio`. Avanza oración por oración; al terminar una, centra (scroll suave) la siguiente y continúa. `↑/↓/←/→` navegan oraciones. Click en una oración salta a ella; click en el scrub salta proporcionalmente.
- **Resaltado de palabra (karaoke):** opcional (token *wordHighlight*). Cuando está activo, la oración activa se renderiza palabra por palabra y la palabra "sonando" se ilumina en acento (`.word.lit`, transición .12s). Sincronizado por temporizador proporcional a la longitud de cada palabra (y, donde hay TTS, por `onboundary`).
- **Modo foco↔completo:** tecla `F` o el modeswitch; transición de opacidades + máscara + highlight.
- **Autoocultado del cromo:** ver pantalla 2. Toast efímero para confirmaciones (`.toast`, sube y se desvanece, 1.5s).
- **Responsive:** la biblioteca es grilla fluida; los sheets pasan a hoja inferior en mobile; el lector mantiene la columna de ~65ch con padding fluido. Hit targets ≥ 42px.
- **Reduced motion:** las entradas de ruta y el pulso del play se gatean con `prefers-reduced-motion: no-preference`.

## State Management
Estado global (en el prototipo, en `App`):
- `route`: `"library" | "reader"`.
- `bookId`: id del libro abierto.
- `positions`: `{ [bookId]: sentenceIndex }` — última oración leída por libro.
- `settings`: `{ rate: number (0.5–2), voiceURI: string }`.
- `voices`: lista de `SpeechSynthesisVoice` del sistema (se cargan async vía `onvoiceschanged`).
- `settingsOpen`, `helpOpen`: booleans de overlays.
- **Tweaks/diseño** (persistibles): `theme` (`light|dark`), `accent` (hex), `bodyFont`, `readingSize` (px), `measure` (rem), `dimIntensity` (0–100), `chromeDelay` (s), `wordHighlight` (bool).

Estado local del lector:
- `index` (oración activa), `playing`, `lit` (índice de palabra iluminada), `mode` (`focus|full`), `chromeHidden`, `toast`.

Persistencia: `localStorage["lentton.state.v1"]` guarda `route`, `bookId`, `positions`, `settings`. En el codebase real, mapear a su solución de estado (Redux/Zustand/Context/etc.) y persistencia.

### Motor de narración
- Segmentación de oraciones con `Intl.Segmenter('es', { granularity: 'sentence' })` (fallback regex por puntuación). Palabras por `match(/\S+/g)`.
- Reproducción: intenta `speechSynthesis` (voz `es-ES`, `rate` del setting) **y** dirige el avance/animación por temporizador (≈ `52ms × caracteres / rate` por palabra, con respiro al final), para que el demo siempre anime aunque no haya audio. En producción, idealmente sincronizar el resaltado con eventos reales (`onboundary`/`onend`) o un TTS con timestamps.

## Assets
- **Sin imágenes externas.** Portadas = campos de color tipográficos (CSS). Iconos = set SVG inline de trazo fino (`icons.jsx`): play, pause, back, prev, next, settings, sliders, help, close, focus, page, book, sun, moon, plus, search, volume, check. Marca del estado vacío = SVG inline. En el codebase, reemplazar por su librería de iconos (estilo: stroke ~1.6, `linecap/linejoin: round`).
- **Fuentes:** Google Fonts (Newsreader, Hanken Grotesk, y opcionales Spectral/Literata/Source Serif 4). Servir localmente o vía su pipeline de fuentes en producción.
- **Contenido de muestra:** clásicos en español de **dominio público**. El texto del lector es *"Los ojos verdes"* de Gustavo Adolfo Bécquer (1861). Reemplazar por el contenido real / fuente de datos de libros.

## Files
Todos en la raíz del proyecto (copiados también en esta carpeta de handoff como referencia):
- `Lentton.html` — documento principal; carga fuentes, estilos y scripts.
- `lentton.css` — tokens, temas claro/oscuro, biblioteca, botones.
- `reader.css` — lector (foco/completo), cromo, franja, sheets, ayuda, toast, transiciones.
- `data.js` — biblioteca de muestra + texto de Bécquer (`window.LENTTON_DATA`).
- `icons.jsx` — set de iconos SVG (`window.Icon`).
- `engine.jsx` — segmentación + hook de narración (`window.buildModel`, `window.useNarration`).
- `library.jsx` — Biblioteca + estado vacío (`window.Library`).
- `reader.jsx` — Lector foco/completo, cromo, franja, transport (`window.Reader`).
- `panels.jsx` — Ajustes + Ayuda (`window.Settings`, `window.Help`).
- `app.jsx` — shell, ruteo, persistencia, wiring de tokens, panel de Tweaks.
- `tweaks-panel.jsx` — panel de controles en vivo (andamiaje; no es parte del producto).

> Para verlo en acción: abrí `Lentton.html`. El panel de "Tweaks" (toolbar) permite ajustar tema, acento, serif, tamaño/ancho, intensidad de atenuado, karaoke y velocidad de autoocultado en vivo.
