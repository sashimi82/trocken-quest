# Trocken-Quest: Quelltexte

- `src/` – Spielregeln (`engine.js`), Speicher (`store.js`), Insel (`world.js`, `game.js`), Ansichten (`app.js`, `training.js`, `parents.js`), Aussehen (`styles.css`), Übungen (`physio.json`), Offline-Hilfe (`sw.js`)
- `supabase/schema.sql` – Tabellen und Zugriffsregeln (im Supabase SQL Editor ausführen; darf mehrmals laufen)
- `config.json` – öffentliche Projekt-Adresse und öffentlicher Schlüssel (keine Geheimnisse)

## Bauen und veröffentlichen
```
cd source
python3 build.py                     # erzeugt dist/web (Seite) und dist/demo.html (für Tests)
TZ=Europe/Zurich node test/engine.test.js
cp dist/web/* ..                     # Seite ins Wurzelverzeichnis (GitHub Pages)
```

## Spielstände bei Updates
Gespeichert werden nur Ereignisse (Quest erledigt, Nacht, gebaut …). Alles andere wird daraus berechnet.
Regeländerungen deshalb mit Datum einführen (ab wann sie gelten), damit alte Tage gleich bleiben.
Neue Ereignistypen brauchen eine Ergänzung in `schema.sql` (Prüfung `events_type_check` und Regel `ev_insert`).
