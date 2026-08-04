# Requirements: Game-Audio (Hintergrundmusik + Jump/Collect-SFX + Lautstärke-UI)

## Kontext

Die Assets liegen unter `client/public/assets/Audio/`: `theme.mp3` (Loop-Hintergrundmusik),
`jump.mp3` und `collect.mp3` (kurze Soundeffekte). Bezug zu `docs/03-architektur.md`
(Client-Architektur: Phaser-Szene + React-Shell) und `docs/01-konzept.md` (Standerlebnis –
Sound trägt zur "Arcade"-Atmosphäre bei). Betrifft primär `client/src/game/scenes/RaceScene.ts`
(Spiellogik/Sprung/Coin-Pickup) sowie die React-Seiten `DevPage`, `AdminPage`, `PresentPage`.

Ziel dieses Features:
1. Hintergrundmusik (`theme`) läuft als Loop während die Arena aktiv ist.
2. Sprung-Sound (`jump`) spielt bei jedem tatsächlichen Absprung (Tastatur- und Bot-Steuerung).
3. Collect-Sound (`collect`) spielt bei jedem Coin/Frucht-Einsammeln.
4. Eine wiederverwendbare React-UI-Komponente bietet Mute-Toggle + Lautstärke-Slider
   (eine gemeinsame Master-Lautstärke für Musik + SFX).
5. Die Einstellung wird über Reloads hinweg im Browser gemerkt (`localStorage`).
6. Die Admin-Ansicht kann die Audio-Einstellung serverseitig an die Present-Ansicht
   übertragen (vorbereitend – `PresentPage` hat aktuell noch keinen Phaser-Canvas, empfängt
   die Einstellung aber bereits und übernimmt sie in den lokalen Audio-Store).

## User Stories

### US-1: Hintergrundmusik

Als Standbetreuer möchte ich, dass beim Start der Arena automatisch die Hintergrundmusik als
Endlosschleife abgespielt wird, damit die Arena am Messestand akustisch wahrnehmbar ist.

Akzeptanzkriterien:
- WHEN die `RaceScene` erfolgreich startet (`create()`) SHALL DAS SYSTEM die Hintergrundmusik
  (`theme`) als Loop mit der aktuellen Master-Lautstärke starten.
- WHEN die Master-Lautstärke oder der Mute-Status sich während des Spiels ändert SHALL DAS
  SYSTEM die laufende Hintergrundmusik ohne Neustart der Szene in Echtzeit anpassen.
- WHEN die `RaceScene` beendet/zerstört wird (`shutdown`) SHALL DAS SYSTEM die
  Hintergrundmusik stoppen und alle zugehörigen Ressourcen/Subscriptions freigeben.

### US-2: Sprung-Sound

Als Standbetreuer möchte ich, dass bei jedem Sprung ein Sound abgespielt wird, damit Aktionen
im Spiel akustisch spürbar sind – unabhängig davon, ob ein Mensch oder ein Bot springt.

Akzeptanzkriterien:
- WHEN ein per Tastatur gesteuerter Racer springt (Sprung-Taste gedrückt UND Racer steht auf
  dem Boden, d.h. ein tatsächlicher Sprung wird ausgelöst) SHALL DAS SYSTEM den Sound `jump`
  einmalig abspielen.
- WHEN ein von einem Bot gesteuerter Racer die Action `"jump"` ausführt UND dabei auf dem
  Boden steht (d.h. ein tatsächlicher Sprung wird ausgelöst) SHALL DAS SYSTEM den Sound `jump`
  einmalig abspielen.
- WHEN die Sprung-Taste/-Action gehalten wird, während der Racer sich bereits in der Luft
  befindet (kein neuer Sprung ausgelöst) SHALL DAS SYSTEM den Sound `jump` NICHT erneut
  abspielen.

### US-3: Collect-Sound

Als Standbetreuer möchte ich, dass beim Einsammeln einer Münze/Frucht ein Sound abgespielt
wird, damit Belohnungsmomente akustisch verstärkt werden.

Akzeptanzkriterien:
- WHEN ein Racer eine noch nicht eingesammelte Münze/Frucht berührt (regulärer Coin-Pickup)
  SHALL DAS SYSTEM den Sound `collect` einmalig abspielen.
- WHEN eine aus einem Block ausgelöste Münze anschließend eingesammelt wird SHALL DAS SYSTEM
  denselben `collect`-Sound abspielen (kein Sonderfall gegenüber regulären Münzen).

