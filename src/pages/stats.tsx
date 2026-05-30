import { useState, useEffect, useMemo, useCallback } from "react";
import { getTasks, Task } from "@/lib/db";
import { exportToExcel, exportPersonalBill } from "@/lib/excelEngine";
import { getPhotographerShares } from "./tasks";
import {
  Users,
  Calendar,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
  Camera,
  FileText,
  Layers,
  Briefcase,
  PieChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/language-provider";

// Premium custom inline Renminbi/Yuan SVG icon to guarantee 100% successful compilation and uniform design
const YuanIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 10v11" />
    <path d="m17 4-5 6-5-6" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </svg>
);

// High-precision helper to get the natural week range (Monday to Sunday) of a given date YYYY-MM-DD
function getWeekRange(dateStr: string, language: string) {
  const unknownWeek = language === "zh" ? "未知周" : "Unknown Week";
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    return { weekKey: unknownWeek, startDate: "", endDate: "" };
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) {
    return { weekKey: unknownWeek, startDate: "", endDate: "" };
  }

  const currentDay = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (num: number) => String(num).padStart(2, "0");
  const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const endStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

  const sep = language === "zh" ? " 至 " : " to ";
  return {
    weekKey: `${startStr}${sep}${endStr}`,
    startDate: startStr,
    endDate: endStr,
  };
}

