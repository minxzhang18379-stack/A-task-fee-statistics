import { useState, useEffect, useCallback } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Settings, Moon, Sun, BarChart3, LogOut } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useLanguage } from "./language-provider";
import { Button } from "./ui/button";
import logo from "../assets/logo.png";

const navItems = [
  { key: "nav.dashboard", path: "/", icon: LayoutDashboard },
  { key: "nav.tasks", path: "/tasks", icon: CheckSquare },
  { key: "nav.stats", path: "/stats", icon: BarChart3 },
  { key: "nav.settings", path: "/settings", icon: Settings },
];

export function Layout() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const location = useLocation();

  // Load saved sidebar width from local storage, defaulting to 224px (w-56)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebar_width");
    return saved ? parseInt(saved, 10) : 224;
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    setIsResizing(true);
    mouseDownEvent.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      // Clamp sidebar width between 160px and 380px for standard ergonomics
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth >= 160 && newWidth <= 380) {
        setSidebarWidth(newWidth);
        localStorage.setItem("sidebar_width", newWidth.toString());
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Dynamic ambient glow background */}
      <div className="ambient-glow-bg">
        <div className="glow-circle glow-circle-1" />
        <div className="glow-circle glow-circle-2" />
        <div className="glow-circle glow-circle-3" />
      </div>

      {/* Sidebar (frosted glass layout) */}
      <aside 
        className="shrink-0 border-r border-border bg-card/80 backdrop-blur-md flex flex-col relative select-none z-20"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <img src={logo} alt="PANN Logo" className="w-7 h-7 rounded-md object-contain mr-2.5 dark:invert transition-all" />
          <span className="font-bold text-sm tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text truncate">
            {sidebarWidth >= 180 ? "PANN Task Manager" : "PANN"}
          </span>
        </div>

        {/* Drag Resizer Handle */}
        <div
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 active:bg-primary transition-colors z-50 ${
            isResizing ? "bg-primary" : ""
          }`}
          onMouseDown={startResizing}
        />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header (frosted glass layout) */}
        <header className="h-14 shrink-0 border-b border-border bg-background/40 backdrop-blur-md flex items-center justify-between px-6 z-20">
          <span className="text-sm font-semibold text-muted-foreground tracking-wide">
            {(() => {
              const currentItem = navItems.find((i) => i.path === location.pathname);
              return currentItem ? t(currentItem.key) : "";
            })()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={() => {
                if (window.confirm("确定要退出登录吗？")) {
                  if ((window as any).pannLogout) {
                    (window as any).pannLogout();
                  }
                }
              }}
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content Panel (Animated Route Outlet) */}
        <main className="flex-1 overflow-auto p-6 relative z-10">
          <div key={location.pathname} className="mx-auto max-w-6xl animate-page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
