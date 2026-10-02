# Tasks: Präsentationsvideo für den Messestand

Design und direkter Start am 28.09.2026 durch „Ja setz um!“ freigegeben.

- [x] 1. Freigabe und Implementierungsschritte dokumentieren.
- [x] 2. Isolierte Renderumgebung, Originalassets und lokale Schrift vorbereiten.
      Bezug: Design „Architektur-Überblick“, „Visuelle Gestaltung“.
- [x] 3. Timeline- und Textlayout-Tests schreiben (rot), Szenendaten und
      Layoutvalidierung implementieren (grün), gemeinsame Werte aufräumen.
      Bezug: US-1–4, Design „Schnittstellen und Datenmodelle“.
- [x] 4. Renderingtests mit Originalassets schreiben (rot), sechs animierte
      Szenen und Übergänge implementieren (grün), wiederkehrende Bildbausteine
      zusammenführen und vorberechnen. Bezug: US-1–3, Design „Szenen / Timeline“.
- [x] 5. Echten Encode-/Decode-Test und Fehlerfalltest schreiben (rot),
      MP4-Export und Kommandozeile implementieren (grün), aufräumen.
      Bezug: US-4, Design „Rendering und Export“, „Fehlerbehandlung“.
- [x] 6. Vollständiges Video rendern, Szenen und Übergänge visuell prüfen,
      vollständige Decodierung und technische Eigenschaften prüfen.
      Bezug: US-1–4, Design „Test-Strategie“.
- [x] 7. Abspiel-/Reproduktionsanleitung und Requirements-Abgleich erstellen,
      lokale MP4 übergeben. Bezug: US-4, Design „Wiedergabe am Stand“.
- [ ] 8. Vor Ort: Wiedergabe am HDMI-Rechner, Bewegungswirkung und Lesbarkeit
      aus drei bis fünf Metern am C-Touch bestätigen (durch Standteam).

## Ergebnis

MP4 unter `media/booth-presentation/dist/coin-quest-arena.mp4` erzeugt.
11 Tests bestanden; vollständige Decodierung von 1800 Frames bestätigt.
Technische Daten: 60 Sekunden, 1920 × 1080, 30 fps, H.264 / yuv420p.
Szenenbilder und Übergänge visuell geprüft, Prüfbilder gelöscht.
Requirements-Abgleich und Wiedergabeanleitung in
`media/booth-presentation/README.md`. Task 8 bleibt als Vor-Ort-Abnahme offen.
