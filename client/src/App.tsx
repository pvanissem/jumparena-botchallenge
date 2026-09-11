import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { DevPage } from "./pages/DevPage";
import { PlayPage } from "./pages/PlayPage";
import { PlayTestPage } from "./pages/PlayTestPage";
import { PresentPage } from "./pages/PresentPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dev" replace />} />
      <Route path="/dev" element={<DevPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/play/test" element={<PlayTestPage />} />
      <Route path="/present" element={<PresentPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
