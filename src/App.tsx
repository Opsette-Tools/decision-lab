import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import AppLayout from "@/layout/AppLayout";
import HomePage from "@/pages/HomePage";
import ScorecardsPage from "@/pages/ScorecardsPage";
import EditorRoute from "@/pages/EditorRoute";
import RunRoute from "@/pages/RunRoute";
import HistoryPage from "@/pages/HistoryPage";
import NotFound from "@/pages/NotFound";

// Derived from Vite's base so the same build works at "/" in dev and
// "/decision-lab/" in production, with no env var to forget.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            {/* One route per concept, not per type — EditorRoute and RunRoute
                dispatch on the scorecard's type, so a link keeps working
                whatever format it turns out to be. */}
            <Route path="/scorecards" element={<ScorecardsPage />} />
            <Route path="/scorecards/:id" element={<EditorRoute />} />
            <Route path="/run/:id" element={<RunRoute />} />
            <Route path="/history" element={<HistoryPage />} />
          </Route>
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
