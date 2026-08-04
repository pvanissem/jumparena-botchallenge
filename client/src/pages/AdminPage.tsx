import { useEffect, useState } from "react";
import { AudioControls } from "../components/AudioControls";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { audioSettings } from "../game/audio/audioSettings";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function AdminPage() {
  const { status, send } = useWebSocketConnection();
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  // Überträgt lokale Audio-Änderungen (Mute/Lautstärke) an alle anderen
  // verbundenen Clients (insbesondere `/present`), siehe
  // `.features/game-audio/requirements.md` US-5. `AudioControls` selbst
  // kennt WebSocket/Broadcast bewusst nicht (Single Responsibility) - das
  // Senden ist Verantwortung dieser Seite.
  useEffect(
    () =>
      audioSettings.subscribe(() => {
        send({ type: "audio-settings", ...audioSettings.getState() });
      }),
    [send]
  );

  const handlePing = () => {
    const sentAt = new Date().toISOString();
    send({ type: "ping-broadcast", sentAt, text: "Ping von Admin" });
    setLastSentAt(sentAt);
  };

  return (
    <main>
      <h1>Admin</h1>
      <ConnectionStatusBadge status={status} />
      <AudioControls />
      <button type="button" onClick={handlePing}>
        Ping
      </button>
      {lastSentAt && <p>Gesendet um {lastSentAt}</p>}
    </main>
  );
}
