import React, { useState, useEffect } from "react";
import { isTauri } from "../lib/db";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface LoginGateProps {
  children: React.ReactNode;
}

export function LoginGate({ children }: LoginGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>("");
  
  // Login form states
  const [mode, setMode] = useState<"cloud" | "local">("cloud");
  const [serverUrl, setServerUrl] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  useEffect(() => {
    // Check if already authenticated or in local standalone mode
    const storedAuth = localStorage.getItem("pann_authenticated");
    const storedMode = localStorage.getItem("pann_db_mode");
    const storedServer = localStorage.getItem("pann_server_url");
    const storedPass = localStorage.getItem("pann_password");

    if (storedMode === "local" && isTauri) {
      setMode("local");
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    if (storedAuth === "true" && storedPass) {
      // Auto-validate stored password
      const url = isTauri ? (storedServer || "") : window.location.origin;
      validateCredentials(url, storedPass, true)
        .then((isValid) => {
          if (isValid) {
            setIsAuthenticated(true);
          } else {
            // Clear invalid stored credentials
            localStorage.removeItem("pann_authenticated");
            setAuthError("会话已过期，请重新登录");
          }
          setLoading(false);
        })
        .catch(() => {
          // If network is offline but we have stored auth, let desktop users access local standalone or show error
          if (isTauri) {
            setAuthError("无法连接到云端数据库，您可在下方切换到本地离线模式");
          } else {
            setAuthError("无法连接到服务器，请检查网络");
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const validateCredentials = async (url: string, pass: string, isAutoLogin = false): Promise<boolean> => {
    try {
      const cleanUrl = url.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/api/auth`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${pass}`,
        },
      });

      if (res.status === 200) {
        const data = await res.json() as { role: 'admin' | 'member' };
        localStorage.setItem("pann_user_role", data.role);
        return true;
      }
      return false;
    } catch (err) {
      if (isAutoLogin) {
        throw err; // propagate up for auto-login error handling
      }
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    if (mode === "local") {
      if (!isTauri) {
        setAuthError("网页版仅支持云端同步模式");
        setLoading(false);
        return;
      }
      localStorage.setItem("pann_db_mode", "local");
      localStorage.setItem("pann_user_role", "admin"); // Default to admin for offline SQLite
      localStorage.setItem("pann_authenticated", "true");
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // Cloud Mode validation
    let targetServer = serverUrl.trim();
    if (!isTauri) {
      targetServer = window.location.origin;
    } else if (!targetServer) {
      setAuthError("请输入服务器地址");
      setLoading(false);
      return;
    }

    if (!password) {
      setAuthError("请输入访问密码");
      setLoading(false);
      return;
    }

    try {
      const cleanServer = targetServer.replace(/\/$/, "");
      const isValid = await validateCredentials(cleanServer, password);

      if (isValid) {
        localStorage.setItem("pann_db_mode", "cloud");
        localStorage.setItem("pann_server_url", cleanServer);
        localStorage.setItem("pann_password", password);
        localStorage.setItem("pann_authenticated", "true");
        setIsAuthenticated(true);
      } else {
        setAuthError("密码错误或服务器拒绝访问");
      }
    } catch (err) {
      console.error(err);
      setAuthError("连接服务器失败，请检查网络或服务器地址是否正确");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pann_authenticated");
    localStorage.removeItem("pann_db_mode");
    localStorage.removeItem("pann_server_url");
    localStorage.removeItem("pann_password");
    localStorage.removeItem("pann_user_role");
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-zinc-400">正在连接数据库...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Expose a custom logout handler globally or in context if needed
    (window as any).pannLogout = handleLogout;
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-950/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-green-900/10 blur-[120px] pointer-events-none"></div>

      <Card className="w-full max-w-[450px] border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden">
        {/* Sleek top colored border */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-green-600"></div>

        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
            PANN Task Manager
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
            任务及稿费统计管理系统
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Mode selection (Tauri desktop only) */}
            {isTauri && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-300">数据库模式</Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setMode("cloud")}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      mode === "cloud"
                        ? "bg-zinc-800 text-emerald-400 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    云端同步模式
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("local")}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      mode === "local"
                        ? "bg-zinc-800 text-emerald-400 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    本地单机模式
                  </button>
                </div>
              </div>
            )}

            {mode === "cloud" ? (
              <div className="space-y-4 animate-fadeIn">
                {/* Server URL Input (Tauri desktop only) */}
                {isTauri && (
                  <div className="space-y-1.5">
                    <Label htmlFor="server" className="text-xs text-zinc-300">服务器地址</Label>
                    <Input
                      id="server"
                      type="url"
                      placeholder="https://pann-tasks.pages.dev"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-sm h-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0"
                    />
                  </div>
                )}

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-xs text-zinc-300">访问密码</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="输入管理密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-sm h-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2 text-center py-6 animate-fadeIn">
                <p className="text-sm font-semibold text-zinc-200">离线使用模式</p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  本地单机模式下将直接连接本地的 SQLite 数据库 `tasks.db`，数据独立保存在本机上，不需要密码和网络连接。
                </p>
              </div>
            )}

            {/* Error Message */}
            {authError && (
              <div className="rounded-lg bg-red-950/40 border border-red-900/60 p-3 text-center">
                <p className="text-xs font-medium text-red-400">{authError}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-medium shadow-lg hover:shadow-emerald-500/10 h-10 mt-2 transition-all duration-300 rounded-lg"
            >
              {mode === "cloud" ? "连接云端同步" : "进入本地系统"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-zinc-800/60 py-4 bg-zinc-950/20">
          <p className="text-xs text-zinc-500">
            Powered by Cloudflare D1 & Pages
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