### US-4: Lautstärke-Steuerung im UI

Als Standbetreuer möchte ich Hintergrundmusik und Soundeffekte über einen Toggle und einen
Regler in der Web-UI steuern können, damit ich die Lautstärke am Stand situativ anpassen kann
(z.B. stummschalten bei Präsentationen/Gesprächen).

Akzeptanzkriterien:
- WHEN die UI-Komponente zur Audio-Steuerung angezeigt wird SHALL DAS SYSTEM einen
  Mute/Unmute-Toggle und einen Lautstärke-Regler (0–100 %) darstellen, die den aktuellen
  Zustand widerspiegeln.
- WHEN der Mute-Toggle aktiviert wird SHALL DAS SYSTEM sowohl Hintergrundmusik als auch alle
  Soundeffekte stummschalten (Lautstärke effektiv 0), unabhängig vom eingestellten
  Lautstärke-Wert.
- WHEN der Mute-Toggle deaktiviert wird SHALL DAS SYSTEM Hintergrundmusik und Soundeffekte
  wieder mit dem zuletzt eingestellten Lautstärke-Wert hörbar machen.
- WHEN der Lautstärke-Regler verändert wird SHALL DAS SYSTEM die neue Lautstärke auf
  Hintergrundmusik und alle nachfolgend abgespielten Soundeffekte gemeinsam anwenden (eine
  gemeinsame Master-Lautstärke, keine getrennten Regler für Musik/SFX).
- WHEN Mute-Status oder Lautstärke geändert werden SHALL DAS SYSTEM diese Werte im
  `localStorage` des Browsers persistieren.
- WHEN die Anwendung neu geladen wird UND zuvor gespeicherte Audio-Einstellungen vorhanden
  sind SHALL DAS SYSTEM diese Einstellungen beim Start wiederherstellen (statt auf
  Standardwerte zurückzufallen).

### US-5: Admin→Present Synchronisierung (vorbereitend)

Als Standbetreuer möchte ich, dass eine in der Admin-Ansicht geänderte Audio-Einstellung an
alle verbundenen Present-Clients übertragen wird, damit ich die Lautstärke der Präsentations-
Ansicht zentral von der Admin-Ansicht aus steuern kann – auch wenn die Present-Ansicht aktuell
noch keinen Phaser-Canvas besitzt.

Akzeptanzkriterien:
- WHEN in der Admin-Ansicht Mute-Status oder Lautstärke über die Audio-Steuerungs-Komponente
  geändert werden SHALL DAS SYSTEM diese Änderung als Broadcast-Nachricht über die bestehende
  WebSocket-Verbindung an den Server senden.
- WHEN der Server eine Audio-Einstellungs-Nachricht empfängt SHALL DAS SYSTEM sie an alle
  anderen verbundenen Clients weiterleiten (analog zum bestehenden `ping-broadcast`-Mechanismus).
- WHEN die Present-Ansicht eine Audio-Einstellungs-Nachricht empfängt SHALL DAS SYSTEM den
  lokalen Audio-Zustand der Present-Ansicht entsprechend aktualisieren (auch wenn dort aktuell
  noch keine Phaser-Szene/kein Ton abgespielt wird).

## Nicht-Ziele

- Kein separater Regler für Musik vs. Soundeffekte (bewusst nur eine Master-Lautstärke, siehe
  US-4).
- Kein Multi-Kamera-/Turnier-Sound (mehrere gleichzeitige Racer/Heats) – das ist an bestehende,
  noch offene Features gebunden und hier nicht Teil des Scopes.
- Kein Einbau eines Phaser-Canvas in `PresentPage` – dies bleibt einem späteren Feature
  vorbehalten; hier wird nur der Empfang/die Übernahme der Audio-Einstellung vorbereitet.
- Keine weiteren Soundeffekte (z.B. für Hazard-Kontakt, Checkpoint, Ziel-Erreichen) – bewusst
  auf die drei vorhandenen Assets (`theme`, `jump`, `collect`) beschränkt (YAGNI).

## Offene Fragen

Keine – Kernentscheidungen (Master-Lautstärke, localStorage-Persistenz, wiederverwendbare
Komponente mit Admin→Present-Vorbereitung) wurden mit dem Nutzer vor Erstellung dieses
Dokuments geklärt.
