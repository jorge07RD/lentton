/* Lentton — Settings sheet (voice, speed) & Help overlay */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;

  function previewVoice(voice, rate) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Los ojos verdes, una leyenda.");
      u.lang = "es-ES"; u.rate = rate; if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function Settings({ open, onClose, settings, setSettings, voices, theme, onToggleTheme }) {
    const [mounted, setMounted] = useState(open);
    useEffect(() => { if (open) setMounted(true); }, [open]);
    if (!mounted && !open) return null;

    // sort: Spanish voices first
    const sorted = [...voices].sort((a, b) => {
      const sa = a.lang.toLowerCase().startsWith("es") ? 0 : 1;
      const sb = b.lang.toLowerCase().startsWith("es") ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name);
    });

    const fallback = sorted.length === 0;

    return (
      <>
        <div className={"scrim" + (open ? " in" : "")} onClick={onClose}
             onTransitionEnd={() => { if (!open) setMounted(false); }} />
        <aside className={"sheet" + (open ? " in" : "")} role="dialog" aria-label="Ajustes de narración">
          <div className="sheet-head">
            <h3>Ajustes</h3>
            <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><I.close /></button>
          </div>
          <div className="sheet-body">

            {/* Theme */}
            <div className="set-group">
              <div className="set-label"><span className="l">Tema</span></div>
              <div className="seg">
                <button className={theme === "light" ? "on" : ""}
                        onClick={() => theme !== "light" && onToggleTheme()}><I.sun /> Claro</button>
                <button className={theme === "dark" ? "on" : ""}
                        onClick={() => theme !== "dark" && onToggleTheme()}><I.moon /> Oscuro</button>
              </div>
            </div>

            {/* Speed */}
            <div className="set-group">
              <div className="set-label">
                <span className="l">Velocidad de lectura</span>
                <span className="v">{settings.rate.toFixed(2).replace(/0$/, "")}×</span>
              </div>
              <input type="range" className="slider" min="0.5" max="2" step="0.05"
                     value={settings.rate}
                     onChange={(e) => setSettings(s => ({ ...s, rate: Number(e.target.value) }))} />
              <div className="slider-ticks">
                <span>0,5×</span><span>1×</span><span>1,5×</span><span>2×</span>
              </div>
            </div>

            {/* Voice */}
            <div className="set-group">
              <div className="set-label">
                <span className="l">Voz</span>
                <span className="v">{fallback ? "—" : sorted.length + " disponibles"}</span>
              </div>

              {fallback ? (
                <div style={{ fontStyle: "italic", fontSize: 15, lineHeight: 1.5,
                              color: "rgb(var(--ink-rgb) / .5)" }}>
                  No hay voces del sistema en este navegador. La narración igual avanza,
                  oración por oración, siguiendo el ritmo elegido.
                </div>
              ) : (
                <div className="voice-list">
                  {sorted.slice(0, 8).map((v) => {
                    const on = v.voiceURI === settings.voiceURI;
                    const initial = (v.name.match(/[A-Za-zÁÉÍÓÚÑ]/) || ["·"])[0].toUpperCase();
                    const short = v.name.replace(/\s*\(.*\)$/, "");
                    return (
                      <button key={v.voiceURI} className={"voice" + (on ? " on" : "")}
                              onClick={() => { setSettings(s => ({ ...s, voiceURI: v.voiceURI }));
                                               previewVoice(v, settings.rate); }}>
                        <div className="voice-ava">{initial}</div>
                        <div className="voice-info">
                          <div className="voice-name">{short}</div>
                          <div className="voice-lang">{v.lang}{v.localService ? " · local" : ""}</div>
                        </div>
                        <div className="voice-play"
                             onClick={(e) => { e.stopPropagation(); previewVoice(v, settings.rate); }}>
                          <I.volume />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </aside>
      </>
    );
  }

  function Help({ open, onClose }) {
    const [mounted, setMounted] = useState(open);
    useEffect(() => { if (open) setMounted(true); }, [open]);
    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!mounted && !open) return null;

    const Row = ({ desc, keys }) => (
      <div className="kbd-row">
        <span className="desc">{desc}</span>
        <span className="kbd-keys">{keys.map((k, i) => <span key={i} className="kbd">{k}</span>)}</span>
      </div>
    );

    return (
      <div className={"help" + (open ? " in" : "")} onClick={onClose}
           onTransitionEnd={() => { if (!open) setMounted(false); }}>
        <div className="help-card" onClick={(e) => e.stopPropagation()}>
          <h2>Cómo leer en Lentton</h2>
          <p className="lead">Una sola cosa a la vez. El texto se atenúa alrededor de la oración que suena; todo lo demás se aparta.</p>

          <div className="help-group">
            <h4>Narración</h4>
            <Row desc="Reproducir o pausar la voz" keys={["Espacio"]} />
            <Row desc="Oración siguiente / anterior" keys={["↑", "↓"]} />
            <Row desc="Tocá una oración para saltar a ella" keys={["Clic"]} />
          </div>

          <div className="help-group">
            <h4>Vista</h4>
            <Row desc="Alternar foco y página completa" keys={["F"]} />
            <Row desc="Mostrar u ocultar los controles" keys={["Toque"]} />
            <Row desc="Volver a la biblioteca" keys={["Esc"]} />
          </div>

          <div className="help-group">
            <h4>Gestos</h4>
            <Row desc="Tocá el centro para narrar" keys={["●"]} />
            <Row desc="Deslizá la barra para avanzar" keys={["↔"]} />
          </div>

          <div className="help-hint">Los controles se ocultan solos mientras leés. Movés y vuelven.</div>
        </div>
      </div>
    );
  }

  window.Settings = Settings;
  window.Help = Help;
})();
