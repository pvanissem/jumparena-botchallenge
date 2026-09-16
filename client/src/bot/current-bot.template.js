// Dein Bot startet ohne Strategie. Gemeinsam mit dem Agenten füllst du decide aus.
// state beschreibt die aktuelle Spielsituation.
// tools.run(auftrag) führt einen Bewegungsauftrag aus; tools.status() zeigt seinen Stand.
// API und Anweisungen: docs/02-bot-api.md und client/src/bot/AGENTS.md.
export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    return [];
  },
};
