# Gruppo Scout Firenze 1 — sito web

Sito statico del gruppo, deploy su Netlify.

## Struttura

- `index.html` — home pubblica
- `staff/` — login, registrazione e area personale
- `photos/` — logo e foto (metti qui le immagini)
- `css/`, `js/` — stili e logica

## Foto e loghi

Metti file in `photos/` (es. `photos/logo.jpeg`, `photos/sede.jpg`). Poi dimmi i nomi file e li colleghiamo alle sezioni.

## Note tecniche

Account staff e calendario attività sono salvati per ora nel browser (`localStorage`).
Il calendario staff usa un embed di Google Calendar (URL da Impostazioni → Integra calendario).
