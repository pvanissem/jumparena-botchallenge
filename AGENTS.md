# AGENTS.md – Steering für Coin Quest Arena

## Projektüberblick

Coin Quest Arena ist ein Messestand-Projekt: Besucher bauen ohne eigene
Programmierkenntnisse mit Hilfe der `devkcode`-CLI (via ein spezielles Bot-Profil) einen
autonomen Bot (`decide(state)`-Funktion), der anschließend in einer Phaser.js-basierten,
clientseitigen 2D-Arena gegen die Bots anderer Besucher antritt (Heats à 16 Bots,
Leaderboard). Die vollständige fachliche Beschreibung liegt in `./docs/*.md`:

- `01-konzept.md` – Idee, Ablauf am Stand, Kernentscheidungen
- `02-bot-api.md` – State/Action-Contract für Bots
- `03-architektur.md` – technische Architektur
- `04-devkcode-profil.md` – Konfiguration des devkcode-Bot-Profils
- `05-scoring-und-heats.md` – Scoring-Formel & Heat-System
- `06-level-design.md` – Level-Elemente
- `07-offene-punkte.md` – offene Fragen/Risiken (vor Umsetzung klären!)
- `08-hazards-und-utilities.md` – Hazards/Utilities-Registry
- `09-bot-artefakt-und-turnier.md` – Bot-Artefakt-Format, Sandbox, Turniermodus

Bei Widersprüchen zwischen `docs/` und Code gilt `docs/` als fachliche Quelle der Wahrheit,
sofern nicht explizit im jeweiligen Feature-Spec anders entschieden.

---

## Spec-Driven Development (Pflicht-Gate)

