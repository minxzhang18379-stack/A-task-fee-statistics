import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getTasks, Task } from "@/lib/db";
import { exportToExcel } from "@/lib/excelEngine";
import { FileText, Download, TrendingUp, Users, Layers, Filter, Calendar } from "lucide-react";
import { getPhotographerShares } from "./tasks";
import { useLanguage } from "@/components/language-provider";

export default function Dashboard() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const { t, language } = useLanguage();

  const formatMonth = (taskDate: string | undefined) => {
    if (!taskDate) return "";
    const parts = taskDate.split("-");
    if (!parts[0] || !parts[1]) return "";
    return language === "zh" ? `${parts[0]}年${parts[1]}月` : `${parts[0]}-${parts[1]}`;
  };

  const unknownMonth = language === "zh" ? "未知月份" : "Unknown Month";
  
  const [stats, setStats] = useState({
    totalTasks: 0,
    totalFees: 0,
    uniquePhotographers: 0,
    uniqueTaskTypes: 0,
    typeCounts: [] as { type: string; count: number; percentage: number }[],
    monthlyStats: [] as { month: string; taskCount: number; feeSum: number }[],
  });

  useEffect(() => {
    async function loadData() {
      try {
        const tasks = await getTasks();
        setAllTasks(tasks);
      } catch (error) {
        console.error("Failed to load tasks:", error);
      }
    }
    loadData();
  }, []);

  // Dynamically calculate stats whenever allTasks or selectedMonth changes
  useEffect(() => {
    // 1. Group ALL tasks by month for the monthly statistics grid
    const monthlyGroups: Record<string, { count: number; fee: number }> = {};
    allTasks.forEach(t => {
      if (!t.taskDate) return;
      const monthKey = formatMonth(t.taskDate) || unknownMonth;
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = { count: 0, fee: 0 };
      }
      monthlyGroups[monthKey].count += 1;
      
      const shares = getPhotographerShares(t.photographer || "", t.taskType || "", t.fee || 0);
      const totalTaskFee = shares.reduce((acc, share) => acc + share.fee, 0);
      monthlyGroups[monthKey].fee += totalTaskFee;
    });

    const monthlyStats = Object.entries(monthlyGroups)
      .map(([month, data]) => ({
        month,
        taskCount: data.count,
        feeSum: data.fee,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)); // Sort descending by month

    // 2. Filter tasks based on selected month for dashboard cards and charts
    const filtered = selectedMonth === "all"
      ? allTasks
      : allTasks.filter(t => {
          if (!t.taskDate) return false;
          const m = formatMonth(t.taskDate);
          return m === selectedMonth;
        });

    let totalFees = 0;
    const photographersSet = new Set<string>();
    const types = new Set(filtered.map(t => t.taskType).filter(Boolean));

    filtered.forEach(t => {
      const shares = getPhotographerShares(t.photographer || "", t.taskType || "", t.fee || 0);
      shares.forEach(share => {
        totalFees += share.fee;
        if (share.name) {
          photographersSet.add(share.name);
        }
      });
    });

    // Group by task type for distribution
    const typeMap: Record<string, number> = {};
    filtered.forEach(t => {
      if (t.taskType) {
        typeMap[t.taskType] = (typeMap[t.taskType] || 0) + 1;
      }
    });

    const totalTypeEntries = Object.values(typeMap).reduce((a, b) => a + b, 0);
    const typeCounts = Object.entries(typeMap)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalTypeEntries > 0 ? (count / totalTypeEntries) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5 types

    setStats({
      totalTasks: filtered.length,
      totalFees,
      uniquePhotographers: photographersSet.size,
      uniqueTaskTypes: types.size,
      typeCounts,
      monthlyStats,
    });
  }, [allTasks, selectedMonth]);

  // Extract list of unique months for the dropdown filter
  const uniqueMonths = Array.from(
    new Set(
      allTasks
        .map(t => formatMonth(t.taskDate))
        .filter(Boolean)
    )
  )
    .sort()
    .reverse();

  const statCards = [
    {
      title: t("dashboard.cards.registeredTasks"),
      value: stats.totalTasks,
      suffix: t("dashboard.cards.unitTasks"),
      description: selectedMonth === "all" ? t("dashboard.cards.descTasksAll") : t("dashboard.cards.descTasksMonth", { month: selectedMonth }),
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: t("dashboard.cards.payoutBudget"),
      value: `¥${stats.totalFees.toFixed(2)}`,
      description: selectedMonth === "all" ? t("dashboard.cards.descFeesAll") : t("dashboard.cards.descFeesMonth", { month: selectedMonth }),
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      title: t("dashboard.cards.activePhotographers"),
      value: stats.uniquePhotographers,
      suffix: t("dashboard.cards.unitPhotos"),
      description: selectedMonth === "all" ? t("dashboard.cards.descPhotosAll") : t("dashboard.cards.descPhotosMonth", { month: selectedMonth }),
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/50",
    },
    {
      title: t("dashboard.cards.taskTypes"),
      value: stats.uniqueTaskTypes,
      suffix: t("dashboard.cards.unitTypes"),
      description: selectedMonth === "all" ? t("dashboard.cards.descTypesAll") : t("dashboard.cards.descTypesMonth", { month: selectedMonth }),
      icon: Layers,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text">{t("dashboard.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Quick Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> {t("dashboard.filterLabel")}
            </span>
            <select
              className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">{t("dashboard.allMonths")}</option>
              {uniqueMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => exportToExcel()} className="gap-2 cursor-pointer shadow-xs">
            <Download className="w-4 h-4" />
            {t("dashboard.exportBtn")}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {card.value}
                  {card.suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{card.suffix}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Statistics Table & Type Distribution Charts */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Month-by-Month Categorized Grid */}
        <Card className="md:col-span-1 border border-border/80 bg-card shadow-xs flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-primary" />
              {t("dashboard.table.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[300px] p-0 border-t">
            <div className="divide-y text-xs">
              <div className="flex py-2.5 px-4 font-semibold text-muted-foreground bg-muted/20">
                <span className="flex-1">{t("dashboard.table.month")}</span>
                <span className="w-16 text-center">{t("dashboard.table.taskCount")}</span>
                <span className="w-24 text-right">{t("dashboard.table.feeSum")}</span>
              </div>
              {stats.monthlyStats.length ? (
                stats.monthlyStats.map((item) => (
                  <div
                    key={item.month}
                    className={`flex py-3 px-4 items-center transition-colors hover:bg-muted/10 cursor-pointer ${
                      selectedMonth === item.month ? "bg-primary/5 text-primary font-semibold" : "text-foreground"
                    }`}
                    onClick={() => setSelectedMonth(item.month)}
                  >
                    <span className="flex-1">{item.month}</span>
                    <span className="w-16 text-center bg-muted/60 dark:bg-muted/30 rounded py-0.5 font-medium text-xs">
                      {item.taskCount}
                    </span>
                    <span className="w-24 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ¥{item.feeSum.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  {t("dashboard.table.noData")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Type Distribution */}
        <Card className="md:col-span-2 border border-border/80 bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {selectedMonth === "all" ? t("dashboard.chart.allTypesTitle") : t("dashboard.chart.monthTypesTitle", { month: selectedMonth })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.typeCounts.length ? (
                stats.typeCounts.map((item, idx) => {
                  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={item.type} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-foreground">{item.type}</span>
                        <span className="text-muted-foreground">{item.count} {language === "zh" ? "个" : "pcs"} ({item.percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
                  {t("dashboard.chart.noData")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
