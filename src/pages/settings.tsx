import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
// db functions are dynamically imported inside handlers (isTauri/initDb)
import logo from "../assets/logo.png";
import { 
  Database, 
  FileSpreadsheet, 
  Trash2, 
  Laptop, 
  Sun, 
  Moon, 
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Globe
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Export templates states bound to localStorage
  const [exportMode, setExportMode] = useState(() => localStorage.getItem("export_mode") || "embedded");
  const [exportTitle, setExportTitle] = useState(() => localStorage.getItem("export_title") || "新闻嗅觉图片社任务汇总");
  const [exportFilename, setExportFilename] = useState(() => localStorage.getItem("export_filename") || "稿费统计汇总表");

  useEffect(() => {
    async function checkDb() {
      try {
        const { isTauri: checkTauri, initDb } = await import('@/lib/db');
        if (checkTauri()) {
          await initDb();
          setDbStatus("已连接 SQLite 数据库 (Active)");
        } else {
          // Web environment: check D1 API connectivity
          const response = await fetch('/api/tasks');
          if (response.ok) {
            setDbStatus("已连接 Cloudflare D1 数据库 (Active)");
          } else {
            setDbStatus("D1 API 响应异常，请检查数据库绑定");
          }
        }
      } catch (e) {
        setDbStatus("连接失败: " + (e instanceof Error ? e.message : String(e)));
      }
    }
    checkDb();
  }, []);

  // Save changes to localStorage on edit
  useEffect(() => {
    localStorage.setItem("export_mode", exportMode);
  }, [exportMode]);

  useEffect(() => {
    localStorage.setItem("export_title", exportTitle);
  }, [exportTitle]);

  useEffect(() => {
    localStorage.setItem("export_filename", exportFilename);
  }, [exportFilename]);

  // Clean database - works for both Tauri (SQLite) and Web (D1 API)
  const handleClearDatabase = async () => {
    try {
      const { isTauri: checkTauri, initDb } = await import('@/lib/db');
      if (checkTauri()) {
        // Tauri/SQLite environment
        const db = await initDb();
        if (db) {
          await db.execute("DELETE FROM TaskRecord");
        }
      } else {
        // Web / Cloudflare D1 environment: call a dedicated clear API
        const response = await fetch('/api/tasks/all', { method: 'DELETE' });
        if (!response.ok) throw new Error("API 返回错误: " + response.status);
      }
      setDbStatus(t("settings.cardDb.dbCleared"));
      setShowClearConfirm(false);
      alert(t("settings.cardDb.alertSuccess"));
    } catch (e) {
      alert(t("settings.cardDb.alertFail") + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text">{t("settings.title")}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column: Quick Nav/Details */}
        <div className="md:col-span-1 space-y-4">
          <Card className="bg-card/50 backdrop-blur-xs border-border/80">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 shadow-xs border bg-background flex items-center justify-center p-2 dark:bg-zinc-900">
                <img src={logo} alt="PANN Logo" className="w-full h-full object-contain dark:invert transition-all" />
              </div>
              <h3 className="font-bold text-lg">PANN Task Manager</h3>
              <p className="text-xs text-muted-foreground mt-1.5 font-semibold">{t("settings.cardAbout.author")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.cardAbout.versionCurrent")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.cardAbout.updateDate")}</p>
              <div className="w-full border-t border-border/80 my-4" />
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-4 h-4" />
                {t("settings.cardAbout.statusOk")}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("settings.cardHelp.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <span>{t("settings.cardHelp.text")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Form details */}
        <div className="md:col-span-2 space-y-6">
          {/* Language Selection Card */}
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                {t("settings.cardLanguage.title")}
              </CardTitle>
              <CardDescription>{t("settings.cardLanguage.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button
                variant={language === "zh" ? "default" : "outline"}
                className="gap-2 justify-center py-6 h-auto cursor-pointer font-semibold"
                onClick={() => setLanguage("zh")}
              >
                {t("settings.cardLanguage.btnZh")}
              </Button>
              <Button
                variant={language === "en" ? "default" : "outline"}
                className="gap-2 justify-center py-6 h-auto cursor-pointer font-semibold"
                onClick={() => setLanguage("en")}
              >
                {t("settings.cardLanguage.btnEn")}
              </Button>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Laptop className="w-4 h-4 text-primary" />
                {t("settings.cardTheme.title")}
              </CardTitle>
              <CardDescription>{t("settings.cardTheme.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                className="gap-2 justify-center py-6 h-auto cursor-pointer font-semibold"
                onClick={() => setTheme("light")}
              >
                <Sun className="w-4 h-4" />
                {t("settings.cardTheme.themeLight")}
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                className="gap-2 justify-center py-6 h-auto cursor-pointer font-semibold"
                onClick={() => setTheme("dark")}
              >
                <Moon className="w-4 h-4" />
                {t("settings.cardTheme.themeDark")}
              </Button>
            </CardContent>
          </Card>

          {/* Customizable Template Options Card */}
          <Card className="border-border/80 animate-in fade-in duration-150">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                {t("settings.cardTemplate.title")}
              </CardTitle>
              <CardDescription>{t("settings.cardTemplate.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-semibold text-foreground">
              {/* Option 1: Template Mode */}
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-bold">{t("settings.cardTemplate.labelStyle")}</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer"
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value)}
                >
                  <option value="embedded">{t("settings.cardTemplate.styleEmbedded")}</option>
                  <option value="external">{t("settings.cardTemplate.styleClassic")}</option>
                </select>
              </div>

              {/* Option 2: Custom Main Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-bold">{t("settings.cardTemplate.labelTitle")}</label>
                <input
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold disabled:opacity-50"
                  placeholder={t("settings.cardTemplate.placeholderTitle")}
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  disabled={exportMode === "external"}
                />
                {exportMode === "external" && (
                  <p className="text-[10px] text-muted-foreground/80 font-normal">
                    {language === "zh" 
                      ? "* 当前为“外部模板”模式，标题将直接读取并继承您选定的外部 Excel 模板文件中的首行标题。" 
                      : "* Under Custom template mode, the main header will be directly inherited from your selected external Excel spreadsheet."}
                  </p>
                )}
              </div>

              {/* Option 3: Default Filename */}
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-bold">{t("settings.cardTemplate.labelFilename")}</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-card pl-3 pr-12 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                    placeholder={t("settings.cardTemplate.placeholderFilename")}
                    value={exportFilename}
                    onChange={(e) => setExportFilename(e.target.value)}
                  />
                  <span className="absolute right-3 text-muted-foreground text-xs font-bold">.xlsx</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Maintenance and Clear Data */}
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                {t("settings.cardDb.title")}
              </CardTitle>
              <CardDescription>{t("settings.cardDb.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/80 text-xs font-semibold">
                <span className="text-muted-foreground font-bold">{t("settings.cardDb.status")}</span>
                <span className="text-primary">{dbStatus}</span>
              </div>

              <div className="border-t pt-4">
                {!showClearConfirm ? (
                  <Button
                    variant="destructive"
                    className="gap-2 cursor-pointer font-semibold"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("settings.cardDb.btnClear")}
                  </Button>
                ) : (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
                    <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      {t("settings.cardDb.confirmTitle")}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t("settings.cardDb.confirmDesc")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="font-semibold cursor-pointer text-xs"
                        onClick={handleClearDatabase}
                      >
                        {t("settings.cardDb.btnConfirm")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-semibold cursor-pointer text-xs"
                        onClick={() => setShowClearConfirm(false)}
                      >
                        {t("settings.cardDb.btnCancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