export default function StatsPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<"photographer" | "month" | "week">("photographer");
  const [_isLoading, setIsLoading] = useState(true);
  const { t, language } = useLanguage();
  
  // Selection state for Photographer Tab
  const [selectedPhotoMonth, setSelectedPhotoMonth] = useState<string>("all");
  
  // Accordion state for Weekly Summaries Tab
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const formatMonth = (taskDate: string | undefined) => {
    if (!taskDate) return "";
    const parts = taskDate.split("-");
    if (!parts[0] || !parts[1]) return "";
    return language === "zh" ? `${parts[0]}年${parts[1]}月` : `${parts[0]}-${parts[1]}`;
  };

  const unknownMonth = language === "zh" ? "未知月份" : "Unknown Month";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTasks();
      setAllTasks(data);
    } catch (error) {
      console.error("Failed to load tasks for stats page:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Dynamic Months List Extractor ---
  const availableMonths = useMemo(() => {
    const months = allTasks
      .map((t) => formatMonth(t.taskDate))
      .filter(Boolean);
    return Array.from(new Set(months)).sort().reverse();
  }, [allTasks, language]);

  // Set default selected month on load
  useEffect(() => {
    if (availableMonths.length > 0 && selectedPhotoMonth === "all") {
      setSelectedPhotoMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedPhotoMonth]);

  // --- 1. Per-Person Monthly Fee Statistics ---
  const photographerStats = useMemo(() => {
    const statsMap: Record<string, { name: string; taskCount: number; feeSum: number }> = {};
    let totalMonthlyFees = 0;

    allTasks.forEach((t) => {
      if (!t.taskDate) return;
      const m = formatMonth(t.taskDate);
      
      // Filter by selected month
      if (selectedPhotoMonth !== "all" && m !== selectedPhotoMonth) return;

      const shares = getPhotographerShares(t.photographer || "", t.taskType || "", t.fee || 0);

      shares.forEach((share) => {
        const name = share.name;
        if (!statsMap[name]) {
          statsMap[name] = { name, taskCount: 0, feeSum: 0 };
        }
        statsMap[name].taskCount += 1;
        statsMap[name].feeSum += share.fee;
        totalMonthlyFees += share.fee;
      });
    });

    const list = Object.values(statsMap).sort((a, b) => b.feeSum - a.feeSum);
    return {
      list,
      totalMonthlyFees,
    };
  }, [allTasks, selectedPhotoMonth, language]);

  // --- 2. Monthly Task Statistics ---
  const monthlyStats = useMemo(() => {
    const statsMap: Record<string, { month: string; totalTasks: number; majorCount: number; nonMajorCount: number; feeSum: number }> = {};

    allTasks.forEach((t) => {
      if (!t.taskDate) return;
      const monthKey = formatMonth(t.taskDate) || unknownMonth;

      if (!statsMap[monthKey]) {
        statsMap[monthKey] = {
          month: monthKey,
          totalTasks: 0,
          majorCount: 0,
          nonMajorCount: 0,
          feeSum: 0,
        };
      }

      statsMap[monthKey].totalTasks += 1;
      
      const shares = getPhotographerShares(t.photographer || "", t.taskType || "", t.fee || 0);
      const totalTaskFee = shares.reduce((acc, share) => acc + share.fee, 0);
      statsMap[monthKey].feeSum += totalTaskFee;
      
      if (t.taskType === "重大") {
        statsMap[monthKey].majorCount += 1;
      } else {
        statsMap[monthKey].nonMajorCount += 1;
      }
    });

    return Object.values(statsMap).sort((a, b) => b.month.localeCompare(a.month));
  }, [allTasks, language]);

  // --- 3. Weekly Task Statistics ---
  const weeklyStats = useMemo(() => {
    const statsMap: Record<string, { weekKey: string; startDate: string; endDate: string; tasks: Task[]; totalTasks: number; totalFees: number }> = {};

    allTasks.forEach((t) => {
      if (!t.taskDate) return;
      const { weekKey, startDate, endDate } = getWeekRange(t.taskDate, language);
      if (!statsMap[weekKey]) {
        statsMap[weekKey] = {
          weekKey,
          startDate,
          endDate,
          tasks: [],
          totalTasks: 0,
          totalFees: 0,
        };
      }
      statsMap[weekKey].tasks.push(t);
      statsMap[weekKey].totalTasks += 1;
      
      const shares = getPhotographerShares(t.photographer || "", t.taskType || "", t.fee || 0);
      const totalTaskFee = shares.reduce((acc, share) => acc + share.fee, 0);
      statsMap[weekKey].totalFees += totalTaskFee;
    });

    // Sort weeks descending (newest weeks first)
    return Object.values(statsMap).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [allTasks, language]);

  const toggleWeekExpand = (weekKey: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const handleWeeklyExport = async (tasks: Task[], startDate: string, endDate: string) => {
    const filename = language === "zh" 
      ? `稿费周报_${startDate}_至_${endDate}` 
      : `Weekly_Fees_Report_${startDate}_to_${endDate}`;
    await exportToExcel(tasks, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text">
          {t("stats.title")}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {t("stats.subtitle")}
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-border space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("photographer")}
          className={`pb-3 transition-colors cursor-pointer relative ${
            activeTab === "photographer" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {t("stats.tabPhotographer")}
          </span>
          {activeTab === "photographer" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-200" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("month")}
          className={`pb-3 transition-colors cursor-pointer relative ${
            activeTab === "month" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {t("stats.tabMonth")}
          </span>
          {activeTab === "month" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-200" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("week")}
          className={`pb-3 transition-colors cursor-pointer relative ${
            activeTab === "week" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            {t("stats.tabWeek")}
          </span>
          {activeTab === "week" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-200" />
          )}
        </button>
      </div>


      {/* --- TAB CONTENT 1: Per-Person Monthly Fee Statistics --- */}
      {activeTab === "photographer" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Month Filter */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">{t("stats.dropdownMonth")}</span>
            <select
              className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer"
              value={selectedPhotoMonth}
              onChange={(e) => setSelectedPhotoMonth(e.target.value)}
            >
              <option value="all">{t("stats.dropdownAllMonths")}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {photographerStats.list.length} <span className="text-sm font-normal text-muted-foreground ml-0.5">{t("stats.cards.unitPhotos")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {selectedPhotoMonth === "all" ? t("stats.cards.activeDescAll") : t("stats.cards.activeDesc")}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <YuanIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">¥{photographerStats.totalMonthlyFees.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {selectedPhotoMonth === "all" ? t("stats.cards.payoutDescAll") : t("stats.cards.payoutDesc")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Photographer Table */}
          <Card className="border border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" />
                {t("stats.tablePhotographer.name")}
              </CardTitle>
              {photographerStats.list.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 cursor-pointer text-blue-700 border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 dark:border-blue-950/50 dark:bg-blue-950/20 dark:text-blue-400 font-semibold"
                  onClick={async () => {
                    const filename = selectedPhotoMonth === "all" 
                      ? (language === "zh" ? "累计个人账单" : "Cumulative_Personal_Bill")
                      : `${selectedPhotoMonth}${language === "zh" ? "个人账单" : "_Personal_Bill"}`;
                    
                    const tasksForMonth = allTasks.filter(t => {
                      if (!t.taskDate) return false;
                      if (selectedPhotoMonth === "all") return true;
                      return formatMonth(t.taskDate) === selectedPhotoMonth;
                    });

                    await exportPersonalBill(tasksForMonth, filename, language);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {selectedPhotoMonth === "all" ? t("stats.tablePhotographer.exportAllBtn") : t("stats.tablePhotographer.exportBtn", { month: selectedPhotoMonth })}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-muted/10 border-b font-semibold text-muted-foreground">
                      <th className="py-3 px-4">{t("stats.tablePhotographer.rank")}</th>
                      <th className="py-3 px-4">{t("stats.tablePhotographer.name")}</th>
                      <th className="py-3 px-4 text-center">{t("stats.tablePhotographer.taskCount")}</th>
                      <th className="py-3 px-4 text-right">{t("stats.tablePhotographer.totalFee")}</th>
                      <th className="py-3 px-4 text-right">{language === "zh" ? "占比" : "Ratio"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {photographerStats.list.length > 0 ? (
                      photographerStats.list.map((item, index) => (
                        <tr key={item.name} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-bold text-muted-foreground">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">
                            <span className="flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-primary" />
                              {item.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-semibold">
                              {item.taskCount} {language === "zh" ? "次" : "times"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ¥{item.feeSum.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground font-semibold">
                            {photographerStats.totalMonthlyFees > 0 ? ((item.feeSum / photographerStats.totalMonthlyFees) * 100).toFixed(1) : "0.0"}%
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground font-semibold">
                          {t("stats.tablePhotographer.noData")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Bento Glass Cards View */}
              <div className="block md:hidden divide-y divide-border/50">
                {photographerStats.list.length > 0 ? (
                  photographerStats.list.map((item, index) => (
                    <div key={item.name} className="p-4 flex flex-col gap-3 hover:bg-muted/10 transition-colors">
                      {/* Rank, Name and Total Payout */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-muted-foreground">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                          </span>
                          <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-primary shrink-0" />
                            {item.name}
                          </span>
                        </div>
                        <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                          ¥{item.feeSum.toFixed(2)}
                        </span>
                      </div>
                      {/* Bento Cards (Task Count and Percentage Ratio) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 text-xs">
                          <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-foreground/90">
                            {item.taskCount} {language === "zh" ? "次" : "times"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 text-xs">
                          <PieChart className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <span className="font-semibold text-foreground/90">
                            {photographerStats.totalMonthlyFees > 0 ? ((item.feeSum / photographerStats.totalMonthlyFees) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground font-semibold text-xs">
                    {t("stats.tablePhotographer.noData")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- TAB CONTENT 2: Monthly Task Summaries --- */}
      {activeTab === "month" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Quick Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{allTasks.length} {language === "zh" ? "个" : "pcs"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{language === "zh" ? "累计总任务登记" : "Total Historic Tasks"}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <YuanIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    ¥{allTasks.reduce((acc, t) => {
                      const shares = getPhotographerShares(t.photographer || "", t.taskType || "", t.fee || 0);
                      return acc + shares.reduce((sum, share) => sum + share.fee, 0);
                    }, 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{language === "zh" ? "累计应发稿费支出" : "Cumulative Historic Payouts"}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 bg-card shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {monthlyStats.length} {language === "zh" ? "个" : "months"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{language === "zh" ? "已跨月份周期" : "Active Month Cycles"}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Summaries Table */}
          <Card className="border border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                {t("stats.tableMonth.month")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-muted/10 border-b font-semibold text-muted-foreground">
                      <th className="py-3 px-4">{t("stats.tableMonth.month")}</th>
                      <th className="py-3 px-4 text-center">{language === "zh" ? "总登记任务量" : "Total Tasks"}</th>
                      <th className="py-3 px-4 text-center">{language === "zh" ? "重大任务数" : "Major Tasks"}</th>
                      <th className="py-3 px-4 text-center">{language === "zh" ? "非重大任务数" : "Minor Tasks"}</th>
                      <th className="py-3 px-4 text-right">{t("stats.tableMonth.feeSum")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {monthlyStats.length > 0 ? (
                      monthlyStats.map((item) => (
                        <tr key={item.month} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-bold text-foreground">
                            {item.month}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-semibold">
                              {item.totalTasks} {language === "zh" ? "个" : "pcs"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-rose-600 dark:text-rose-400 font-semibold">
                            {item.majorCount} {language === "zh" ? "个" : "pcs"}
                          </td>
                          <td className="py-3 px-4 text-center text-blue-600 dark:text-blue-400 font-semibold">
                            {item.nonMajorCount} {language === "zh" ? "个" : "pcs"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ¥{item.feeSum.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground font-semibold">
                          {t("stats.tableMonth.noData")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Bento Grid View */}
              <div className="block md:hidden divide-y divide-border/50">
                {monthlyStats.length > 0 ? (
                  monthlyStats.map((item) => (
                    <div key={item.month} className="p-4 flex flex-col gap-3 hover:bg-muted/10 transition-colors">
                      {/* Month Title */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-bold text-sm text-foreground">{item.month}</span>
                      </div>
                      {/* 4-cell Bento Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 text-xs">
                          <Briefcase className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="font-semibold text-foreground/90">
                            {language === "zh" ? "总任务: " : "Total: "}
                            {item.totalTasks} {language === "zh" ? "个" : "pcs"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 text-xs">
                          <YuanIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            ¥{item.feeSum.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 text-xs">
                          <Layers className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {language === "zh" ? "重大: " : "Major: "}
                            {item.majorCount} {language === "zh" ? "个" : "pcs"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-500/5 dark:bg-slate-500/10 border border-slate-500/10 text-xs">
                          <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="font-semibold text-muted-foreground">
                            {language === "zh" ? "非重大: " : "Minor: "}
                            {item.nonMajorCount} {language === "zh" ? "个" : "pcs"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground font-semibold text-xs">
                    {t("stats.tableMonth.noData")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- TAB CONTENT 3: Weekly Task Summaries & Exports --- */}
      {activeTab === "week" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="p-4 bg-muted/20 border rounded-lg flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-muted-foreground">
                {language === "zh" 
                  ? "按自然周（周一至周日）精准整合分组，支持单独周的快速导出。" 
                  : "Grouped by natural calendar weeks (Monday to Sunday), supporting standalone weekly report exports."}
              </span>
            </div>
            <span className="text-muted-foreground">
              {language === "zh" ? "共划分为" : "Total weeks count:"} <span className="font-bold text-foreground">{weeklyStats.length}</span> {language === "zh" ? "个自然周" : "weeks"}
            </span>
          </div>

          {/* Weekly Accordion Cards */}
          <div className="space-y-3">
            {weeklyStats.length > 0 ? (
              weeklyStats.map((week) => {
                const isExpanded = !!expandedWeeks[week.weekKey];
                return (
                  <div
                    key={week.weekKey}
                    className="border border-border/80 rounded-lg overflow-hidden bg-card shadow-xs transition-all duration-200"
                  >
                    {/* Desktop/Tablet Header */}
                    <div className="hidden sm:flex items-center justify-between p-4 bg-muted/10 border-b border-border/50 gap-4">
                      {/* Week Title & Stats */}
                      <div className="flex-1 flex flex-row items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-sm text-foreground">{week.weekKey}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground/85" /> {language === "zh" ? "任务:" : "Tasks:"} <span className="text-foreground">{week.totalTasks} {language === "zh" ? "个" : "pcs"}</span>
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <YuanIcon className="w-3.5 h-3.5 text-muted-foreground/85" /> {language === "zh" ? "总支出:" : "Total Payout:"} <span className="text-emerald-600 dark:text-emerald-400 font-bold">¥{week.totalFees.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Weekly Export Excel */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 dark:border-emerald-950/50 dark:bg-emerald-950/20 dark:text-emerald-400 gap-1.5 cursor-pointer"
                          onClick={() => handleWeeklyExport(week.tasks, week.startDate, week.endDate)}
                        >
                          <Download className="w-3.5 h-3.5" /> {t("stats.tableWeek.exportBtn")}
                        </Button>
                        {/* Toggle Detail */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md hover:bg-muted"
                          onClick={() => toggleWeekExpand(week.weekKey)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Header (Vertical & Bento) */}
                    <div className="flex sm:hidden flex-col p-4 bg-muted/10 border-b border-border/50 gap-3">
                      {/* Row 1: Title & Toggle */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-sm text-foreground">{week.weekKey}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md hover:bg-muted shrink-0"
                          onClick={() => toggleWeekExpand(week.weekKey)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                      
                      {/* Row 2: Bento Grid */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 text-xs">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-foreground/90">
                            {language === "zh" ? "任务: " : "Tasks: "}
                            {week.totalTasks} {language === "zh" ? "个" : "pcs"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 text-xs">
                          <YuanIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            ¥{week.totalFees.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Action Buttons */}
                      <div className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs text-emerald-700 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 dark:border-emerald-950/50 dark:bg-emerald-950/20 dark:text-emerald-400 gap-1.5 cursor-pointer justify-center"
                          onClick={() => handleWeeklyExport(week.tasks, week.startDate, week.endDate)}
                        >
                          <Download className="w-3.5 h-3.5" /> {t("stats.tableWeek.exportBtn")}
                        </Button>
                      </div>
                    </div>

                    {/* Expand Detail List */}
                    {isExpanded && (
                      <div className="border-t bg-muted/10 p-4 animate-in slide-in-from-top-1 duration-150">
                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto rounded-md border border-border bg-card">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-muted/40 border-b font-semibold text-muted-foreground">
                                <th className="py-2.5 px-3">{t("stats.tableWeek.detailDate")}</th>
                                <th className="py-2.5 px-3">{t("stats.tableWeek.detailName")}</th>
                                <th className="py-2.5 px-3">{t("stats.tableWeek.detailPhoto")}</th>
                                <th className="py-2.5 px-3">{t("stats.tableWeek.detailType")}</th>
                                <th className="py-2.5 px-3 text-right">{t("stats.tableWeek.detailFee")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {week.tasks.map((task) => (
                                <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{task.taskDate}</td>
                                  <td className="py-2 px-3 font-semibold text-foreground">{task.title}</td>
                                  <td className="py-2 px-3 flex-wrap">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                                      {task.photographer}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      task.taskType === "重大" 
                                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
                                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                                    }`}>
                                      {task.taskType === "重大" ? t("tasks.table.majorBadge") : task.taskType === "非重大" ? t("tasks.table.minorBadge") : t("tasks.table.customBadge")}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                    ¥{(task.fee || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile View */}
                        <div className="block md:hidden space-y-3">
                          {week.tasks.map((task) => (
                            <div key={task.id} className="p-3 bg-card border border-border/60 rounded-lg flex flex-col gap-2.5 shadow-xs">
                              {/* Title & Type Badge */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground shrink-0">
                                    #{task.id}
                                  </span>
                                  <h4 className="font-bold text-foreground text-xs leading-snug break-words truncate">
                                    {task.title}
                                  </h4>
                                </div>
                                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                                  task.taskType === "重大" 
                                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                                }`}>
                                  {task.taskType === "重大" ? t("tasks.table.majorBadge") : task.taskType === "非重大" ? t("tasks.table.minorBadge") : t("tasks.table.customBadge")}
                                </span>
                              </div>
                              
                              {/* Photographer & Date Widgets */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 dark:bg-primary/10 border border-primary/10 text-[11px] min-w-0">
                                  <Camera className="h-3 w-3 text-primary shrink-0" />
                                  <span className="truncate font-semibold text-foreground/90" title={task.photographer}>{task.photographer || "-"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/40 border border-border/40 text-[11px] min-w-0">
                                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate font-medium text-muted-foreground" title={task.taskDate}>{task.taskDate || "-"}</span>
                                </div>
                              </div>

                              {/* Fee */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                <span className="text-[10px] text-muted-foreground">{t("stats.tableWeek.detailFee")}:</span>
                                <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                                  ¥{(task.fee || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg font-semibold text-xs">
                {t("stats.tableWeek.noData")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
