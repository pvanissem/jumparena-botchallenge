import { LEVEL_REGISTRY } from "../game/level/levelRegistry";
import { addStage, moveStage, removeStage, setStage } from "../tournament/stageLevelList";

interface StageLevelEditorProps {
  stageLevelIds: string[];
  onChange: (next: string[]) => void;
  expectedRoundCount: number;
}

export function StageLevelEditor({
  stageLevelIds,
  onChange,
  expectedRoundCount,
}: StageLevelEditorProps): JSX.Element {
  const canRemove = stageLevelIds.length > 1;

  return (
    <div className="stage-level-editor">
      <h3>Level je Runde</h3>
      <ul className="stage-list">
        {stageLevelIds.map((levelId, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Index ist die stabile Position in der Stage-Liste.
          <li key={index} className="stage-row">
            <span className="stage-label">Runde {index + 1}</span>
            <select
              value={levelId}
              onChange={(event) => onChange(setStage(stageLevelIds, index, event.target.value))}
              aria-label={`Level für Runde ${index + 1}`}
            >
              {LEVEL_REGISTRY.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(moveStage(stageLevelIds, index, -1))}
              disabled={index === 0}
              aria-label="hoch"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onChange(moveStage(stageLevelIds, index, 1))}
              disabled={index === stageLevelIds.length - 1}
              aria-label="runter"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(removeStage(stageLevelIds, index))}
              disabled={!canRemove}
              aria-label="entfernen"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => onChange(addStage(stageLevelIds))}>
        Stage hinzufügen
      </button>

      {expectedRoundCount > 0 && stageLevelIds.length < expectedRoundCount && (
        <p className="stage-hint">
          Es werden {expectedRoundCount} Runden erwartet. Ab Runde {stageLevelIds.length + 1}{" "}
          spielen die weiteren Runden auf dem Level der letzten Stage.
        </p>
      )}

      {expectedRoundCount > 0 && stageLevelIds.length > expectedRoundCount && (
        <p className="stage-hint">
          Es werden {expectedRoundCount} Runden erwartet.{" "}
          {stageLevelIds.length - expectedRoundCount} überzähligen Stages werden voraussichtlich
          nicht gespielt.
        </p>
      )}
    </div>
  );
}
