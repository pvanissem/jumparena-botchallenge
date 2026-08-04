import { useEffect } from "react";
import { BroadcastFeed } from "../components/BroadcastFeed";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { audioSettings } from "../game/audio/audioSettings";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function PresentPage() {
  const { status, lastMessage } = useWebSocketConnection();

  // Übernimmt von der Admin-Ansicht gesendete Audio-Einstellungen in den
  // lokalen Store (siehe `.features/game-audio/requirements.md` US-5).
  // Vorbereitend: `PresentPage` hat aktuell noch keinen Phaser-Canvas, daher
  // ist hier noch kein Ton hörbar - der Store wird aber bereits korrekt
  // aktualisiert, sobald ein Canvas hinzukommt.
  useEffect(() => {
    if (lastMessage?.type !== "audio-settings") return;
    audioSettings.setMuted(lastMessage.muted);
    audioSettings.setVolume(lastMessage.volume);
  }, [lastMessage]);

  return (
    <main>
      <h1>Präsentation</h1>
      <ConnectionStatusBadge status={status} />
      <BroadcastFeed lastMessage={lastMessage} />
    </main>
  );
}
