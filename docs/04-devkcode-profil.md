# 04 – devkcode-Profil ("Bot-Baumeister")

Dieses Dokument beschreibt, wie das speziell konfigurierte devkcode-Profil für den
Messestand funktionieren soll. Es ist die eigentliche "Show"-Komponente des Konzepts.

## Ziel des Profils

Ein Konferenzbesucher ohne Programmierkenntnisse soll in 15–20 Minuten, rein durch
natürlichsprachliche Beschreibung seiner Strategie, eine funktionierende `decide(state)`-
Funktion erhalten, die er anschließend ins Rennen einbringen kann.

## Bausteine des Profils

### 1. System-Prompt / Kontext (fest hinterlegt, nicht sichtbar für Nutzer)
Enthält:
- Erklärung des Spiels (Mario-artiges Level, Ziel: Coins sammeln + Ziel erreichen).
- Die **vollständige Bot-API-Spezifikation** (siehe [02-bot-api.md](02-bot-api.md)) inkl.
  `BotState`-Interface, erlaubte Actions, Regeln/Grenzen.
- Klare Anweisung: **Nur** die Datei mit der `decide`-Funktion erzeugen/bearbeiten, keine
  anderen Dateien, keine externen Bibliotheken, kein `import`.
- Stil-Vorgabe: Code soll einfach, lesbar und gut kommentiert sein (auch wenn der Nutzer ihn
  nicht liest – hilft für Transparenz/Nachvollziehbarkeit am Stand, z.B. auf einem Zweitbildschirm).
- Ton/Interaktionsstil: Freundlich, in einfacher Sprache, aktiv nachfragend ("Was soll dein
  Bot tun, wenn ein Gegner in der Nähe ist?").

### 2. Geführter Gesprächsablauf (Vorschlag)
1. Begrüßung + kurze Erklärung des Spiels.
2. Frage nach der Grundstrategie ("Wie soll dein Bot sich verhalten?").
3. Ggf. 1–2 Rückfragen zu Details (Verhalten bei Gefahr, Prioritäten: Sicherheit vs.
   Geschwindigkeit vs. Vollständigkeit beim Münzensammeln).
4. Generierung der `decide`-Funktion.
5. Kurze, laienverständliche Zusammenfassung, was der generierte Bot tut ("Dein Bot rennt
   immer Richtung Ziel, sammelt Münzen die er auf dem Weg sieht, und springt über Gefahren").
6. Export/Speichern der Datei (Dateiname z.B. `bot-<teilnehmername>.js`).
7. Ein Testlauf erzeugt pro Versuch (Start/Respawn bis Tod, Ziel oder Abbruch)
   eine zeitgestempelte JSON-Datei unter `client/src/bot/runs/`. Der Agent liest
   die neuesten Runs, nennt höchstens zwei Beobachtungen und schlägt genau eine
   Änderung vor. Umsetzung erst nach Zustimmung des Besuchers; danach höchstens
   ein kurzer Kontrolllauf.

### 3. Zeitbudget-Steuerung
- Bei 15–20 Minuten pro Teilnehmer muss der Ablauf straff geführt werden – das Profil sollte
  nicht endlos viele Rückfragen stellen, sondern nach 2–3 Interaktionsrunden auf Generierung
  drängen ("Ich habe genug Infos, ich baue jetzt deinen Bot").

### 4. Fehlertoleranz
- Falls der generierte Code fehlerhaft ist (Syntaxfehler o.ä.), muss ein Validierungsschritt
  vor dem "fertig"-Zustand erfolgen (z.B. Testausführung der Funktion mit einem Beispiel-State
  in einer Sandbox, bevor die Datei final exportiert wird).

### 5. Lauf-Telemetrie

Die Telemetrie ist ausschließlich im Bot-Modus von `/dev` aktiv. Jeder Tod
schließt den aktuellen Versuch ab und schreibt genau eine neue Timestamp-Datei;
der Respawn beginnt einen neuen Versuch. Arena-Ereignisse sind Fakten,
heuristische `findings` nur Diagnosehinweise. `npm run reset-bot` löscht die
Run-Dateien zusammen mit dem Zurücksetzen der Bot-Arbeitsdatei.

## Beispiel-Interaktion (illustrativ)

> **devkcode:** Willkommen bei Coin Quest Arena! Dein Bot muss durch ein Mario-Level laufen,
> Münzen sammeln und das Ziel erreichen. Wie soll dein Bot sich grundsätzlich verhalten?
>
> **Nutzer:** Er soll immer so schnell wie möglich zum Ziel, aber wenn eine Münze direkt auf
> dem Weg liegt, soll er sie mitnehmen.
>
> **devkcode:** Verstanden. Soll er auch Umwege in Kauf nehmen, um versteckte Münzen aus
> Blöcken zu holen, oder eher auf Geschwindigkeit setzen?
>
> **Nutzer:** Lieber schnell, versteckte Münzen kann er ignorieren.
>
> **devkcode:** Alles klar, wie soll er auf Gefahren reagieren?
>
> **Nutzer:** Einfach drüber springen, wenn möglich.
>
> **devkcode:** *(generiert `decide()`-Funktion, fasst zusammen, exportiert Datei)*

## Offene Punkte für dieses Profil

- Wie wird das Profil technisch am Stand bereitgestellt (lokale devkcode-Installation pro
  Station, oder ein zentraler Rechner mit mehreren Terminals)?
- Soll es vorgefertigte "Persönlichkeits"-Vorlagen geben (z.B. "Der Vorsichtige", "Der
  Draufgänger", "Der Sammler"), die der Nutzer nur noch anpasst, um die Einstiegshürde weiter
  zu senken?
- Wie wird sichergestellt, dass am Ende wirklich eine gültige, lauffähige Datei rauskommt
  (Validierungsschritt, siehe oben)?
