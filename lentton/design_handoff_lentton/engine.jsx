/* Lentton — narration engine
   Segments text into sentences/words, drives the focus animation, and
   speaks via speechSynthesis where available. Visual advance is timer-driven
   so the demo always animates; real audio plays in parallel when supported. */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;

  // ---- segmentation ----------------------------------------------------------
  function splitSentences(text) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      try {
        const seg = new Intl.Segmenter("es", { granularity: "sentence" });
        return [...seg.segment(text)].map(s => s.segment.trim()).filter(Boolean);
      } catch (e) { /* fall through */ }
    }
    return text.split(/(?<=[.!?…])\s+(?=[«¡¿"A-ZÁÉÍÓÚÑ—])/).map(s => s.trim()).filter(Boolean);
  }

  function buildModel(content) {
    const paras = [];
    const flat = [];
    content.paragraphs.forEach((p) => {
      const sentences = splitSentences(p.text).map((text) => {
        const words = (text.match(/\S+/g) || []).map(w => ({ text: w }));
        const s = { text, words, gIndex: flat.length };
        flat.push(s);
        return s;
      });
      paras.push({ speaker: !!p.speaker, sentences });
    });
    return { paras, flat };
  }

  // ---- narration hook --------------------------------------------------------
  function useNarration(flat, { rate, voice, wordHighlight, initialIndex }) {
    const [index, setIndex] = useState(initialIndex || 0);
    const [playing, setPlaying] = useState(false);
    const [lit, setLit] = useState(-1);

    const idxRef = useRef(0);      idxRef.current = index;
    const playRef = useRef(false); playRef.current = playing;
    const rateRef = useRef(rate);  rateRef.current = rate;
    const voiceRef = useRef(voice); voiceRef.current = voice;
    const whRef = useRef(wordHighlight); whRef.current = wordHighlight;
    const timers = useRef([]);
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

    const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

    const speakAudio = useCallback((s) => {
      if (!synth) return;
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(s.text.replace(/^—\s*/, ""));
        u.lang = "es-ES";
        u.rate = rateRef.current;
        if (voiceRef.current) u.voice = voiceRef.current;
        synth.speak(u);
      } catch (e) { /* ignore — visuals are timer-driven */ }
    }, [synth]);

    // play one sentence visually; advance when done
    const runSentence = useCallback((i) => {
      const s = flat[i];
      if (!s) { stop(); return; }
      clearTimers();
      setLit(-1);
      speakAudio(s);

      const r = rateRef.current || 1;
      const perChar = 52 / r;              // ms per character ≈ natural cadence
      let t = 0;
      const wordTimes = s.words.map((w) => {
        const start = t;
        t += Math.max(220 / r, w.text.length * perChar);
        return start;
      });
      const total = t + 420 / r;           // small breath at the end

      if (whRef.current) {
        s.words.forEach((w, wi) => {
          timers.current.push(setTimeout(() => {
            if (playRef.current) setLit(wi);
          }, wordTimes[wi]));
        });
      }
      timers.current.push(setTimeout(() => {
        setLit(-1);
        if (!playRef.current) return;
        if (i + 1 < flat.length) {
          setIndex(i + 1);
          runSentence(i + 1);
        } else {
          stop();
        }
      }, total));
    }, [flat, speakAudio]);

    const stop = useCallback(() => {
      clearTimers();
      setPlaying(false);
      playRef.current = false;
      setLit(-1);
      if (synth) try { synth.cancel(); } catch (e) {}
    }, [synth]);

    const play = useCallback(() => {
      setPlaying(true);
      playRef.current = true;
      runSentence(idxRef.current);
    }, [runSentence]);

    const toggle = useCallback(() => {
      if (playRef.current) stop(); else play();
    }, [play, stop]);

    const goTo = useCallback((i, keepPlaying) => {
      const clamped = Math.max(0, Math.min(flat.length - 1, i));
      setIndex(clamped);
      if (playRef.current || keepPlaying) {
        playRef.current = true; setPlaying(true);
        runSentence(clamped);
      }
    }, [flat.length, runSentence]);

    const next = useCallback(() => goTo(idxRef.current + 1), [goTo]);
    const prev = useCallback(() => goTo(idxRef.current - 1), [goTo]);

    useEffect(() => () => { clearTimers(); if (synth) try { synth.cancel(); } catch (e) {} }, [synth]);

    return { index, playing, lit, play, stop, toggle, goTo, next, prev,
             total: flat.length, ttsAvailable: !!synth };
  }

  window.buildModel = buildModel;
  window.useNarration = useNarration;
})();
