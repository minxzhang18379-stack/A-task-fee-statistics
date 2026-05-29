import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  Task,
} from "@/lib/db";
import { importFromExcel, importFromTxt } from "@/lib/excelEngine";
import { Plus, Trash2, Edit, ArrowUpDown, Search, Camera, FileText, Calendar, Info, Layers, Download, Filter, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

// Helper to count photographers and calculate split fees
export const calculateFee = (type: string, photographer: string): number => {
  const cleanStr = (photographer || "").trim();
  if (!cleanStr) return 0;
  
  // Split by Chinese/English commas, slashes, ideographic commas, semicolons, and spaces
  const delimiters = /[，,\/、；; ]+/;
  const names = cleanStr.split(delimiters).filter(Boolean);
  const count = names.length || 1;
  
  if (type === "重大") {
    return Number((120 / count).toFixed(2));
  } else if (type === "非重大") {
    return Number((50 / count).toFixed(2));
  }
  return 0;
};

export interface PhotographerShare {
  name: string;
  fee: number;
  percentage?: number;
}

// Master helper to get exact photographer shares, including custom split percentages
export const getPhotographerShares = (
  photographer: string,
  type: string,
  totalFee: number
): PhotographerShare[] => {
  const cleanStr = (photographer || "").trim();
  if (!cleanStr) return [];

  // Split by standard delimiters
  const delimiters = /[，,\/、；; ]+/;
  const parts = cleanStr.split(delimiters).filter(Boolean);

  return parts.map((part) => {
    // Strip parenthesized "修图" tags first
    const cleanPart = part.replace(/\s*[（\(]修图[）\)]/g, '').trim();

    // Check for custom fee format in parentheses e.g. "张三(30.00)" or "张三"
    const match = cleanPart.match(/^([^(]+)\(([^)]+)\)$/);
    if (match) {
      const name = match[1].trim();
      const feeVal = parseFloat(match[2]);
      if (!isNaN(feeVal)) {
        const percentage = totalFee > 0 ? Number(((feeVal / totalFee) * 100).toFixed(1)) : 0;
        return { name, fee: feeVal, percentage };
      }
    }

    // Standard equal split
    let individualFee = 0;
    if (type === "重大") {
      individualFee = Number((120 / parts.length).toFixed(2));
    } else if (type === "非重大") {
      individualFee = Number((50 / parts.length).toFixed(2));
    } else {
      individualFee = Number((totalFee / parts.length).toFixed(2));
    }

    const percentage = totalFee > 0 
      ? Number(((individualFee / totalFee) * 100).toFixed(1)) 
      : Number((100 / parts.length).toFixed(1));
      
    return {
      name: part.trim(),
      fee: individualFee,
      percentage,
    };
  });
};

export default function TasksPage() {
  const { t, language } = useLanguage();
  const userRole = localStorage.getItem('pann_user_role') || 'admin';
  const hasWritePermission = userRole === 'admin' || userRole === 'manager';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  
  // Batch states
  const [batchType, setBatchType] = useState("非重大");
  const [batchDate, setBatchDate] = useState("");
  const [batchPhotographer, setBatchPhotographer] = useState("");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [form, setForm] = useState({
    title: "",
    photographer: "",
    taskType: "非重大", // Default to "非重大"
    taskDate: "",
    fee: 50, // Default to 50 for "非重大"
  });

  // Custom percentages state for custom split task types
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});
  
  // Dynamically extract names from the photographer input to feed the allocation grid
  const currentNames = useMemo(() => {
    const cleanStr = (form.photographer || "").trim();
    if (!cleanStr) return [];
    const delimiters = /[，,\/、；; ]+/;
    return cleanStr.split(delimiters).filter(Boolean).map(n => {
      // Strip any bracketed numbers (e.g. "张三(30)") to extract just the pure name
      return n.replace(/\([^)]*\)/, '').trim();
    }).filter(Boolean);
  }, [form.photographer]);

  // Keep customPercentages synchronized with the pure names typed in the text box
  useEffect(() => {
    if (form.taskType === "自定义" && currentNames.length > 0) {
      setCustomPercentages(prev => {
        const next: Record<string, number> = {};
        let sum = 0;
        currentNames.forEach((name, idx) => {
          if (prev[name] !== undefined) {
            next[name] = prev[name];
            sum += prev[name];
          } else {
            // Auto equal percentage division
            if (idx === currentNames.length - 1) {
              next[name] = Math.max(0, 100 - sum);
            } else {
              const equal = Math.round(100 / currentNames.length);
              next[name] = equal;
              sum += equal;
            }
          }
        });
        return next;
      });
    }
  }, [form.taskType, currentNames]);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Filter tasks by month and global search
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesMonth = selectedMonth === "all" || (t.taskDate?.startsWith(selectedMonth) ?? false);
      const matchesSearch = globalFilter === "" || Object.values(t).some(v => String(v).includes(globalFilter));
      return matchesMonth && matchesSearch;
    });
  }, [tasks, selectedMonth, globalFilter]);

  // Auto-calculate and update form fee dynamically when photographer names or taskType changes
  useEffect(() => {
    if (form.taskType === "重大" || form.taskType === "非重大") {
      const calculated = calculateFee(form.taskType, form.photographer);
      setForm((prev) => ({ ...prev, fee: calculated }));
    }
  }, [form.taskType, form.photographer]);

  // Extract available unique months dynamically from tasks for the filter dropdown
  const availableMonths = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .map((t) => {
            if (!t.taskDate) return "";
            const parts = t.taskDate.split("-");
            return parts[0] && parts[1] ? `${parts[0]}-${parts[1]}` : "";
          })
          .filter(Boolean)
      )
    )
      .sort()
      .reverse();
  }, [tasks]);

  const handleAddTask = async () => {
    if (!form.title || !form.photographer || !form.taskType || !form.taskDate) {
      alert(t("tasks.form.placeholderRequire"));
      return;
    }

    if (form.taskType === "自定义") {
      const sum = Object.values(customPercentages).reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        alert(t("tasks.form.splitError", { sum }));
        return;
      }
    }

    try {
      const totalFee = Number(form.fee) || 0;
      let finalPhotographer = form.photographer.replace(/\s*[（\(]修图[）\)]/g, '').trim();
      
      if (form.taskType === "自定义") {
        finalPhotographer = currentNames.map(name => {
          const pct = customPercentages[name] || 0;
          const individualPayout = Number((totalFee * (pct / 100)).toFixed(2));
          return `${name}(${individualPayout})`;
        }).join("、");
      }

      await addTask({
        title: form.title,
        photographer: finalPhotographer,
        taskType: form.taskType,
        taskDate: form.taskDate,
        fee: totalFee,
      });
      
      setForm({ title: "", photographer: "", taskType: "非重大", taskDate: new Date().toISOString().split("T")[0], fee: 50 });
      setCustomPercentages({});
      setIsAddDialogOpen(false);
      await loadTasks();
    } catch (error) {
      console.error("Failed to add task", error);
      alert(t("tasks.form.saveFail") + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask || !selectedTask.id || !form.title || !form.photographer || !form.taskType || !form.taskDate) {
      alert(t("tasks.form.placeholderRequire"));
      return;
    }

    if (form.taskType === "自定义") {
      const sum = Object.values(customPercentages).reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        alert(t("tasks.form.splitError", { sum }));
        return;
      }
    }

    try {
      const totalFee = Number(form.fee) || 0;
      let finalPhotographer = form.photographer.replace(/\s*[（\(]修图[）\)]/g, '').trim();
      
      if (form.taskType === "自定义") {
        finalPhotographer = currentNames.map(name => {
          const pct = customPercentages[name] || 0;
          const individualPayout = Number((totalFee * (pct / 100)).toFixed(2));
          return `${name}(${individualPayout})`;
        }).join("、");
      }

      await updateTask({
        id: selectedTask.id,
        title: form.title,
        photographer: finalPhotographer,
        taskType: form.taskType,
        taskDate: form.taskDate,
        fee: totalFee,
      });

      setForm({ title: "", photographer: "", taskType: "非重大", taskDate: "", fee: 50 });
      setCustomPercentages({});
      setIsEditDialogOpen(false);
      setSelectedTask(null);
      await loadTasks();
    } catch (error) {
      console.error("Failed to update task", error);
      alert(t("tasks.form.editFail") + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleDeleteTask = useCallback(async (id: number) => {
    if (!confirm(t("tasks.table.confirmDeleteOne"))) return;
    try {
      await deleteTask(id);
      await loadTasks();
    } catch (error) {
      console.error("Failed to delete task", error);
      alert("删除失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [loadTasks, t]);

  const handleBatchImport = async () => {
    const count = await importFromExcel();
    if (count > 0) {
      await loadTasks();
    }
  };

  const handleTxtImport = async () => {
    const count = await importFromTxt();
    if (count > 0) {
      await loadTasks();
    }
  };

  // --- Batch Actions ---
  const handleBatchUpdateType = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    try {
      const tasksToUpdate = selectedRows.map((row) => row.original);
      for (const t of tasksToUpdate) {
        if (!t.id) continue;
        const newFee = calculateFee(batchType, t.photographer);
        await updateTask({
          id: t.id,
          title: t.title,
          photographer: t.photographer,
          taskType: batchType,
          taskDate: t.taskDate,
          fee: newFee,
        });
      }
      setRowSelection({});
      const localizedType = batchType === "重大" ? t("tasks.table.majorBadge") : t("tasks.table.minorBadge");
      alert(t("tasks.batchPanel.successType", { count: tasksToUpdate.length, type: localizedType }));
      await loadTasks();
    } catch (error) {
      console.error("Batch update failed:", error);
      alert("批量修改失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleBatchUpdateDate = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    if (!batchDate) {
      alert(t("tasks.batchPanel.targetDatePlaceholder"));
      return;
    }

    try {
      const tasksToUpdate = selectedRows.map((row) => row.original);
      for (const t of tasksToUpdate) {
        if (!t.id) continue;
        await updateTask({
          id: t.id,
          title: t.title,
          photographer: t.photographer,
          taskType: t.taskType,
          taskDate: batchDate,
          fee: t.fee,
        });
      }
      setRowSelection({});
      setBatchDate("");
      alert(t("tasks.batchPanel.successDate", { count: tasksToUpdate.length, date: batchDate }));
      await loadTasks();
    } catch (error) {
      console.error("Batch date update failed:", error);
      alert("批量修改日期失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleBatchUpdatePhotographer = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    const cleanPhoto = batchPhotographer.replace(/\s*[（\(]修图[）\)]/g, '').trim();
    if (!cleanPhoto) {
      alert(t("tasks.batchPanel.targetPhotoPlaceholder"));
      return;
    }

    try {
      const tasksToUpdate = selectedRows.map((row) => row.original);
      for (const t of tasksToUpdate) {
        if (!t.id) continue;
        const newFee = calculateFee(t.taskType, cleanPhoto);
        await updateTask({
          id: t.id,
          title: t.title,
          photographer: cleanPhoto,
          taskType: t.taskType,
          taskDate: t.taskDate,
          fee: newFee,
        });
      }
      setRowSelection({});
      setBatchPhotographer("");
      alert(t("tasks.batchPanel.successPhoto", { count: tasksToUpdate.length, photo: cleanPhoto }));
      await loadTasks();
    } catch (error) {
      console.error("Batch photographer update failed:", error);
      alert("批量修改拍摄人失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleBatchDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    if (!confirm(t("tasks.batchPanel.confirmDelete", { count: selectedRows.length }))) return;

    try {
      const tasksToDelete = selectedRows.map((row) => row.original);
      for (const t of tasksToDelete) {
        if (!t.id) continue;
        await deleteTask(t.id);
      }
      setRowSelection({});
      alert(t("tasks.batchPanel.successDelete", { count: tasksToDelete.length }));
      await loadTasks();
    } catch (error) {
      console.error("Batch delete failed:", error);
      alert("批量删除失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const openEditDialog = useCallback((task: Task) => {
    setSelectedTask(task);
    
    const initialType = task.taskType || "非重大";
    const initialFee = task.fee || 0;

    if (initialType === "自定义") {
      const shares = getPhotographerShares(task.photographer, initialType, initialFee);
      const pcts: Record<string, number> = {};
      shares.forEach(s => {
        pcts[s.name] = s.percentage || 0;
      });
      setCustomPercentages(pcts);
      
      setForm({
        title: task.title,
        photographer: shares.map(s => s.name).join("、"),
        taskType: initialType,
        taskDate: task.taskDate,
        fee: initialFee,
      });
    } else {
      setCustomPercentages({});
      setForm({
        title: task.title,
        photographer: task.photographer,
        taskType: initialType,
        taskDate: task.taskDate,
        fee: initialFee,
      });
    }
    setIsEditDialogOpen(true);
  }, []);

  const openAddDialog = () => {
    setCustomPercentages({});
    setForm({
      title: "",
      photographer: "",
      taskType: "非重大",
      taskDate: new Date().toISOString().split("T")[0], // Default to today
      fee: 50,
    });
    setIsAddDialogOpen(true);
  };

  const selectedCount = Object.keys(rowSelection).filter((k) => rowSelection[k]).length;

  const columns = useMemo<ColumnDef<Task>[]>(() => {
    const cols: ColumnDef<Task>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            className="rounded border-input h-4 w-4 cursor-pointer accent-primary"
            checked={table.getIsAllPageRowsSelected() || table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="rounded border-input h-4 w-4 cursor-pointer accent-primary"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")} className="px-0 font-semibold hover:bg-transparent gap-1">
            {t("tasks.table.id")} <ArrowUpDown className="h-3 w-3" />
          </Button>
        ),
        size: 60,
      },
      {
        accessorKey: "title",
        header: t("tasks.table.taskName"),
        size: 200,
        cell: ({ row }) => (
          <span className="font-semibold text-foreground text-sm">{row.getValue("title")}</span>
        ),
      },
      {
        accessorKey: "photographer",
        header: t("tasks.table.photographer"),
        size: 130,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-muted text-xs font-semibold text-foreground">
            <Camera className="h-3 w-3 text-muted-foreground" />
            {row.getValue("photographer") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "taskType",
        header: t("tasks.table.taskType"),
        size: 130,
        cell: ({ row }) => {
          const type = row.getValue("taskType") as string;
          const isMajor = type === "重大";
          const isMinor = type === "非重大";
          const isCustom = type === "自定义";
          
          let displayType = t("tasks.table.uncategorized");
          if (isMajor) displayType = t("tasks.table.majorBadge");
          else if (isMinor) displayType = t("tasks.table.minorBadge");
          else if (isCustom) displayType = t("tasks.table.customBadge");
          else if (type) displayType = type;

          return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-bold shadow-xs ${
              isMajor 
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
                : isCustom
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
            }`}>
              <Layers className="h-3 w-3" />
              {displayType}
            </span>
          );
        },
      },
      {
        accessorKey: "taskDate",
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() !== "desc")} className="px-0 font-semibold hover:bg-transparent gap-1">
            {t("tasks.table.taskDate")} <ArrowUpDown className="h-3 w-3" />
          </Button>
        ),
        size: 120,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {row.getValue("taskDate") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "fee",
        header: t("tasks.table.fee"),
        size: 120,
        cell: ({ row }) => {
          const val = Number(row.getValue("fee")) || 0;
          return (
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              ¥{val.toFixed(2)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("tasks.table.actions"),
        size: 120,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs transition-all border-primary/20 hover:bg-primary/5 hover:text-primary"
                onClick={() => openEditDialog(task)}
              >
                <Edit className="h-3.5 w-3.5 mr-1" /> {t("tasks.table.btnEdit")}
              </Button>
              {hasWritePermission && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteTask(task.id!)}
                  title={t("tasks.table.btnDelete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ];
    return hasWritePermission
      ? cols
      : cols.filter(c => c.id !== 'select' && c.id !== 'actions');
  }, [openEditDialog, handleDeleteTask, t, language, userRole]);

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Compute displayed rows (bound back to TanStack Row model for standard sorted/filtered representation)
  const displayedRows = table.getRowModel().rows;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 animate-in fade-in duration-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-medium">{t("tasks.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text">{t("tasks.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t("tasks.subtitle")}</span>
            {tasks.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold tracking-wider animate-in fade-in zoom-in duration-300">
                {t("tasks.syncBadge", { count: tasks.length })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasWritePermission && (
            <>
              <Button variant="outline" className="gap-2 cursor-pointer border-emerald-300 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/60 dark:border-emerald-950/40 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold" onClick={handleBatchImport}>
                <Download className="h-4 w-4" /> {t("tasks.importExcel")}
              </Button>
              <Button variant="outline" className="gap-2 cursor-pointer border-blue-300 bg-blue-50/50 text-blue-700 hover:bg-blue-100/60 dark:border-blue-950/40 dark:bg-blue-950/20 dark:text-blue-400 font-semibold" onClick={handleTxtImport}>
                <FileText className="h-4 w-4" /> {t("tasks.importTxt")}
              </Button>
              <Button className="gap-2 shadow-xs cursor-pointer font-bold" onClick={openAddDialog}>
                <Plus className="h-4 w-4" /> {t("tasks.addTask")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Batch Edit Action Panel */}
      {selectedCount > 0 && (
        <div className="flex flex-col gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-bold text-primary">{t("tasks.batchPanel.title", { count: selectedCount })}</span>
            </div>
            {hasWritePermission && (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1 cursor-pointer py-1.5 h-auto text-xs font-bold"
                onClick={handleBatchDelete}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("tasks.batchPanel.btnDelete")}
              </Button>
            )}
          </div>
          
          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div className="flex flex-col gap-2 p-3 bg-card rounded-md border shadow-xs">
              <span className="font-semibold text-muted-foreground">{t("tasks.batchPanel.labelType")}</span>
              <div className="flex gap-2 mt-1">
                <select
                  className="flex-1 h-9 rounded-md border border-input bg-card px-2 text-xs font-semibold cursor-pointer focus:outline-none"
                  value={batchType}
                  onChange={(e) => setBatchType(e.target.value)}
                >
                  <option value="非重大">{t("tasks.batchPanel.optionMinor")}</option>
                  <option value="重大">{t("tasks.batchPanel.optionMajor")}</option>
                </select>
                <Button size="sm" onClick={handleBatchUpdateType} className="cursor-pointer font-semibold">{t("tasks.batchPanel.btnUpdate")}</Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-3 bg-card rounded-md border shadow-xs">
              <span className="font-semibold text-muted-foreground">{t("tasks.batchPanel.labelDate")}</span>
              <div className="flex gap-2 mt-1">
                <input
                  type="date"
                  className="flex-1 h-9 rounded-md border border-input bg-card px-2 text-xs font-semibold focus:outline-none"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                />
                <Button size="sm" onClick={handleBatchUpdateDate} className="cursor-pointer font-semibold">{t("tasks.batchPanel.btnUpdate")}</Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-3 bg-card rounded-md border shadow-xs">
              <span className="font-semibold text-muted-foreground">{t("tasks.batchPanel.labelPhoto")}</span>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder={t("tasks.batchPanel.placeholderPhoto")}
                  className="flex-1 h-9 text-xs focus:outline-none pl-2"
                  value={batchPhotographer}
                  onChange={(e) => setBatchPhotographer(e.target.value)}
                />
                <Button size="sm" onClick={handleBatchUpdatePhotographer} className="cursor-pointer font-semibold">{t("tasks.batchPanel.btnUpdate")}</Button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer text-xs font-medium"
              onClick={() => setRowSelection({})}
            >
              {t("tasks.batchPanel.btnCancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Filters Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("tasks.filters.searchPlaceholder")}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> {t("tasks.filters.monthLabel")}
          </span>
          <select
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">{t("tasks.filters.allMonths")}</option>
            {availableMonths.map((m) => {
              const [yr, mo] = m.split("-");
              const displayMonth = language === "zh" ? `${yr}年${mo}月` : `${yr}-${mo}`;
              return (
                <option key={m} value={m}>
                  {displayMonth}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Table */}
      {/* Table (Desktop View) */}
      <Card className="hidden sm:block border border-border/80 shadow-xs overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} style={{ width: header.getSize() }} className="font-semibold text-muted-foreground py-3">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {displayedRows.length ? (
                  displayedRows.map((row) => (
                    <TableRow key={row.id} className={`transition-colors hover:bg-muted/30 ${row.getIsSelected() ? "bg-primary/5 hover:bg-primary/10" : ""}`}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Info className="h-5 w-5 text-muted-foreground/60" />
                        <span>{t("tasks.table.noData")}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Card List (Mobile View) */}
      <div className="block sm:hidden space-y-4">
        {displayedRows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card border border-border/80 rounded-xl">
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Info className="h-6 w-6 text-muted-foreground/60" />
              <span>{t("tasks.table.noData")}</span>
            </div>
          </div>
        ) : (
          displayedRows.map((row) => {
            const task = row.original;
            return (
              <div
                key={row.id}
                className={`relative p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md shadow-xs transition-all hover:bg-card/80 space-y-3 ${
                  row.getIsSelected() ? "ring-1 ring-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {hasWritePermission && (
                      <input
                        type="checkbox"
                        className="rounded border-input h-4 w-4 cursor-pointer accent-primary shrink-0"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                      />
                    )}
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground shrink-0">
                      #{task.id}
                    </span>
                    <h4 className="font-bold text-foreground text-sm leading-snug break-words">
                      {task.title}
                    </h4>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold shadow-xs ${
                    task.taskType === "重大" 
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
                      : task.taskType === "自定义"
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                  }`}>
                    <Layers className="h-2.5 w-2.5" />
                    {task.taskType === "重大" ? t("tasks.table.majorBadge") : task.taskType === "非重大" ? t("tasks.table.minorBadge") : task.taskType === "自定义" ? t("tasks.table.customBadge") : task.taskType}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-semibold text-foreground/90">{task.photographer || "-"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{task.taskDate || "-"}</span>
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] text-muted-foreground">{t("tasks.table.fee")}:</span>
                    <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      ¥{Number(task.fee || 0).toFixed(2)}
                    </span>
                  </div>
                  {hasWritePermission && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs transition-all border-primary/20 hover:bg-primary/5 hover:text-primary gap-1"
                        onClick={() => openEditDialog(task)}
                      >
                        <Edit className="h-3 w-3" /> {t("tasks.table.btnEdit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTask(task.id!)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="pb-8" />

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg">
              <FileText className="h-5 w-5 text-primary" />
              {t("tasks.form.titleAdd")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title" className="font-semibold">{t("tasks.form.fieldTitle")}</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("tasks.form.placeholderTitle")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-photographer" className="font-semibold">{t("tasks.form.fieldPhoto")}</Label>
              <Input
                id="task-photographer"
                value={form.photographer}
                onChange={(e) => setForm({ ...form, photographer: e.target.value })}
                placeholder={t("tasks.form.placeholderPhoto")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-type" className="font-semibold">{t("tasks.form.fieldType")}</Label>
              <select
                id="task-type"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer"
                value={form.taskType}
                onChange={(e) => setForm({ ...form, taskType: e.target.value })}
              >
                <option value="非重大">{t("tasks.form.optionMinor")}</option>
                <option value="重大">{t("tasks.form.optionMajor")}</option>
                <option value="自定义">{t("tasks.form.optionCustom")}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="task-date" className="font-semibold">{t("tasks.form.fieldDate")}</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={form.taskDate}
                  onChange={(e) => setForm({ ...form, taskDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-semibold">{form.taskType === "自定义" ? t("tasks.form.fieldFeeTotal") : t("tasks.form.fieldFeeIndividual")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">¥</span>
                  {form.taskType === "自定义" ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-7 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                      value={form.fee}
                      onChange={(e) => setForm({ ...form, fee: Number(e.target.value) || 0 })}
                    />
                  ) : (
                    <div className="flex h-9 items-center rounded-md border bg-muted/40 pl-7 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {form.fee.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {form.taskType === "自定义" && currentNames.length > 0 && (
              <div className="grid gap-2 p-3 bg-muted/30 border rounded-md">
                <div className="flex items-center justify-between border-b pb-1.5 mb-1">
                  <Label className="text-xs font-bold text-muted-foreground">{t("tasks.form.splitTitle")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] cursor-pointer font-semibold"
                    onClick={() => {
                      const equal = Math.round(100 / currentNames.length);
                      const next: Record<string, number> = {};
                      let sum = 0;
                      currentNames.forEach((name, idx) => {
                        if (idx === currentNames.length - 1) {
                          next[name] = 100 - sum;
                        } else {
                          next[name] = equal;
                          sum += equal;
                        }
                      });
                      setCustomPercentages(next);
                    }}
                  >
                    {t("tasks.form.btnEquallySplit")}
                  </Button>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {currentNames.map((name) => {
                    const percentage = customPercentages[name] || 0;
                    const calculated = Number((form.fee * (percentage / 100)).toFixed(2));
                    return (
                      <div key={name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold truncate max-w-[120px]">{name}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="relative w-20">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="h-7 pr-4 text-right text-xs py-0 pl-1 font-semibold"
                              value={percentage}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                setCustomPercentages(prev => ({ ...prev, [name]: val }));
                              }}
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                          </div>
                          <span className="text-muted-foreground w-16 text-right font-semibold">
                            ¥{calculated.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between border-t pt-1.5 mt-1 text-[10px]">
                  <span className="text-muted-foreground font-semibold">{t("tasks.form.splitTotal")}</span>
                  <span className={`font-extrabold ${
                    Object.values(customPercentages).reduce((a, b) => a + b, 0) === 100 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-rose-500 font-black"
                  }`}>
                    {Object.values(customPercentages).reduce((a, b) => a + b, 0)}% / 100%
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" className="font-semibold" onClick={() => setIsAddDialogOpen(false)}>{t("tasks.form.btnCancel")}</Button>
            <Button onClick={handleAddTask} className="cursor-pointer font-bold">{t("tasks.form.btnSave")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg">
              <Edit className="h-5 w-5 text-primary" />
              {t("tasks.form.titleEdit")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-task-title" className="font-semibold">{t("tasks.form.fieldTitle")}</Label>
              <Input
                id="edit-task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("tasks.form.placeholderTitle")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-task-photographer" className="font-semibold">{t("tasks.form.fieldPhoto")}</Label>
              <Input
                id="edit-task-photographer"
                value={form.photographer}
                onChange={(e) => setForm({ ...form, photographer: e.target.value })}
                placeholder={t("tasks.form.placeholderPhoto")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-task-type" className="font-semibold">{t("tasks.form.fieldType")}</Label>
              <select
                id="edit-task-type"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer"
                value={form.taskType}
                onChange={(e) => setForm({ ...form, taskType: e.target.value })}
              >
                <option value="非重大">{t("tasks.form.optionMinor")}</option>
                <option value="重大">{t("tasks.form.optionMajor")}</option>
                <option value="自定义">{t("tasks.form.optionCustom")}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-task-date" className="font-semibold">{t("tasks.form.fieldDate")}</Label>
                <Input
                  id="edit-task-date"
                  type="date"
                  value={form.taskDate}
                  onChange={(e) => setForm({ ...form, taskDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-semibold">{form.taskType === "自定义" ? t("tasks.form.fieldFeeTotal") : t("tasks.form.fieldFeeIndividual")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">¥</span>
                  {form.taskType === "自定义" ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-7 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                      value={form.fee}
                      onChange={(e) => setForm({ ...form, fee: Number(e.target.value) || 0 })}
                    />
                  ) : (
                    <div className="flex h-9 items-center rounded-md border bg-muted/40 pl-7 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {form.fee.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {form.taskType === "自定义" && currentNames.length > 0 && (
              <div className="grid gap-2 p-3 bg-muted/30 border rounded-md">
                <div className="flex items-center justify-between border-b pb-1.5 mb-1">
                  <Label className="text-xs font-bold text-muted-foreground">{t("tasks.form.splitTitle")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] cursor-pointer font-semibold"
                    onClick={() => {
                      const equal = Math.round(100 / currentNames.length);
                      const next: Record<string, number> = {};
                      let sum = 0;
                      currentNames.forEach((name, idx) => {
                        if (idx === currentNames.length - 1) {
                          next[name] = 100 - sum;
                        } else {
                          next[name] = equal;
                          sum += equal;
                        }
                      });
                      setCustomPercentages(next);
                    }}
                  >
                    {t("tasks.form.btnEquallySplit")}
                  </Button>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {currentNames.map((name) => {
                    const percentage = customPercentages[name] || 0;
                    const calculated = Number((form.fee * (percentage / 100)).toFixed(2));
                    return (
                      <div key={name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold truncate max-w-[120px]">{name}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="relative w-20">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="h-7 pr-4 text-right text-xs py-0 pl-1 font-semibold"
                              value={percentage}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                setCustomPercentages(prev => ({ ...prev, [name]: val }));
                              }}
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                          </div>
                          <span className="text-muted-foreground w-16 text-right font-semibold">
                            ¥{calculated.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between border-t pt-1.5 mt-1 text-[10px]">
                  <span className="text-muted-foreground font-semibold">{t("tasks.form.splitTotal")}</span>
                  <span className={`font-extrabold ${
                    Object.values(customPercentages).reduce((a, b) => a + b, 0) === 100 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-rose-500 font-black"
                  }`}>
                    {Object.values(customPercentages).reduce((a, b) => a + b, 0)}% / 100%
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" className="font-semibold" onClick={() => setIsEditDialogOpen(false)}>{t("tasks.form.btnCancel")}</Button>
            <Button onClick={handleEditTask} className="cursor-pointer font-bold">{t("tasks.form.btnSave")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
