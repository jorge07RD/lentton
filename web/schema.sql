-- Esquema D1 (SQLite) para la memoria compartida de Lentton.
-- Todo vive en D1 (sin R2): contenido del libro y portada como texto.
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  addedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  content TEXT NOT NULL,   -- Book parseado (sin portada) en JSON
  coverType TEXT,          -- mime de la portada (NULL si no tiene)
  coverB64 TEXT            -- portada en base64 (NULL si no tiene)
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
