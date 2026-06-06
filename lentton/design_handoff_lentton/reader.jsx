/* Lentton — Reader: focus & full-page modes, auto-hiding chrome, lateral rail */
(function () {
  const { useState, useRef, useEffect, useMemo, useCallback } = React;
  const I = window.Icon;

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function Reader({ book, theme, settings, tweaks, voices, initialIndex, onProgress, onBack, onSettings, onHelp, onToggleTheme }) {
    const model = useMemo(() => window.buildModel(book.content), [book]);
    const flat = model.flat;

    const voice = useMemo(
      () => voices.find(v => v.voiceURI === settings.voiceURI) || null,
      [voices, settings.voiceURI]
    );

    const nar = window.useNarration(flat, {
      rate: settings.rate, voice, wordHighlight: tweaks.wordHighlight, initialIndex
    });
    const { index, playing, lit } = nar;
    useEffect(() => { onProgress && onProgress(index); }, [index]);

    const [mode, setMode] = useState("focus");      // focus | full
    const [chromeHidden, setChromeHidden] = useState(false);
    const [toast, setToast] = useState("");
    const scrollRef = useRef(null);
    const hideTimer = useRef(null);
    const toastTimer = useRef(null);

    // ----- auto-hide chrome ---------------------------------------------------
    const delayMs = (tweaks.chromeDelay || 2.5) * 1000;
    const wake = useCallback(() => {
      setChromeHidden(false);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setChromeHidden(true), delayMs);
    }, [delayMs]);

    useEffect(() => {
      wake();
      const onMove = () => wake();
      const el = scrollRef.current;
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("keydown", onMove);
      window.addEventListener("touchstart", onMove, { passive: true });
      el && el.addEventListener("scroll", onMove, { passive: true });
      return () => {
        clearTimeout(hideTimer.current);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("keydown", onMove);
        window.removeEventListener("touchstart", onMove);
        el && el.removeEventListener("scroll", onMove);
      };
    }, [wake]);

    // ----- centre the active sentence ----------------------------------------
    useEffect(() => {
      const sc = scrollRef.current;
      if (!sc) return;
      const el = sc.querySelector('[data-gi="' + index + '"]');
      if (!el) return;
      const target = el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2;
      sc.scrollTo({ top: target, behavior: "smooth" });
    }, [index, mode]);

    // ----- keyboard -----------------------------------------------------------
    useEffect(() => {
      const onKey = (e) => {
        if (e.target.tagName === "INPUT") return;
        if (e.code === "Space") { e.preventDefault(); nar.toggle(); }
        else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); nar.next(); }
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); nar.prev(); }
        else if (e.key.toLowerCase() === "f") flipMode();
        else if (e.key === "Escape") onBack();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    });

    const flipMode = useCallback(() => {
      setMode(m => {
        const next = m === "focus" ? "full" : "focus";
        flash(next === "focus" ? "Modo foco" : "Página completa");
        return next;
      });
    }, []);

    const flash = (msg) => {
      setToast(msg);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 1500);
    };

    // ----- progress maths -----------------------------------------------------
    const frac = (index + 1) / flat.length;
    const pct = Math.round(frac * 100);
    const totalWords = useMemo(() => flat.reduce((n, s) => n + s.words.length, 0), [flat]);
    const totalSec = (totalWords / (185 * settings.rate)) * 60;
    const pageNow = book.content.page +
      Math.floor(frac * (book.content.pages - book.content.page));

    // ----- per-sentence opacity (the gradient) --------------------------------
    const falloff = 0.46 - (tweaks.dimIntensity / 100) * 0.40; // higher intensity → steeper
    const opacityFor = (gi) => {
      const d = Math.abs(gi - index);
      return Math.max(0.05, 1 - d * (0.5 - falloff + 0.42 * (tweaks.dimIntensity / 100)));
    };

    // tap empty space toggles chrome
    const onSurfaceClick = (e) => {
      if (e.target.closest(".sentence")) return;
      setChromeHidden(h => {
        const nh = !h;
        if (!nh) wake();
        return nh;
      });
    };

    return (
      <div className={
        "reader route mode-" + mode +
        (chromeHidden ? " chrome-hidden" : "") +
        (chromeHidden && playing ? " hide-cursor" : "")
      }>
        {/* reading surface */}
        <div className="read-scroll" ref={scrollRef} onClick={onSurfaceClick}>
          <div className="read-col">
            {model.paras.map((p, pi) => (
              <p key={pi} className={p.speaker ? "speaker" : ""}>
                {p.sentences.map((s) => (
                  <span key={s.gIndex}
                        className={"sentence" + (s.gIndex === index ? " active" : "")}
                        data-gi={s.gIndex}
                        style={{ "--o": opacityFor(s.gIndex) }}
                        onClick={(e) => { e.stopPropagation(); wake(); nar.goTo(s.gIndex); }}>
                    {s.gIndex === index && tweaks.wordHighlight
                      ? s.words.map((w, wi) => (
                          <span key={wi} className={"word" + (wi === lit ? " lit" : "")}>
                            {w.text}{wi < s.words.length - 1 ? " " : ""}
                          </span>
                        ))
                      : s.text}
                    {" "}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>

        {/* lateral rail */}
        <div className="rail">
          <div className="rail-text">{book.content.chapter}</div>
          <div className="rail-prog"><i style={{ height: pct + "%" }} /></div>
          <div className="rail-text">pág {pageNow} / {book.content.pages}</div>
          <div className="rail-text rail-pct">{pct}%</div>
        </div>

        {/* central play */}
        <button
          className={"center-play" + (playing ? " playing faded" : "")}
          onClick={(e) => { e.stopPropagation(); wake(); nar.toggle(); }}
          title={playing ? "Pausar (Espacio)" : "Narrar (Espacio)"}>
          {playing ? <I.pause /> : <I.play />}
        </button>

        {/* top chrome */}
        <div className="chrome chrome-top">
          <button className="iconbtn" onClick={onBack} title="Biblioteca (Esc)"><I.back /></button>
          <div className="chrome-title">
            <div className="t">{book.title}</div>
            <div className="a">{book.author}</div>
          </div>
          <div className="chrome-grp">
            <div className="modeswitch">
              <button className={mode === "focus" ? "on" : ""} onClick={() => mode !== "focus" && flipMode()}>
                <I.focus /> Foco
              </button>
              <button className={mode === "full" ? "on" : ""} onClick={() => mode !== "full" && flipMode()}>
                <I.page /> Página
              </button>
            </div>
            <button className="iconbtn" onClick={onToggleTheme} title="Tema">
              {theme === "dark" ? <I.sun /> : <I.moon />}
            </button>
            <button className="iconbtn" onClick={onHelp} title="Ayuda (?)"><I.help /></button>
            <button className="iconbtn" onClick={onSettings} title="Ajustes de voz"><I.settings /></button>
          </div>
        </div>

        {/* bottom transport */}
        <div className="chrome chrome-bottom">
          <div className="transport">
            <div className="transport-bar">
              <div className="transport-time">{fmt(frac * totalSec)}</div>
              <div className="scrub" onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const f = (e.clientX - r.left) / r.width;
                wake(); nar.goTo(Math.round(f * (flat.length - 1)));
              }}>
                <div className="scrub-fill" style={{ width: pct + "%" }} />
                <div className="scrub-knob" style={{ left: pct + "%" }} />
              </div>
              <div className="transport-time r">{fmt(totalSec)}</div>
            </div>
            <div className="transport-controls">
              <button className="iconbtn" onClick={() => { wake(); nar.prev(); }} title="Oración anterior"><I.prev /></button>
              <button className="iconbtn" onClick={() => { wake(); nar.toggle(); }} style={{ width: 46, height: 46, color: "var(--accent)" }}>
                {playing ? <I.pause /> : <I.play />}
              </button>
              <button className="iconbtn" onClick={() => { wake(); nar.next(); }} title="Oración siguiente"><I.next /></button>
              <button className="speed-chip" onClick={onSettings} title="Velocidad">{settings.rate.toFixed(2).replace(/0$/, "")}×</button>
            </div>
          </div>
        </div>

        <div className={"toast" + (toast ? " in" : "")}>{toast}</div>
      </div>
    );
  }

  window.Reader = Reader;
})();
