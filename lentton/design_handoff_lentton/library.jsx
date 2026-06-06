/* Lentton — Library: cover grid + empty state */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const PAL = window.LENTTON_DATA.palettes;

  function Cover({ book }) {
    const [bg, fg] = PAL[book.cover] || PAL.slate;
    return (
      <div className="cover" style={{ background: bg, color: fg }}>
        <div />
        <div>
          <div className="cover-title">{book.title}</div>
          {book.sub && <div className="cover-author" style={{ marginTop: 3 }}>{book.sub}</div>}
          <div className="cover-rule" />
          <div className="cover-author" style={{ marginTop: 9 }}>{book.author}</div>
        </div>
      </div>
    );
  }

  function Book({ book, onOpen }) {
    const pct = Math.round(book.progress * 100);
    const done = book.progress >= 1;
    const fresh = book.progress === 0;
    return (
      <button className={"book" + (fresh ? " book-unread" : "")} onClick={() => onOpen(book)}>
        <Cover book={book} />
        <div className="book-meta">
          <div>
            <div className="book-title">{book.title}</div>
            <div className="book-author">{book.author}</div>
          </div>
          <div className="progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: (fresh ? 0 : pct) + "%" }} />
            </div>
            <div className="progress-pct">
              {done ? "✓" : fresh ? "Nuevo" : pct + "%"}
            </div>
          </div>
        </div>
      </button>
    );
  }

  function EmptyState({ onAdd }) {
    return (
      <div className="empty">
        <div className="empty-inner route">
          <div className="empty-mark">
            <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="1.4"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 26c8-4 18-4 28 0v46c-10-4-20-4-28 0V26Z" />
              <path d="M76 26c-8-4-18-4-28 0v46c10-4 20-4 28 0V26Z" />
              <path d="M48 26v46" opacity=".4" />
            </svg>
          </div>
          <h2>Tu biblioteca espera</h2>
          <p>Todavía no hay nada para leer. Añadí un libro y dejá que las palabras —y la voz— hagan el resto.</p>
          <button className="btn btn-accent" onClick={onAdd}>
            <I.plus /> Añadir un libro
          </button>
        </div>
      </div>
    );
  }

  function Library({ books, theme, onToggleTheme, onOpen }) {
    const [empty, setEmpty] = useState(false);
    const reading = books.filter(b => b.progress > 0 && b.progress < 1);
    const rest = books.filter(b => b.progress === 0 || b.progress >= 1);

    if (empty) {
      return (
        <div className="library route">
          <div className="lib-inner">
            <div className="lib-head">
              <div>
                <div className="wordmark">lentton<span className="dot" /></div>
              </div>
              <div className="lib-actions">
                <button className="iconbtn" onClick={onToggleTheme} title="Tema">
                  {theme === "dark" ? <I.sun /> : <I.moon />}
                </button>
              </div>
            </div>
          </div>
          <EmptyState onAdd={() => setEmpty(false)} />
        </div>
      );
    }

    return (
      <div className="library route">
        <div className="lib-inner">
          <div className="lib-head">
            <div>
              <div className="wordmark">lentton<span className="dot" /></div>
              <div className="lib-sub">Leé con la vista. O dejá que te lean.</div>
            </div>
            <div className="lib-actions">
              <button className="iconbtn" title="Buscar"><I.search /></button>
              <button className="iconbtn" onClick={onToggleTheme} title="Tema">
                {theme === "dark" ? <I.sun /> : <I.moon />}
              </button>
              <button className="iconbtn" onClick={() => setEmpty(true)} title="Ver estado vacío"><I.plus /></button>
            </div>
          </div>

          {reading.length > 0 && (
            <>
              <div className="lib-section-label meta">Seguir leyendo</div>
              <div className="grid" style={{ marginBottom: 48 }}>
                {reading.map(b => <Book key={b.id} book={b} onOpen={onOpen} />)}
              </div>
            </>
          )}

          <div className="lib-section-label meta">Tu estantería</div>
          <div className="grid">
            {rest.map(b => <Book key={b.id} book={b} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    );
  }

  window.Library = Library;
})();
