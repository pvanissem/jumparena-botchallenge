import type { BotArtifact } from "@arena/shared";

export interface BotRegistryListProps {
  bots: BotArtifact[];
  onRemove?: (id: string) => void;
}

export function BotRegistryList({ bots, onRemove }: BotRegistryListProps) {
  if (bots.length === 0) {
    return <p>Noch keine Bots eingereicht.</p>;
  }

  return (
    <ul className="bot-registry-list">
      {bots.map((bot) => (
        <li key={bot.id} className="bot-registry-list__item">
          <span
            className="bot-registry-list__color"
            style={{ backgroundColor: bot.color }}
            aria-hidden="true"
          />
          <span className="bot-registry-list__name">{bot.name}</span>
          <span className="bot-registry-list__author">{bot.author}</span>
          {onRemove && (
            <button
              type="button"
              className="pixel-btn bot-registry-list__remove"
              onClick={() => onRemove(bot.id)}
            >
              Entfernen
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
