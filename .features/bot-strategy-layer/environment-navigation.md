# Korrektur: Wahrnehmungsbasierte Bewegungsangebote

## Freigabe
Expliziter Auftrag vom 16.09.2026: Levelzuschnitt entfernen, Bot soll auf wahrgenommene Umgebung reagieren. Autonom refactoren. Diese Anforderungen ersetzen visitor-intents.md und dessen Level-1-Routenansatz.

## Requirements
- WHEN Bewegungsangebote erzeugt werden SHALL ausschließlich der sichtbare BotState verwendet werden; keine Levelimporte, Koordinatenlisten oder speziellen Objekt-IDs.
- WHEN eine Flugbahn gegen einen sichtbaren festen Collider oder aktive Gefahr führt SHALL dieses Angebot verworfen werden.
- WHEN der Besucher eine Strategie beschreibt SHALL die Bewertungsfunktion und eigene Regeln vollständig in current-bot.js bearbeitbar sein.
- WHEN eigene Manöver benötigt werden SHALL run und rohe Actions weiterhin verfügbar sein.
- WHEN kein Verhalten gewünscht ist SHALL das Template leer bleiben.
- WHEN ein Angebot ausgeführt wird SHALL die tatsächliche Landung maßgeblich bleiben; Berechnung ist keine Erfolgsgarantie.

## Design
race und fest verdrahtete Routen entfernen. Additiv tools.options(): lokale Lauf-, Sprung-, Fall- und Boingoangebote mit command, progress, fruitValue und durationMs. Begrenzte Abtastung sichtbarer Landeflächen und kurzer Flugbahnen auf Basis beobachteter Kollisionsboxen und tuning. Kein globaler Suchbaum, keine zweite persistent simulierte Welt. Bewegliche Gefahren mit begrenztem Vorhersagehorizont und Abstand berücksichtigen; Unsicherheit und Einschränkungen dokumentieren.
Der Beispielbot bewertet Angebote selbst, hält den gewählten Auftrag und reagiert auf Erfolg/Fehler/Respawn. Besucher kann Bewertung, Regeln, Manöver ändern. Optionen sind Vorschläge, keine versteckte feste Route.

Kurzer runUpMs-Anlauf wird unter Überhängen geometrisch mitgeprüft. drop beschreibt das Verlassen einer Kante ohne Sprungimpuls mit beobachteter Ziellandung. Rückzug unter Überhängen schafft Platz für einen neuen Absprung.

## Tasks
- [x] Verhaltenstests: beliebige IDs/verschobene Geometrie, Stacheln+Block, Lücken, unerreichbare Ziele und Boingo.
- [x] options implementieren; race/Routen und entsprechende Workerbindung ersetzen.
- [x] Bearbeitbare Beispielstrategie aktivieren und alte Routenempfehlungen entfernen.
- [x] Echte Läufe in Level 1 und 2, anschließend weitere vorhandene Level; Grenzen mit Nachweisen dokumentieren.


## Verifikation und bekannte Grenzen (16.09.2026)
- Gesamtsuite: 1184 Tests in 137 Dateien bestanden; vollständiger Build bestanden.
- Beliebige Objekt-IDs und verschobene Geometrie werden getestet; keine Leveldaten im Angebotsgenerator.
- Besuchergewichtung verändert nachweislich die Wahl zwischen direktem Fortschritt und Fruchtweg. Rohaktionen und eigene Aufträge bleiben nutzbar.
- Finale lokale Level-1-Session `2026-09-16T12:10:53.663Z`: Ziel in 40,4 s ohne Tod, 204 Fruchtpunkte.
- Finale lokale Level-4-Session `2026-09-16T12:11:24.705Z`: Ziel in 14,3 s mit zwei Toden (Abgrund und Spikehead). Das neue Fallmanöver löst die zuvor dauerhafte Sackgasse unter der Decke.
- Finale lokale Level-2-Session `2026-09-16T12:12:19.770Z`: Ziel in 34,8 s mit einem Tod.
- Weitere tatsächliche Läufe während der Entwicklung: Level 3 und 5 ohne Tod beendet, Level 6 mit einem Tod durch Kugelblitz beendet; Level 2 einmal beendet, ein späterer Lauf am Sägeabschnitt im Zeitlimit. Diese Läufe sind keine Aussage über garantierte Reproduzierbarkeit.
- Dynamische Gefahren sind weiterhin nur näherungsweise vorhersehbar. Der konservative Puffer kann Angebote vollständig sperren; es gibt noch keine allgemeine Sackgassenauflösung. Die Beispielstrategie hält laufende Aufträge und reagiert daher währenddessen nicht vollständig auf neu auftauchende Gefahren. Keine Zusage eines fehlerfreien All-Level-Bots.

## Ergänzung: Leere Strategie-Hülle
Auftrag/Freigabe vom 16.09.2026: Template mit der Essenz der neuen API aufbauen und anschließend den Stand pushen. Die bestehende Freigabe zum autonomen Arbeiten gilt weiter.

- WHEN das unveränderte Template läuft SHALL es keine Bewegung auswählen und [] liefern.
- WHEN der Agent die Auswahlfunktion ausfüllt SHALL die Hülle Angebote bewerten, gewählte Aufträge fortsetzen und bei Respawn/Epochwechsel zurücksetzen können.
- Bewertung und Auswahl bleiben als kleine Funktionen in der Bot-Datei; keine versteckte Standardstrategie. Ein kommentiertes Auswahlbeispiel zeigt den Einstieg. Eigene Regeln dürfen die Auftragsfortsetzung ersetzen.
- Test zuerst: Auswahl aktivieren, laufenden Auftrag beibehalten und nach Respawn verwerfen. Bestehenden Leerlauftest beibehalten; danach Template implementieren und gezielt verifizieren.

Verifikation der Hülle: Leerlauf, aktivierte Auswahl, Auftragsfortsetzung und Respawn-Reset bestanden. Abschließende Gesamtsuite: 1185 Tests in 137 Dateien grün.
