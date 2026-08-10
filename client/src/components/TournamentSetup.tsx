import type { BotArtifact } from "@arena/shared";
import {
  ALLOWED_GROUP_SIZES,
  DEFAULT_GROUP_SIZE,
  DEFAULT_LIVES_PER_RUN,
  estimateRoundCount,
  isValidLivesPerRun,
  MAX_LIVES_PER_RUN,
  MIN_LIVES_PER_RUN,
} from "@arena/shared";
import { useMemo, useState } from "react";
import { DEFAULT_LEVEL_ID } from "../game/level/levelRegistry";
import { StageLevelEditor } from "./StageLevelEditor";

interface TournamentSetupProps {
  bots: BotArtifact[];
  onStart: (
    stageLevelIds: string[],
    botIds: string[],
    livesPerRun: number,
    groupSize: number
  ) => void;
}

export function TournamentSetup({ bots, onStart }: TournamentSetupProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(bots.map((b) => b.id)));
  const [stageLevelIds, setStageLevelIds] = useState<string[]>([DEFAULT_LEVEL_ID]);
  // Als String gehalten, damit ein leeres Feld während der Eingabe möglich ist
  // (eine `number`-State würde auf NaN/0 springen).
  const [livesInput, setLivesInput] = useState<string>(String(DEFAULT_LIVES_PER_RUN));
  const [groupSize, setGroupSize] = useState<number>(DEFAULT_GROUP_SIZE);

  const expectedRoundCount = useMemo(
    () => estimateRoundCount(selectedIds.size, groupSize),
    [selectedIds.size, groupSize]
  );

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
    onStart(stageLevelIds, [...selectedIds], livesPerRun, groupSize);
  };

  return (
    <section>
      <h2>Turnier starten</h2>

      <StageLevelEditor
        stageLevelIds={stageLevelIds}
        onChange={setStageLevelIds}
        expectedRoundCount={expectedRoundCount}
      />

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
        <legend>Bots pro Match</legend>
        {ALLOWED_GROUP_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={`pixel-btn ${groupSize === size ? "pixel-btn--active" : ""}`}
            onClick={() => setGroupSize(size)}
          >
            {size}
          </button>
        ))}
      </fieldset>

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

      <p>Erwartete Rundenzahl: {expectedRoundCount}</p>

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
