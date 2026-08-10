import type { BotArtifact } from "@arena/shared";
import {
  DEFAULT_LIVES_PER_RUN,
  isValidLivesPerRun,
  MAX_LIVES_PER_RUN,
  MIN_LIVES_PER_RUN,
} from "@arena/shared";
import { useState } from "react";
import { LEVEL_REGISTRY } from "../game/level/levelRegistry";

interface TournamentSetupProps {
  bots: BotArtifact[];
  onStart: (levelId: string, botIds: string[], livesPerRun: number) => void;
}

export function TournamentSetup({ bots, onStart }: TournamentSetupProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(bots.map((b) => b.id)));
  const [levelId, setLevelId] = useState<string>(LEVEL_REGISTRY[0].id);
  // Als String gehalten, damit ein leeres Feld während der Eingabe möglich ist
  // (eine `number`-State würde auf NaN/0 springen).
  const [livesInput, setLivesInput] = useState<string>(String(DEFAULT_LIVES_PER_RUN));

  const toggleBot = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const livesPerRun = Number(livesInput);
  const livesValid = livesInput.trim() !== "" && isValidLivesPerRun(livesPerRun);
  const enoughBots = selectedIds.size >= 2;
  const canStart = enoughBots && livesValid;

  const handleStart = () => {
    if (!canStart) return;
    onStart(levelId, [...selectedIds], livesPerRun);
  };

  return (
    <section>
      <h2>Turnier starten</h2>

      <label>
        Level
        <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
          {LEVEL_REGISTRY.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Leben pro Lauf
        <input
          type="number"
          min={MIN_LIVES_PER_RUN}
          max={MAX_LIVES_PER_RUN}
          step={1}
          value={livesInput}
          onChange={(event) => setLivesInput(event.target.value)}
        />
      </label>

      <fieldset>
        <legend>Teilnehmer ({selectedIds.size} ausgewählt)</legend>
        {bots.length === 0 && <p>Noch keine Bots eingereicht.</p>}
        {bots.map((bot) => (
          <label key={bot.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={selectedIds.has(bot.id)}
              onChange={() => toggleBot(bot.id)}
            />
            {bot.name} ({bot.author})
          </label>
        ))}
      </fieldset>

      {!enoughBots && <p>Wähle mindestens zwei Bots aus.</p>}
      {!livesValid && (
        <p>
          Leben pro Lauf muss eine ganze Zahl zwischen {MIN_LIVES_PER_RUN} und {MAX_LIVES_PER_RUN}{" "}
          sein.
        </p>
      )}

      <button type="button" onClick={handleStart} disabled={!canStart}>
        Turnier aufstellen
      </button>
    </section>
  );
}
