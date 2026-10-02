# Design: Präsentationsvideo für den Messestand

## Status

Requirements und Design freigegeben am 28.09.2026. Der Nutzer hat mit
„Ja setz um!“ das Design und den direkten Implementierungsstart bestätigt.

## Architektur-Überblick

Ein eigenständiger Offline-Renderer erzeugt einen 60-sekündigen Motion-Design-
Clip mit den vorhandenen Pixel-Art-Spielgrafiken. Das Ergebnis ist eine MP4,
die auf dem Standrechner im Videoplayer als Schleife läuft. Die Übertragung
zum C-Touch erfolgt per HDMI.

Der Renderer verwendet Python, Pillow für Bildkomposition und `imageio-ffmpeg`
für einen paketierten FFmpeg-Encoder. Die Werkzeuge werden isoliert in einer
lokalen virtuellen Umgebung eingerichtet und mit festen Versionen dokumentiert.
Python ist vorhanden; Pillow und FFmpeg sind derzeit noch nicht eingerichtet.
Eine Browseraufnahme ist für diese Umsetzung nicht erforderlich.

Lieferobjekte:

- `media/booth-presentation/dist/coin-quest-arena.mp4`
- `media/booth-presentation/README.md`: Abspielen, Neurendern und Vor-Ort-Check.
- Renderer, Szenenbeschreibung und Tests unter `media/booth-presentation/`.
- Lokal verfügbare Schriftdateien mit zugehöriger Lizenzinformation unter
  `media/booth-presentation/assets/`.

Der bestehende Git-Ignore für `dist/` erfasst das gerenderte Video. Es wird
als lokale Ausgabedatei geliefert; die reproduzierbaren Quellen sind versionierbar.

## Visuelle Gestaltung

### Bildsprache

- Dunkle marinefarbene Bühne, Cyan, Pink, Gelb und Grün entsprechend
  `client/src/theme.css`.
- Pixel-Art-Figuren aus den vorhandenen Run-/Idle-/Jump-Spritesheets,
  vorhandene Früchte und Terrain-Ausschnitte.
- Harte Pixelkanten durch Nearest-Neighbor-Skalierung; ruhige geometrische
  Flächen und dezente Bewegung im Hintergrund.
- Große, gut lesbare Sans-Serif-Schrift für die Aussagen; Pixel-Charakter
  entsteht vor allem durch Spielgrafiken, Rahmen und geometrische Akzente.
- „COIN QUEST ARENA“ bleibt als kleine, wiederkehrende Marke sichtbar.
- Keine zusätzliche Textfülle durch technische Codefenster oder Debug-HUDs.

### Layout und Lesbarkeit

Arbeitsfläche 1920 × 1080 px mit mindestens 96 px sicherem Außenabstand.
Hauptaussagen etwa 76–104 px, kurze Zusatzzeilen mindestens 42 px.
Längere Hauptaussagen werden bewusst über zwei Zeilen gesetzt. Textbreiten
werden mit den tatsächlich verwendeten Schriftmetriken geprüft.

Übergänge dauern etwa 0,5 Sekunden und blenden über die gemeinsame
Hintergrundbühne, damit sich zwei Überschriften nicht überlagern.
Nach dem Aufbau bleiben Aussagen
mehrere Sekunden stabil stehen. Animationen bewegen vor allem die Bildmotive.
Jede Szene hat eine Hauptaussage und höchstens eine ergänzende Zeile;
Marke und die diskrete Kennzeichnung „Spielillustration“ sind feste Bildlabels.

### Szenen / Timeline

| Zeit | Text und Inszenierung |
|---|---|
| 0–7 s | „Deine Strategie. Dein Bot. Dein Rennen.“ Vier Charaktere auf einer gemeinsamen Titelbühne, noch ohne Wettkampfdarstellung. |
| 7–18 s | „Beschreib deine Idee.“ Große stilisierte Eingabekarte mit „Sammle viele Früchte und geh möglichst wenig Risiko ein.“ Kurzer Textaufbau, danach lange Lesephase. |
| 18–28 s | „devkcode macht daraus deinen Bot.“ Die Eingabekarte geht in eine Bot-Karte mit animierter Figur über. Zusatz: „Keine Programmierkenntnisse nötig“. |
| 28–40 s | „Ausprobieren. Verbessern. Loslegen.“ Große illustrierte Levelpassage mit laufendem/springendem Bot, Früchten und Hindernis. |
| 40–51 s | „Dein Bot tritt im Turnier an.“ Vier klar getrennte Levelkacheln mit jeweils einem Bot; unterschiedliche Akzentfarben und Bewegungsphasen. |
| 51–60 s | „Welche Strategie gewinnt?“ Zusatz: „Bau deinen Bot – hier am Stand.“ Figuren und Hintergrund führen zur Titelkomposition zurück. |

Die Spielpassage und das Vierer-Grid werden als „Spielillustration“
gekennzeichnet. Sie visualisieren den Ablauf, statt konkrete Simulationsergebnisse
zu behaupten. Es werden keine Punktzahlen, Besucheridentitäten oder Sieger erfunden.
Die Schlusssekunde blendet zur Anfangskomposition zurück, sodass der Bildinhalt
am Loop-Punkt zusammenpasst. Die eigentliche Wiederholung übernimmt der Player.

## Schnittstellen und Datenmodelle

