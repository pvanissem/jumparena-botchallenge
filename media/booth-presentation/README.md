# Coin Quest Arena – Standvideo

## Fertiges Video

**[`dist/coin-quest-arena.mp4`](dist/coin-quest-arena.mp4)**

- 60 Sekunden, 1920 × 1080 Pixel (16:9), 30 fps.
- H.264, `yuv420p`, MP4 mit Faststart, ca. 2,1 MB.
- Ohne Tonspur; alle Aussagen stehen im Bild.
- Sechs Szenen: Strategie → Idee beschreiben → devkcode erstellt den Bot →
  ausprobieren/verbessern → Turnier → Einladung zum Mitmachen.
- Animierte Original-Spielgrafiken; Level- und Turnierpassage sind
  gekennzeichnete Spielillustrationen.
- Schlussbild führt zum Anfang zurück. Wiederholung im Player einschalten.

Die MP4 kann alleine auf den Standrechner kopiert werden. Zur Wiedergabe
sind weder dieses Repository noch Python, ein Spielserver oder Internet nötig.
`dist/` ist ein ignorierter Build-Ordner; nach einem frischen Git-Checkout
muss das Video neu gerendert oder separat kopiert werden.

## Auf dem C-Touch über HDMI abspielen

1. Rechner per HDMI anschließen und das C-Touch als Anzeige wählen.
2. `coin-quest-arena.mp4` in **VLC** öffnen.
3. Wiederholung der **einzelnen Datei** aktivieren: Wiederholsymbol so
   einstellen, dass es eine **1** zeigt. Zufallswiedergabe ausschalten.
4. VLC auf das C-Touch verschieben und Vollbild aktivieren
   (Doppelklick ins Video oder das Vollbildsymbol).
5. Für die Standzeit Ruhezustand/Bildschirmschoner deaktivieren und
   Benachrichtigungen ausblenden.

Vor dem Einsatz zwei Durchläufe ansehen: keine Player-Einblendungen,
keine störende Pause am Wiederholpunkt, vollständige Anzeige ohne Beschnitt.
Haupttexte aus drei bis fünf Metern Entfernung prüfen. Bei einem 4K-Display
kann der Player das Full-HD-Video auf die Bildschirmfläche skalieren.

## Reproduzieren

Python 3.9 oder neuer; Befehle vom Repository-Wurzelverzeichnis aus.
Die gebündelte FFmpeg-Binary von `imageio-ffmpeg` muss die Plattform unterstützen;
alternativ kann `IMAGEIO_FFMPEG_EXE` auf eine vorhandene FFmpeg-Binary zeigen.

```sh
python3 -m venv media/booth-presentation/.venv
media/booth-presentation/.venv/bin/python -m pip install -r media/booth-presentation/requirements.txt
media/booth-presentation/.venv/bin/python -m unittest discover -s media/booth-presentation -v
media/booth-presentation/.venv/bin/python media/booth-presentation/video.py
```

Unter Windows den Interpreterpfad durch
`media/booth-presentation/.venv/Scripts/python.exe` ersetzen.
Paketversionen sind in `requirements.txt` festgelegt; die Outfit-Schrift
inklusive OFL-Lizenz liegt lokal unter `assets/`.

Texte, Farben, Szenengrenzen und Bildmotive stehen in `video.py`.
Nach Änderungen Tests ausführen und das Video erneut rendern.
Der Export validiert Schrift-/Asset-Verfügbarkeit und Textgrenzen vorab,
prüft die fertige Datei durch vollständige Decodierung und ersetzt erst
danach die vorherige MP4.

### Einzelbild oder kurze Vorschau

```sh
# Bild bei Sekunde 33, nur für die Sichtprüfung; danach löschen.
media/booth-presentation/.venv/bin/python media/booth-presentation/video.py --still 990 --output media/booth-presentation/dist/preview.png

# Drei Sekunden der Turnierszene.
media/booth-presentation/.venv/bin/python media/booth-presentation/video.py --start 1230 --frames 90 --output media/booth-presentation/dist/preview.mp4

# Fertiges Vollvideo vollständig decodieren und technische Eigenschaften prüfen.
media/booth-presentation/.venv/bin/python media/booth-presentation/video.py --verify
```

## Prüfstand am 28.09.2026

- **11 Tests bestanden:** Timeline und Szenengrenzen, ungültige Frames,
  Textbegrenzungen mit echter Schrift, Originalassets, deterministische
  Animation, fehlerhafte Sprites, Übergänge ohne überlagerte Überschriften,
  Loop-Anschluss, echter Encode-/Decode-Test, Erhalt vorhandener Ausgabe
  bei Encoder-/Framefehlern.
- Vollvideo erfolgreich erzeugt und vollständig decodiert: **1800 Frames,
  60 Sekunden, 1920 × 1080, 30 fps, H.264 / yuv420p**.
- Repräsentative Einzelbilder aller sechs Szenen und Übergänge gesichtet;
  Prüfbilder anschließend gelöscht.
- **Offen für das Standteam:** Abspielen in Echtzeit auf dem Zuspielrechner,
  Wiederholung mit dem verwendeten Player und Lesbarkeit am echten C-Touch
  aus drei bis fünf Metern. Diese Hardwareprüfung wurde hier nicht durchgeführt.

## Abgleich mit den Requirements

| Story | Ergebnis |
|---|---|
| US-1: Idee verstehen | Titelbotschaft, devkcode, Hinweis auf fehlende Programmierhürde und wiederkehrender Spielname umgesetzt. |
| US-2: Ablauf zeigen | Alle Schritte in freigegebener Reihenfolge, Beispielauftrag, Originalgrafiken und vier getrennte illustrierte Spielansichten umgesetzt. |
| US-3: Großbild ohne Ton | Visuelle Aussagen, große Schrift, sichere Textabstände und ruhige Lesephasen umgesetzt. Physische Fernlesbarkeit noch vor Ort zu bestätigen. |
| US-4: Einfach abspielen | Lokale MP4, 60 Sekunden, Rückführung zum Anfang, Teilnahmeaufruf und HDMI-/VLC-Anleitung geliefert. |
