# Requirements: Kompakter Trace-Reader
Freigabe: Nutzerauftrag vom 16.09.2026 zu TypeScript-Tooling für kontextarme Trace-Diagnose; autonome Umsetzung ist beauftragt.

- WHEN ein Agent den Reader ohne Argumente aufruft SHALL der neueste gespeicherte Versuch zur aktuellen Bot-Revision kompakt zusammengefasst werden; ohne Treffer eine klare Meldung statt fremder Evidenz.
- WHEN list aufgerufen wird SHALL höchstens fünf letzte Versuche mit Revision, Session, Ergebnis und Hinweis auf aktuellen Code ausgegeben werden.
- WHEN summary mit Datei aufgerufen wird SHALL die Ausgabe Fakten, abgeleitete Hinweise, Kürzungen und verfügbare Tickbereiche trennen, ohne Samples oder lange Ticklisten zu dumpen.
- WHEN focus mit Datei und Tick aufgerufen wird SHALL ein begrenzter zeitlicher Ausschnitt plus ein geometrischer Snapshot ausgegeben werden; fehlende Samples und Abstände zum angefragten Tick bleiben sichtbar.
- WHEN Daten fehlen, gekürzt oder veraltet sind SHALL dies sichtbar bleiben; ein Versuch darf nicht als vollständiger Lauf bezeichnet werden.
- WHEN der Reader ausgeführt wird SHALL er nur lokale Dateien lesen; kein Server, keine neuen Pakete und keine Änderung der Roh-Traces oder Bot-Datei.