- `Scene`: Kennung, Start-/Endframe, Haupttext, optionale Zusatzzeile, Bildmotiv.
- Feste Timeline mit 1800 Frames bei 30 fps; Szenen schließen lückenlos aneinander an.
- `scene_at(frame)`: liefert Szene und lokalen Fortschritt für einen gültigen Frame.
- `render_frame(frame, assets)`: berechnet ein RGB-Bild allein aus Frameindex,
  Szenendaten und vorbereiteten Assets; keine Echtzeituhr oder ungesetzte Zufallswerte.
- Asset-Loader: lädt Bilder und Schriften einmalig, zerlegt Spritesheets nach
  vorhandenen Framegrößen und bereitet wiederkehrende Skalierungen vor.
- Kommandozeile: vollständiger Export sowie Einzelbild-/Kurzvorschau für die Prüfung.

## Rendering und Export

1. Assets, Schriften, Timeline und Textbegrenzungen vorab validieren.
2. Statische Bühnen-/Textflächen und Spritevarianten vorberechnen.
3. Frames sequenziell rendern und direkt an FFmpeg übergeben; keine Ablage
   von 1800 unkomprimierten Einzelbildern.
4. H.264-MP4, 1920 × 1080, 30 fps, `yuv420p`, quadratische Pixel,
   CRF ungefähr 18, `faststart`, ohne Tonspur exportieren.
5. Erst nach erfolgreichem Encoder-Ende die temporäre MP4 an den finalen
   Ausgabepfad verschieben.
6. Den fertigen Stream vollständig decodieren und technische Eigenschaften prüfen.

Das Video selbst enthält alle Bildinhalte. Schriften, Server, Python und
Internet werden nur für die Herstellung benötigt, nicht zur Wiedergabe.

## Fehlerbehandlung und Edge Cases

- Fehlende Assets oder Schriften: Abbruch vor Beginn des langen Exports mit
  konkretem Pfad; kein stiller Schriftwechsel mit veränderten Umbrüchen.
- Textüberlauf: Vorabfehler mit Szenenkennung; kein Abschneiden von Aussagen.
- Ungültige Timeline oder Sprite-Geometrie: frühzeitiger Validierungsfehler.
- Encoderfehler: Fehlermeldung weitergeben, temporäre Ausgabe entfernen und
  eine eventuell vorhandene fertige MP4 bewahren.
- Ausgabe auf einem 4K-Display: Skalierung durch Player/Display; Quelldatei
  bleibt entsprechend den Requirements Full HD.

## Test-Strategie

Die Implementierung erfolgt testgetrieben mit Python-`unittest`.
Sinnvolle automatisierte Prüfungen werden jeweils zuerst rot ausgeführt:

- Timeline: vollständige 60 Sekunden, korrekte Szenenzuordnung an Grenzen,
  keine Lücken oder Überlappungen und definierter Umgang mit ungültigen Frames.
- Layout: alle freigegebenen Haupt-/Zusatztexte passen mit den echten
  Schriftmetriken in die vorgesehenen Textboxen einschließlich Umlauten.
- Rendering: repräsentative Szenenframes können mit Originalassets erzeugt
  werden; Übergang und Loop-Rückführung verwenden gültige Bildgrößen.
- Export: kurzer echter Encode-/Decode-Test prüft Auflösung, Bildrate,
  Codec/Pixelformat und Fehlerweitergabe statt nur Aufrufargumente zu testen.

Nach dem vollständigen Rendern: technische Prüfung der MP4 auf Laufzeit,
Framezahl und vollständige Decodierbarkeit. Visuelle Prüfung repräsentativer
Frames jeder Szene und der Übergänge auf Bildaufbau, Kontrast und Textumbrüche.
Temporäre Prüfbilder werden nach der Sichtung gelöscht.

Die Bewegungswirkung bei normaler Abspielgeschwindigkeit sowie die tatsächliche
Lesbarkeit aus drei bis fünf Metern werden auf dem Standrechner/C-Touch geprüft.
Diese Vor-Ort-Prüfung wird bis zur Rückmeldung ausdrücklich als offen dokumentiert.

## Wiedergabe am Stand

README-Anleitung für VLC: MP4 öffnen, Wiederholmodus auf die einzelne Datei
stellen, Player auf das HDMI-Display verschieben und Vollbild aktivieren.
Für den Standbetrieb Bildschirmruhe deaktivieren und Benachrichtigungen
ausblenden. Die Datei kann beliebig auf den Zuspielrechner kopiert werden.

## Requirements-Abdeckung

- US-1: Titelszene, natürliche Sprache, Hinweis auf fehlende Programmierhürde,
  wiederkehrende Marke und eigenständig verständliche Szenen.
- US-2: freigegebene Reihenfolge, Beispielauftrag, Originalassets und
  gekennzeichnete Illustration mit vier getrennten Wettkampfansichten.
- US-3: rein visuelle Vermittlung, begrenzte Textmenge, große Typografie,
  ruhige Lesephasen und dokumentierter Vor-Ort-Lesbarkeitstest.
- US-4: lokale MP4, 60-Sekunden-Timeline, Loop-Rückführung, Einladung zur
  Teilnahme und Anleitung für Rechner/HDMI.

## Auswirkungen auf bestehenden Code

Neue Dateien ausschließlich unter `media/booth-presentation/` und diesem
Feature-Ordner. Vorhandene Spielassets werden lesend wiederverwendet.
Abhängigkeiten des Renderers liegen isoliert von den npm-Workspaces.
