import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { DevPage } from "./pages/DevPage";
import { PresentPage } from "./pages/PresentPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dev" replace />} />
      <Route path="/dev" element={<DevPage />} />
      <Route path="/present" element={<PresentPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