Dieses Projekt arbeitet **Spec Driven**, angelehnt an [Kiro](https://kiro.dev/docs/specs/).
Jede nicht-triviale Implementierung (neues Feature, größerer Umbau, Architekturänderung)
durchläuft drei Phasen, die jeweils als Datei in einem eigenen Feature-Ordner abgelegt
werden:

```
.features/<feature-name>/requirements.md
.features/<feature-name>/design.md
.features/<feature-name>/tasks.md
```

`<feature-name>` ist kebab-case und beschreibt das Feature kurz und eindeutig
(z. B. `bot-import`, `heat-scoring`, `hazard-registry`).

### Gate-Regel (verbindlich)

> **Bevor Code für ein Feature geschrieben, geändert oder generiert wird, muss der
> zugehörige Ordner `.features/<feature-name>/` mit mindestens einem freigegebenen
> `requirements.md` existieren.** Ohne freigegebene Requirements keine Implementierung.

Ausnahmen (kein Spec-Zwang):
- Trivialste Änderungen ohne Verhaltensauswirkung (Typo-Fixes, Formatierung, Kommentare,
  Dependency-Bumps ohne API-Änderung).
- Reine Recherche/Exploration ohne Codeänderung.
- Bugfixes an bestehendem, bereits spezifiziertem Verhalten (siehe „Bugfix-Modus" unten) –
  hier reicht ein schlankeres Bugfix-Spec.

Im Zweifel gilt: **lieber ein (auch kurzes) Spec anlegen als ohne zu starten.**

### Die drei Phasen

#### 1. `requirements.md` – Was soll gebaut werden?

- Beschreibt das Feature als User Stories mit Akzeptanzkriterien.
- Akzeptanzkriterien werden in **EARS-Notation** formuliert (Easy Approach to
  Requirements Syntax):

  ```
  WHEN [Ereignis/Bedingung] SHALL DAS SYSTEM [erwartetes Verhalten]
  ```

  Beispiel:
  ```
  WHEN ein Bot beim Kollisionscheck einen Hazard vom Typ "spike" berührt
  SHALL DAS SYSTEM ein Leben abziehen und den Bot zum letzten Checkpoint zurücksetzen.
  ```

- Struktur-Vorschlag:
  ```markdown
  # Requirements: <Feature-Name>

  ## Kontext
  Kurzer Bezug zu docs/ (welches Kapitel betrifft das?) und Motivation.

  ## User Stories
  ### US-1: <Titel>
  Als <Rolle> möchte ich <Ziel>, damit <Nutzen>.

  Akzeptanzkriterien:
  - WHEN ... SHALL DAS SYSTEM ...
  - WHEN ... SHALL DAS SYSTEM ...

  ## Nicht-Ziele
  Was explizit NICHT Teil dieses Features ist.

  ## Offene Fragen
  Fragen, die vor Design geklärt werden müssen (ggf. Bezug zu docs/07-offene-punkte.md).
  ```

- **Gate:** `requirements.md` muss vom Menschen (User) explizit freigegeben werden
  (z. B. "passt so", "freigegeben"), bevor `design.md` begonnen wird. Frage aktiv nach
  Freigabe, wenn unklar.

#### 2. `design.md` – Wie wird es technisch umgesetzt?

- Dokumentiert Architektur, Komponenten, Schnittstellen, Datenfluss, Fehlerbehandlung,
  Test-Strategie – bezogen auf die konkreten Requirements.
- Struktur-Vorschlag:
  ```markdown
  # Design: <Feature-Name>

  ## Architektur-Überblick
  Wie fügt sich das Feature in docs/03-architektur.md ein? Neue/geänderte Komponenten?

  ## Schnittstellen & Datenmodelle
  Typen, Funktionssignaturen, State-Erweiterungen (Bezug zu docs/02-bot-api.md falls
  relevant).

  ## Ablauf / Sequenz
  Schritt-für-Schritt oder Sequenzdiagramm (Mermaid), wie die Requirements erfüllt werden.

  ## Fehlerbehandlung & Edge Cases

  ## Test-Strategie
  Was wird wie getestet (Unit/Integration/manuell am Stand)?

  ## Auswirkungen auf bestehenden Code
  Betroffene Dateien/Module.
  ```

- **Gate:** `design.md` muss ebenfalls freigegeben werden, bevor `tasks.md` erstellt wird.
- Design muss alle Akzeptanzkriterien aus `requirements.md` abdecken. Falls ein
  Akzeptanzkriterium technisch nicht umsetzbar/sinnvoll ist, zurück zu `requirements.md`
  und dort anpassen (nicht stillschweigend im Design ignorieren).

#### 3. `tasks.md` – Welche einzelnen Schritte werden implementiert?

- Liste diskreter, klein geschnittener, trackbarer Tasks (Checkboxen), jeweils mit
  Bezug auf betroffene Requirements/Design-Abschnitte.
- Struktur-Vorschlag:
  ```markdown
  # Tasks: <Feature-Name>

  - [ ] 1. <Task-Titel> (Bezug: US-1, Design-Abschnitt "...")
        Kurzbeschreibung, was genau zu tun ist.
  - [ ] 2. <Task-Titel> (Bezug: ...)
  ```
- Tasks werden während der Umsetzung live aktualisiert (`[ ]` → `[x]`), nicht erst am Ende
  gesammelt abgehakt.
- **Gate:** Erst nach Freigabe von `tasks.md` (oder nach explizitem "leg direkt los") beginnt
  die eigentliche Implementierung im Quellcode.

### Ablauf-Zusammenfassung

1. Nutzer beschreibt Feature-Idee.
2. Ordner `.features/<feature-name>/` anlegen.
3. `requirements.md` erstellen → Freigabe abwarten.
4. `design.md` erstellen → Freigabe abwarten.
5. `tasks.md` erstellen → Freigabe abwarten (oder Start bestätigen lassen).
6. Implementierung gemäß Tasks, Tasks-Status live pflegen.
7. Nach Abschluss: kurzer Abgleich, ob alle Akzeptaznkriterien aus `requirements.md`
   erfüllt sind.

### Bugfix-Modus (leichtgewichtiger)

Für Bugfixes an bereits bestehendem, spezifiziertem Verhalten reicht ein einzelnes
`.features/<bugfix-name>/bugfix.md` statt der drei vollen Dateien:

```markdown
# Bugfix: <Titel>

## Aktuelles Verhalten (Bug)
## Erwartetes Verhalten
## Was bleibt unverändert (Regressions-Schutz)
## Root Cause (nach Analyse)
## Fix-Ansatz
```

Auch hier gilt: erst Freigabe des `bugfix.md`, dann Implementierung.

### Umgang mit bestehenden Specs

- Vor dem Anlegen eines neuen Feature-Ordners: prüfen, ob `.features/` bereits einen
  passenden/überschneidenden Spec enthält, und ggf. dort weiterarbeiten statt zu duplizieren.
- Abgeschlossene Specs bleiben als Dokumentation liegen (nicht löschen) – sie dienen als
  Änderungshistorie und Kontext für spätere Features.

---

## Allgemeine Arbeitsweise

- Antworten und Spec-Dokumente auf Deutsch verfassen (Projektsprache), Code/Bezeichner in
  Code weiterhin auf Englisch, sofern nicht anders etabliert.
- Bei fachlichen Unsicherheiten zuerst `docs/` konsultieren, insbesondere
  `docs/07-offene-punkte.md` für bekannte offene Fragen.
- Keine Implementierung ohne durchlaufenes Spec-Gate (siehe oben) – auch nicht "nur mal
  schnell testen".
