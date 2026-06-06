/* Lentton — sample library (Spanish public-domain classics) */
window.LENTTON_DATA = (function () {

  // ── Reading content for the focused book: Bécquer, "Los ojos verdes" (1861)
  //    Public domain. Stored as paragraphs; segmented into sentences at runtime.
  const ojosVerdes = {
    chapter: "Leyenda · I",
    page: 12,
    pages: 31,
    paragraphs: [
      { text: "Hace mucho tiempo que tenía ganas de escribir cualquier cosa con este título. Hoy, que se me ha presentado ocasión, lo he puesto con letras grandes en la primera cuartilla de papel, y luego he dejado a capricho volar la pluma." },
      { text: "Yo creo que he visto unos ojos como los que he pintado en esta leyenda. No sé si en sueños, pero yo los he visto. De seguro no los podré describir tales cuales ellos eran: luminosos, transparentes como las gotas de la lluvia que se resbalan sobre las hojas de los árboles después de una tempestad de verano." },
      { text: "De todos modos, cuento con la imaginación de mis lectores para hacerme comprender en este que pudiéramos llamar boceto de un cuadro que pintaré algún día." },
      { speaker: true, text: "—Herido va el ciervo… herido va; no hay duda. Se ve el rastro de la sangre entre las zarzas del monte, y al saltar por uno de esos lentiscos han flaqueado sus piernas. Nuestro joven señor comienza por donde otros acaban. En cuarenta años de montero no he visto mejor golpe." },
      { speaker: true, text: "Pero, ¡por San Saturio, patrón de Soria!, cortadle el paso por esas carrascas, azuzad los perros, soplad en esas trompas hasta echar los hígados, y hundidles a los corceles una cuarta de hierro en los ijares: ¿no veis que se dirige hacia la fuente de los Álamos, y si la salva antes de morir podemos darle por perdido?" },
      { text: "Las cuencas del Moncayo repitieron de eco en eco el bramido de las trompas, el latir de la jauría desencadenada, y las voces de los pajes resonaron con nueva furia, y el confuso tropel de hombres, caballos y perros se dirigió al punto que Íñigo, el montero mayor de los marqueses de Almenar, señalaba como el más a propósito para cortarle el paso a la res." },
      { text: "Pero todo fue inútil. Cuando el más ágil de los lebreles llegó a las carrascas, jadeante y cubiertas las fauces de espuma, ya el ciervo, rápido como una saeta, las había salvado de un solo brinco, perdiéndose entre los matorrales de una trocha que conducía a la fuente." },
      { speaker: true, text: "—¡Alto!… ¡Alto todo el mundo! —gritó Íñigo entonces—. Estaba de Dios que había de marcharse." },
      { text: "Y la cabalgata se detuvo, y enmudecieron las trompas, y los lebreles, refunfuñando, dejaron la pista a la voz de los cazadores." },
      { text: "En aquel momento se reunía a la comitiva el héroe de la fiesta, Fernando de Argensola, el primogénito de Almenar." },
      { speaker: true, text: "—¿Qué haces? —exclamó dirigiéndose a Íñigo, y en tanto unas veces fijaba los ojos en el sitio por donde se había perdido el ciervo, y otras los volvía hacia su montero, sorprendido casi de hallar reunida la gente—. ¿Qué haces, imbécil? ¿Ves que la pieza está herida, que es la primera que cae por mi mano, y abandonas el rastro y la dejas perder para que vaya a morir en el fondo del bosque?" },
      { speaker: true, text: "—Señor —murmuró Íñigo entre dientes—, es imposible pasar de este punto." },
      { speaker: true, text: "—¡Imposible! ¿Y por qué?" },
      { speaker: true, text: "—Porque esa trocha —prosiguió el montero— conduce a la fuente de los Álamos: la fuente de los Álamos, en cuyas aguas habita un espíritu del mal. El que osa enturbiar su corriente paga caro su atrevimiento. Ya la res habrá salvado sus márgenes; ¿cómo la salvaréis vos sin atraer sobre vuestra cabeza alguna calamidad horrible? Los cazadores somos reyes del Moncayo, pero reyes que pagan un tributo." },
      { text: "El joven escuchó en silencio, y una sonrisa de desdén se dibujó en sus labios. Algo, sin embargo, se removía en el fondo de su alma, una voz confusa que le hablaba de peligros misteriosos, de aguas quietas y de ojos que miran desde la sombra de los chopos." }
    ]
  };

  // typographic cover palettes — muted, earthy, within the calm palette.
  // [background, ink-on-cover]
  const palettes = {
    sage:   ["#3f5848", "#eef2ea"],
    clay:   ["#9a5b43", "#fbeee6"],
    ink:    ["#27303a", "#e9edf2"],
    plum:   ["#5a3f54", "#f3e9f0"],
    ochre:  ["#a9853e", "#fbf3df"],
    slate:  ["#46555c", "#eaf1f3"],
    rust:   ["#8a4a3a", "#f8e9e3"],
    forest: ["#2f5340", "#e7f0e9"],
    sand:   ["#bfa06a", "#3a2e18"],
    teal:   ["#2d5a55", "#e4f1ef"]
  };

  const books = [
    { id: "ojos",     title: "Los ojos verdes", sub: "y otras leyendas", author: "Gustavo A. Bécquer", year: 1861, progress: 0.38, cover: "forest", content: ojosVerdes },
    { id: "niebla",   title: "Niebla",          author: "Miguel de Unamuno", year: 1914, progress: 0.71, cover: "slate" },
    { id: "quijote",  title: "Don Quijote de la Mancha", author: "Miguel de Cervantes", year: 1605, progress: 0.12, cover: "clay" },
    { id: "regenta",  title: "La Regenta",      author: "Leopoldo Alas «Clarín»", year: 1885, progress: 0, cover: "plum" },
    { id: "rimas",    title: "Rimas",           author: "Gustavo A. Bécquer", year: 1871, progress: 1, cover: "sage" },
    { id: "pepita",   title: "Pepita Jiménez",  author: "Juan Valera", year: 1874, progress: 0.54, cover: "ochre" },
    { id: "fortunata",title: "Fortunata y Jacinta", author: "Benito Pérez Galdós", year: 1887, progress: 0.03, cover: "ink" },
    { id: "cuentos",  title: "Cuentos de Clarín", author: "Leopoldo Alas", year: 1896, progress: 0, cover: "teal" },
    { id: "sonata",   title: "Sonata de otoño", author: "Ramón del Valle-Inclán", year: 1902, progress: 0.27, cover: "rust" },
    { id: "trafalgar",title: "Trafalgar",       author: "Benito Pérez Galdós", year: 1873, progress: 0.88, cover: "sand" }
  ];

  return { books, palettes };
})();
