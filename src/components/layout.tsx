import { useState, useEffect, useCallback } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Settings, Moon, Sun, BarChart3, LogOut, Menu, X } from "lucide-react";
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole = localStorage.getItem('pann_user_role') || 'admin';
  const filteredNavItems = navItems.filter(item => {
    if (userRole === 'member' && item.path === '/settings') {
      return false;
    }
    return true;
  });

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

      {/* Backdrop for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Neumorphic rightward-shadow extruded panel) */}
      <aside 
        className={`shrink-0 border-r-0 bg-card shadow-[4px_0_12px_#d1d9e6] dark:shadow-[4px_0_12px_#0f151e] flex flex-col select-none z-50 transition-all duration-300 ease-in-out
          fixed inset-y-0 left-0 md:relative md:translate-x-0
          ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ width: isMobileMenuOpen ? "240px" : `${sidebarWidth}px` }}
      >
        {/* Logo & Close Button */}
        <div className="h-14 flex items-center justify-between px-5 border-b-0">
          <div className="flex items-center min-w-0">
            <img src={logo} alt="PANN Logo" className="w-7 h-7 rounded-md object-contain mr-2.5 dark:invert transition-all" />
            <span className="font-bold text-sm tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text truncate">
              {isMobileMenuOpen || sidebarWidth >= 180 ? "PANN Task Manager" : "PANN"}
            </span>
          </div>
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Drag Resizer Handle (hidden on mobile) */}
        <div
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 active:bg-primary transition-colors z-50 hidden md:block ${
            isResizing ? "bg-primary" : ""
          }`}
          onMouseDown={startResizing}
        />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "nm-pressed text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
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
        {/* Header (flat borderless skeuomorphic header) */}
        <header className="h-14 shrink-0 bg-background flex items-center justify-between px-4 md:px-6 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger menu button for mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-md md:hidden text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="text-sm font-semibold text-muted-foreground tracking-wide">
              {(() => {
                const currentItem = navItems.find((i) => i.path === location.pathname);
                return currentItem ? t(currentItem.key) : "";
              })()}
            </span>
          </div>
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
        <main className="flex-1 overflow-auto p-4 md:p-6 relative z-10">
          <div key={location.pathname} className="mx-auto max-w-6xl animate-page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
