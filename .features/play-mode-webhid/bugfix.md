# Bugfix: Steuerkreuz links/rechts über WebHID statt Gamepad-API

Bezug: `.features/play-mode/`, Messdaten vom Stand (Selbsttest `/play/test`).

## Aktuelles Verhalten (Bug)

Mit dem am Stand verwendeten Adapter (`USB Gamepad (STANDARD GAMEPAD Vendor:
0079 Product: 0011)`, Edge 151 / Chromium, macOS) erreichen **links und rechts
die Anwendung nie**. Gemessen über 2508 Frames bei 120 Hz:

```
"mapping": "standard"
"buttonCount": 16          (Standard-Mapping definiert 17)
"axisCount": 0             (Standard-Mapping definiert 4)
"buttonsSeen": [0,1,2,3,4,5,8,9,12,13]
```

Hoch (12) und runter (13) kommen zuverlässig an, links (14) und rechts (15)
nie – auch bei langem Halten nicht. `pressedWithoutValue` ist leer, es liegt
also nicht an `pressed`/`value`.

## Erwartetes Verhalten

Alle Richtungen des Steuerkreuzes sind nutzbar, ohne dass der Messestand von
Browser- oder Adapter-Eigenheiten abhängt.

## Was bleibt unverändert (Regressions-Schutz)

- Der bestehende Gamepad-API-Pfad (`GamepadPoller`, `readGamepad`,
  `GamepadController`) bleibt vollständig erhalten und Standard für Geräte, die
  korrekt gemappt werden.
- Die logische Eingabe-Abstraktion (`PlayInput`, Kalibrierungsablauf,
  Stations-Reducer) bleibt unverändert.

## Root Cause (nach Analyse)

Chromiums eingebautes "standard gamepad mapping" ist für diese Vendor/Product-
Kombination **unvollständig**: Das Gerät sendet sein Steuerkreuz als
Hat-Switch; Chromium übersetzt davon nur einen Teil und meldet weder die
fehlenden Tasten noch Achsen. Die Daten erreichen die Seite gar nicht – aus der
Anwendung heraus ist das über `navigator.getGamepads()` nicht reparierbar.

## Fix-Ansatz

**WebHID** (`navigator.hid`) liest dasselbe Gerät roh aus und umgeht die
Mapping-Schicht vollständig. Chromium unterstützt das; eine einmalige
Nutzerfreigabe pro Gerät genügt und bleibt für die Herkunft gespeichert.

Umsetzung in Stufen:

1. **Reine Logik** (`hid/hidBindings.ts`): Belegungen auf Roh-Bytes.
   `detectHidBinding` unterscheidet drei Fälle:
   - einzelnes gekipptes Bit → klassische Taste,
   - Änderung nur im unteren Nibble → Hat-Switch (exakter Wertvergleich, sonst
     würde „hoch" (0) auch für „links" (6) anschlagen),
   - großer Byte-Sprung → Achse am Anschlag (mit Toleranz gegen Rauschen).
2. **Adapter** (`hid/HidSource.ts`): hält den neuesten Report je Report-ID,
   inklusive Zähler als Lebenszeichen. Vollständig über `FakeHidDevice`
   testbar.
3. **Nachweis am Stand** (`hid/HidProbe.tsx`, eingebettet in `/play/test`):
   zeigt die rohen Bytes live und protokolliert jede Byte-Änderung. Damit ist
   in Sekunden sichtbar, ob links/rechts im Rohdatenstrom enthalten sind.
4. **Integration** (offen, erst nach Nachweis): HID als alternative Eingabe-
   quelle je Station, mit Kalibrierung auf Roh-Bytes und Rückfall auf die
   Gamepad-API.

Schritt 4 wird bewusst erst umgesetzt, wenn Schritt 3 bestätigt, dass die
Richtungen per WebHID ankommen – andernfalls wäre der Aufwand wirkungslos.

## Nachtrag: Gamepad-API-Pfad entfernt

Nachdem der Rohzugriff am Stand bestätigt war, wurde der alte Pfad über
`navigator.getGamepads()` vollständig entfernt – er funktionierte mit der
eingesetzten Hardware nachweislich nicht und hätte als zweite, ungetestete
Eingabekette dauerhaft Pflegeaufwand verursacht.

Entfernt: `bindings.ts`, `calibration.ts`, `CalibrationWizard.tsx`,
`GamepadController.ts`, `GamepadPoller.ts`, `mappingStore.ts`,
`padDiagnostics.ts`, `restingState.ts` samt Tests sowie die Seite
`/play/diagnose` (durch `/play/test` abgelöst).

Herausgelöst statt gelöscht, weil quellenunabhängig:

- `input/inputs.ts` – `PLAY_INPUTS`, `PlayInput`, `CALIBRATION_STEPS`,
  `INPUT_LABELS`, `StationId`
- `input/readGamepad.ts` – `GamepadSnapshot`, `emptySnapshot`, `risingEdges`,
  `hasAnyInput` (die logische Sprache zwischen Quelle und Spiel)
- `storage.ts` – `StorageLike`, `safeLocalStorage` für beide Stores

`/play/test` bleibt als Diagnosewerkzeug erhalten: Es zeigt weiterhin beides –
was die Gamepad-API meldet UND was per Rohzugriff ankommt. Genau dieser
Vergleich hat die Ursache aufgedeckt und hilft, wenn am Stand andere Hardware
auftaucht.
