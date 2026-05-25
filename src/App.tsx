import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import TasksPage from "@/pages/tasks";
import SettingsPage from "@/pages/settings";
import StatsPage from "@/pages/stats";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="taskmaster-theme">
      <LanguageProvider defaultLanguage="zh" storageKey="taskmaster-lang">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
