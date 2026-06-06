/* Lentton — app shell: routing, persistence, tweaks, font/accent wiring */
(function () {
  const { useState, useEffect, useRef } = React;

  const SERIF_STACKS = {
    "Newsreader": '"Newsreader", Georgia, serif',
    "Spectral": '"Spectral", Georgia, serif',
    "Literata": '"Literata", Georgia, serif',
    "Source Serif 4": '"Source Serif 4", Georgia, serif'
  };

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "accent": "#1f7a5c",
    "bodyFont": "Newsreader",
    "readingSize": 21,
    "measure": 34,
    "dimIntensity": 58,
    "chromeDelay": 2.5,
    "wordHighlight": false
  }/*EDITMODE-END*/;

  const LS = "lentton.state.v1";
  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
  }

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const saved = useRef(loadState());

    const [route, setRoute] = useState(saved.current.route || "library");
    const [bookId, setBookId] = useState(saved.current.bookId || null);
    const [positions, setPositions] = useState(saved.current.positions || {});
    const [settings, setSettings] = useState(saved.current.settings || { rate: 1, voiceURI: "" });
    const [voices, setVoices] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const books = window.LENTTON_DATA.books;
    const book = books.find(b => b.id === bookId) || null;

    // ----- apply design tokens ------------------------------------------------
    useEffect(() => {
      const r = document.documentElement;
      r.setAttribute("data-theme", t.theme);
      r.style.setProperty("--accent", t.accent);
      r.style.setProperty("--serif", SERIF_STACKS[t.bodyFont] || SERIF_STACKS.Newsreader);
      r.style.setProperty("--reading-size", t.readingSize + "px");
      r.style.setProperty("--reading-measure", t.measure + "rem");
    }, [t.theme, t.accent, t.bodyFont, t.readingSize, t.measure]);

    // ----- load system voices -------------------------------------------------
    useEffect(() => {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const load = () => {
        const vs = synth.getVoices();
        if (vs.length) {
          setVoices(vs);
          setSettings(s => {
            if (s.voiceURI && vs.some(v => v.voiceURI === s.voiceURI)) return s;
            const es = vs.find(v => v.lang.toLowerCase().startsWith("es")) || vs[0];
            return { ...s, voiceURI: es.voiceURI };
          });
        }
      };
      load();
      synth.onvoiceschanged = load;
      return () => { synth.onvoiceschanged = null; };
    }, []);

    // ----- persist ------------------------------------------------------------
    useEffect(() => {
      try {
        localStorage.setItem(LS, JSON.stringify({ route, bookId, positions, settings }));
      } catch (e) {}
    }, [route, bookId, positions, settings]);

    // ----- nav ----------------------------------------------------------------
    const openBook = (b) => {
      if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) {}
      setBookId(b.id);
      setRoute("reader");
    };
    const backToLibrary = () => {
      if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) {}
      setSettingsOpen(false); setHelpOpen(false);
      setRoute("library");
    };
    const toggleTheme = () => setTweak("theme", t.theme === "dark" ? "light" : "dark");

    // only books with a real reading payload open the reader; others demo with the same text
    const ensureContent = (b) => {
      if (b.content) return b;
      const demo = books.find(x => x.content);
      return { ...b, content: demo.content };
    };

    return (
      <div className="app">
        {route === "library" && (
          <Library books={books} theme={t.theme}
                   onToggleTheme={toggleTheme} onOpen={openBook} />
        )}

        {route === "reader" && book && (
          <Reader
            key={book.id}
            book={ensureContent(book)}
            theme={t.theme}
            settings={settings}
            tweaks={t}
            voices={voices}
            initialIndex={positions[book.id] || 0}
            onProgress={(i) => setPositions(p => (p[book.id] === i ? p : { ...p, [book.id]: i }))}
            onBack={backToLibrary}
            onSettings={() => setSettingsOpen(true)}
            onHelp={() => setHelpOpen(true)}
            onToggleTheme={toggleTheme}
          />
        )}

        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)}
                  settings={settings} setSettings={setSettings}
                  voices={voices} theme={t.theme} onToggleTheme={toggleTheme} />

        <Help open={helpOpen} onClose={() => setHelpOpen(false)} />

        {/* live design controls */}
        <TweaksPanel title="Tweaks">
          <TweakSection label="Tema" />
          <TweakRadio label="Apariencia" value={t.theme}
                      options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Oscuro" }]}
                      onChange={(v) => setTweak("theme", v)} />
          <TweakColor label="Acento verde" value={t.accent}
                      options={["#1f7a5c", "#2f7d4f", "#207d6e", "#5a6e35"]}
                      onChange={(v) => setTweak("accent", v)} />

          <TweakSection label="Tipografía" />
          <TweakSelect label="Serif del cuerpo" value={t.bodyFont}
                       options={["Newsreader", "Spectral", "Literata", "Source Serif 4"]}
                       onChange={(v) => setTweak("bodyFont", v)} />
          <TweakSlider label="Tamaño de texto" value={t.readingSize} min={16} max={28} unit="px"
                       onChange={(v) => setTweak("readingSize", v)} />
          <TweakSlider label="Ancho de columna" value={t.measure} min={26} max={44} unit="rem"
                       onChange={(v) => setTweak("measure", v)} />

          <TweakSection label="Foco" />
          <TweakSlider label="Atenuado de vecinas" value={t.dimIntensity} min={0} max={100} unit="%"
                       onChange={(v) => setTweak("dimIntensity", v)} />
          <TweakToggle label="Resaltar palabra (karaoke)" value={t.wordHighlight}
                       onChange={(v) => setTweak("wordHighlight", v)} />
          <TweakSlider label="Autoocultar cromo" value={t.chromeDelay} min={1} max={6} step={0.5} unit="s"
                       onChange={(v) => setTweak("chromeDelay", v)} />
        </TweaksPanel>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
