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
  Globe,
  Users,
  UserPlus,
  KeyRound,
  UserX,
  UserCheck,
  UserMinus
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Dynamic User & Credential Management Terminal states
  const [users, setUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [showResetPass, setShowResetPass] = useState(false);
  
  // Form values
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  
  const [resetUserTarget, setResetUserTarget] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");

  const isCloudMode = localStorage.getItem("pann_db_mode") === "cloud";
  const userRole = localStorage.getItem("pann_user_role");
  
  // Decode active username directly from the verified JWT payload
  const getActiveUsername = (): string => {
    const token = localStorage.getItem("pann_jwt_token") || "";
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      return decoded.username || "admin";
    } catch (e) {
      return "admin";
    }
  };
  const activeUser = getActiveUsername();
  const showConsole = isCloudMode && userRole === "admin";

  useEffect(() => {
    if (showConsole) {
      loadUsers();
    }
  }, [showConsole]);

  const adminFetch = async (method: string, path: string, body?: any) => {
    const storedUrl = localStorage.getItem("pann_server_url") || "";
    const base = storedUrl.replace(/\/$/, "");
    const token = localStorage.getItem("pann_jwt_token") || "";
    
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const res = await fetch(`${base}${path}`, options);
    if (!res.ok) {
      const text = await res.json() as { error?: string };
      throw new Error(text.error || `API 错误: ${res.status}`);
    }
    return res;
  };

  const loadUsers = async () => {
    setUserLoading(true);
    setUserError("");
    try {
      const res = await adminFetch("GET", "/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setUserError(e.message || "获取用户列表失败");
    } finally {
      setUserLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      alert("请填写所有字段");
      return;
    }
    try {
      await adminFetch("POST", "/api/admin/users", {
        username: newUsername.trim(),
        password: newPassword,
        role: newRole
      });
      alert("创建账号成功！");
      setNewUsername("");
      setNewPassword("");
      setShowAddUser(false);
      loadUsers();
    } catch (e: any) {
      alert("创建失败: " + e.message);
    }
  };

  const handleToggleStatus = async (username: string, isActive: number) => {
    try {
      await adminFetch("PUT", "/api/admin/users", {
        username,
        is_active: isActive === 1 ? 0 : 1
      });
      loadUsers();
    } catch (e: any) {
      alert("操作失败: " + e.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetNewPass) {
      alert("请输入新密码");
      return;
    }
    try {
      await adminFetch("PUT", "/api/admin/users", {
        username: resetUserTarget,
        password: resetNewPass
      });
      alert("重置密码成功！");
      setResetNewPass("");
      setShowResetPass(false);
      loadUsers();
    } catch (e: any) {
      alert("重置失败: " + e.message);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`警告！您确定要彻底删除用户账号「${username}」吗？此操作不可逆！`)) {
      return;
    }
    try {
      await adminFetch("DELETE", `/api/admin/users?username=${encodeURIComponent(username)}`);
      alert("删除账号成功！");
      loadUsers();
    } catch (e: any) {
      alert("删除失败: " + e.message);
    }
  };

  // Export templates states bound to localStorage
  const [exportMode, setExportMode] = useState(() => localStorage.getItem("export_mode") || "embedded");
  const [exportTitle, setExportTitle] = useState(() => localStorage.getItem("export_title") || "新闻嗅觉图片社任务汇总");
  const [exportFilename, setExportFilename] = useState(() => localStorage.getItem("export_filename") || "稿费统计汇总表");

  useEffect(() => {
    async function checkDb() {
      try {
        const { isTauri: checkTauri, initDb } = await import('@/lib/db');
        if (checkTauri) {
          await initDb();
          setDbStatus("已连接 SQLite 数据库 (Active)");
        } else {
          // Web environment: check D1 API connectivity (requires Bearer JWT)
          const token = localStorage.getItem('pann_jwt_token') || '';
          const response = await fetch('/api/tasks', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
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
      if (checkTauri) {
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

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Left column: Quick Nav/Details */}
        <div className="md:col-span-1 space-y-4 md:sticky md:top-6 h-fit">
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

          {/* Password and Credential Management Terminal Card (ADMIN ONLY IN CLOUD MODE) */}
          {showConsole && (
            <Card className="border-border/80 transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    {language === "zh" ? "用户与密码管理终端" : "Credential Management Console"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 cursor-pointer font-semibold"
                    onClick={() => {
                      setShowAddUser(!showAddUser);
                      setShowResetPass(false);
                    }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {language === "zh" ? "新增用户账号" : "Add New Account"}
                  </Button>
                </CardTitle>
                <CardDescription>
                  {language === "zh"
                    ? "管理云端多用户凭证与角色权限，支持快速禁用或重置密码。"
                    : "Manage serverless database dynamic credentials and active session roles."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* 1. Add User Form Modal Panel */}
                {showAddUser && (
                  <form onSubmit={handleAddUser} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <UserPlus className="w-3.5 h-3.5" />
                      {language === "zh" ? "创建新用户" : "Create New User"}
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-bold">{language === "zh" ? "用户名" : "Username"}</label>
                        <input
                          type="text"
                          required
                          placeholder="用户名"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-bold">{language === "zh" ? "访问密码" : "Password"}</label>
                        <input
                          type="password"
                          required
                          placeholder="输入密码"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-bold">{language === "zh" ? "角色权限" : "Role"}</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as any)}
                          className="flex h-8 w-full rounded-md border border-input bg-card px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold cursor-pointer"
                        >
                          <option value="member">{language === "zh" ? "普通摄影师 (Member)" : "Member"}</option>
                          <option value="admin">{language === "zh" ? "超级管理员 (Admin)" : "Admin"}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button type="submit" size="sm" className="h-7 px-3 text-xs font-semibold cursor-pointer">
                        {language === "zh" ? "立即创建" : "Create"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-3 text-xs font-semibold cursor-pointer" onClick={() => setShowAddUser(false)}>
                        {language === "zh" ? "取消" : "Cancel"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* 2. Reset Password Modal Panel */}
                {showResetPass && (
                  <form onSubmit={handleResetPassword} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <KeyRound className="w-3.5 h-3.5" />
                      {language === "zh" ? `重置用户 [${resetUserTarget}] 密码` : `Reset Password for [${resetUserTarget}]`}
                    </h4>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-bold">{language === "zh" ? "请输入新密码" : "Enter New Password"}</label>
                        <input
                          type="password"
                          required
                          placeholder="输入新密码"
                          value={resetNewPass}
                          onChange={(e) => setResetNewPass(e.target.value)}
                          className="flex h-8 w-full max-w-xs rounded-md border border-input bg-card px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button type="submit" size="sm" className="h-7 px-3 text-xs font-semibold cursor-pointer bg-amber-500 hover:bg-amber-600 text-white border-0">
                        {language === "zh" ? "确认修改" : "Reset"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-3 text-xs font-semibold cursor-pointer" onClick={() => setShowResetPass(false)}>
                        {language === "zh" ? "取消" : "Cancel"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* 3. User Credentials Table list */}
                {userLoading ? (
                  <div className="flex flex-col items-center py-6 space-y-2 text-muted-foreground text-xs font-semibold">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                    <span>{language === "zh" ? "加载账户中..." : "Loading accounts..."}</span>
                  </div>
                ) : userError ? (
                  <div className="p-3 text-center rounded bg-red-950/20 border border-red-900/40 text-red-400 text-xs font-semibold">
                    {userError}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border bg-card/25">
                    <table className="w-full border-collapse text-left text-xs text-foreground">
                      <thead className="bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                        <tr>
                          <th className="p-3 pl-4">{language === "zh" ? "用户名" : "Username"}</th>
                          <th className="p-3">{language === "zh" ? "角色权限" : "Role"}</th>
                          <th className="p-3">{language === "zh" ? "账号状态" : "Status"}</th>
                          <th className="p-3 pr-4 text-right">{language === "zh" ? "控制管理" : "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-semibold">
                        {users.map((u) => {
                          const isSelf = u.username === activeUser;
                          return (
                            <tr key={u.username} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 pl-4 font-bold flex items-center gap-1.5">
                                <span>{u.username}</span>
                                {isSelf && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground font-semibold">
                                    {language === "zh" ? "我" : "Self"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                  u.role === "admin" 
                                    ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-400" 
                                    : "bg-blue-950/50 text-blue-400 border border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-400"
                                }`}>
                                  {u.role === "admin" ? "管理员 (Admin)" : "摄影师 (Member)"}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`h-1.5 w-1.5 rounded-full ${u.is_active === 1 ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                                  <span>{u.is_active === 1 ? (language === "zh" ? "已启用" : "Active") : (language === "zh" ? "已禁用" : "Disabled")}</span>
                                </div>
                              </td>
                              <td className="p-3 pr-4 text-right space-x-1.5">
                                {/* Action 1: Reset Password */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-950/10 cursor-pointer font-semibold"
                                  onClick={() => {
                                    setResetUserTarget(u.username);
                                    setResetNewPass("");
                                    setShowResetPass(true);
                                    setShowAddUser(false);
                                  }}
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </Button>

                                {/* Action 2: Disable / Enable Account */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isSelf}
                                  className={`h-7 text-xs cursor-pointer font-semibold ${
                                    u.is_active === 1 
                                      ? "text-red-500 hover:text-red-400 hover:bg-red-950/10" 
                                      : "text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/10"
                                  }`}
                                  onClick={() => handleToggleStatus(u.username, u.is_active)}
                                >
                                  {u.is_active === 1 ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </Button>

                                {/* Action 3: Delete Account */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isSelf}
                                  className="h-7 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-950/10 cursor-pointer font-semibold"
                                  onClick={() => handleDeleteUser(u.username)}
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
