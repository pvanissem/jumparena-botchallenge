import type { BotArtifact } from "@arena/shared";

export function RosterAttractView({ bots }: { bots: BotArtifact[] }) {
  return (
    <section className="roster-attract">
      <header>
        <span className="roster-attract__eyebrow">Bot Check-in</span>
        <h2>Nächste Herausforderer</h2>
        <p>
          {bots.length === 0 ? "Die Arena wartet auf Bots." : `${bots.length} Bots sind bereit.`}
        </p>
      </header>
      <div className="roster-attract__grid">
        {bots.map((bot, index) => (
          <article key={bot.id} style={{ borderColor: bot.color }}>
            <span>#{String(index + 1).padStart(2, "0")}</span>
            <h3>{bot.name}</h3>
            <p>von {bot.author}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
