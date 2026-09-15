import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { CodePage } from "./pages/CodePage";
import { DevPage } from "./pages/DevPage";
import { PresentPage } from "./pages/PresentPage";

export function App() {
  return (
    <Routes>
      {/* Messestand ist der Regelfall, daher zeigt "/" auf /code (siehe
          `.features/code-station-page/`). /dev bleibt die Entwickler-Ansicht. */}
      <Route path="/" element={<Navigate to="/code" replace />} />
      <Route path="/code" element={<CodePage />} />
      <Route path="/dev" element={<DevPage />} />
      <Route path="/present" element={<PresentPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
