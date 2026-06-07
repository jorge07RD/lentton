-- Esquema D1 (SQLite) para la memoria compartida de Lentton.
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  addedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  coverType TEXT          -- mime de la portada (NULL si no tiene)
);

CREATE TABLE IF NOT EXISTS positions (
  bookId TEXT PRIMARY KEY,
  chapterIndex INTEGER NOT NULL,
  sentenceIndex INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,    -- siempre 'app'
  json TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
