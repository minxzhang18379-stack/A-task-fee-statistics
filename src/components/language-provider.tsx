import { createContext, useContext, useState } from "react";

export type Language = "zh" | "en";

type LanguageProviderProps = {
  children: React.ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
};

type LanguageProviderState = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, variables?: Record<string, string | number>) => string;
};

// Comprehensive Bilingual Translation Table
const translations: Record<Language, Record<string, any>> = {
  zh: {
    nav: {
      dashboard: "总览",
      tasks: "任务与稿费",
      stats: "数据统计",
      settings: "设置",
      logo_title: "PANN Task Manager"
    },
    dashboard: {
      title: "总览",
      subtitle: "本地 SQLite 数据库任务登记、分月归类与稿费发放统计中心",
      filterLabel: "切换统计月份:",
      allMonths: "全部月份 (累计)",
      exportBtn: "导出 Excel",
      cards: {
        registeredTasks: "登记任务数",
        payoutBudget: "月度稿费预算",
        activePhotographers: "活跃拍摄人",
        taskTypes: "涉及任务类别",
        descTasksAll: "本地已登记任务总数",
        descTasksMonth: "{month}任务数",
        descFeesAll: "累计稿费支出总计",
        descFeesMonth: "{month}稿费总额",
        descPhotosAll: "摄影师总人数",
        descPhotosMonth: "{month}活跃拍摄人数",
        descTypesAll: "已分类任务类型",
        descTypesMonth: "{month}任务类型数",
        unitTasks: "个",
        unitPhotos: "位",
        unitTypes: "种"
      },
      table: {
        title: "分月归类统计表",
        month: "月份",
        taskCount: "任务量",
        feeSum: "稿费总计",
        noData: "暂无分月统计，请录入任务。"
      },
      chart: {
        allTypesTitle: "全部类型占比分布",
        monthTypesTitle: "{month} 类型占比",
        noData: "当前筛选月份暂无任务类型数据，请在“任务与稿费”页面添加任务"
      }
    },
    tasks: {
      title: "任务与稿费管理",
      subtitle: "本地数据库一键登记、管理与统计您的任务及稿费明细",
      syncBadge: "已同步 {count} 条记录",
      importExcel: "导入 Excel",
      importTxt: "导入 TXT",
      addTask: "新增任务",
      batchPanel: {
        title: "已选择 {count} 项任务（批量编辑面板）",
        btnDelete: "批量删除选定项",
        labelType: "1. 批量修改任务类型",
        labelDate: "2. 批量修改任务日期",
        labelPhoto: "3. 批量修改拍摄人",
        btnUpdate: "修改",
        btnCancel: "取消全部选择",
        placeholderPhoto: "拍摄人姓名，多人隔开",
        optionMajor: "重大 (总稿费 120元)",
        optionMinor: "非重大 (总稿费 50元)",
        targetDatePlaceholder: "请先选择要批量修改的目标日期",
        targetPhotoPlaceholder: "请先输入要批量修改的目标拍摄人姓名",
        confirmDelete: "警告！此操作不可逆。\n确定要批量删除这 {count} 项选中的任务记录吗？",
        successType: "成功将 {count} 项任务类型批量修改为「{type}」，稿费已按规则均分重新计算！",
        successDate: "成功将 {count} 项任务日期批量修改为「{date}」！",
        successPhoto: "成功将 {count} 项任务拍摄人批量修改为「{photo}」，稿费已人均重算！",
        successDelete: "成功批量删除 {count} 项任务记录！"
      },
      filters: {
        searchPlaceholder: "搜索任务名称、拍摄人...",
        monthLabel: "按月份归类:",
        allMonths: "全部月份 (显示全部)"
      },
      table: {
        select: "选择",
        id: "ID",
        taskName: "任务名称",
        photographer: "拍摄人",
        taskType: "任务类型",
        taskDate: "任务日期",
        fee: "稿费 (¥)",
        actions: "操作",
        btnEdit: "编辑",
        btnDelete: "删除",
        confirmDeleteOne: "确定要删除这项记录吗？",
        noData: "没有找到当前月份的任务记录，点击右上角「新增任务」或「批量导入」添加",
        majorBadge: "重大",
        minorBadge: "非重大",
        customBadge: "自定义",
        uncategorized: "未分类"
      },
      form: {
        titleAdd: "新增任务",
        titleEdit: "编辑任务",
        fieldTitle: "任务名称 *",
        placeholderTitle: "请输入任务名称",
        fieldPhoto: "拍摄人 *",
        placeholderPhoto: "请输入拍摄人姓名，多人用逗号或斜杠隔开",
        fieldType: "任务类型 *",
        optionMinor: "非重大 (总稿费 50元/均分)",
        optionMajor: "重大 (总稿费 120元/均分)",
        optionCustom: "自定义稿费 (手动配置比例)",
        fieldDate: "任务日期 *",
        fieldFeeTotal: "总稿费金额 (¥) *",
        fieldFeeIndividual: "人均分配稿费 (¥)",
        splitTitle: "拍摄人稿费比例分配 (%)",
        btnEquallySplit: "一键均分比例",
        splitTotal: "比例总计:",
        placeholderRequire: "请填写所有必填字段（带有 * 号的项）",
        splitError: "比例分配错误！\n所有拍摄人员的分配比例 (%) 之和必须精确等于 100%（当前总计为 {sum}%），请调整后再保存。",
        saveFail: "保存失败，错误信息: ",
        editFail: "修改失败，错误信息: ",
        btnCancel: "取消",
        btnSave: "保存"
      },
      loading: "加载任务数据中..."
    },
    stats: {
      title: "数据统计中心",
      subtitle: "深度汇总个人稿费、分月任务总览、自然周分组统计与周报表极速导出",
      tabPhotographer: "每人月度稿费统计",
      tabMonth: "每月任务统计",
      tabWeek: "每周任务统计",
      dropdownMonth: "选择统计月份:",
      dropdownAllMonths: "全部月份 (累计统计)",
      cards: {
        activePhotographers: "参与摄影师",
        activeDesc: "当前月份参与拍摄总人数",
        activeDescAll: "累计参与拍摄总人数",
        totalPayout: "稿费支出总计",
        payoutDesc: "当前月份累计计发稿费",
        payoutDescAll: "历史累计计发稿费",
        topEarner: "最高稿费获得者",
        topDesc: "当前月份收入最高摄影师",
        topDescAll: "历史总收入最高摄影师",
        unitPhotos: "位",
        noData: "暂无"
      },
      tablePhotographer: {
        rank: "排名",
        name: "摄影师姓名",
        taskCount: "参与任务数",
        totalFee: "应得稿费总额",
        exportBtn: "导出 {month} 个人账单",
        exportAllBtn: "导出累计个人账单",
        noData: "当前筛选月份暂无个人稿费统计，请录入任务。"
      },
      tableMonth: {
        month: "月份",
        taskCount: "任务量 (个)",
        feeSum: "计发稿费总额",
        exportBtn: "导出 Excel",
        noData: "暂无分月统计，请录入任务。"
      },
      tableWeek: {
        weekRange: "周区间",
        weekRangeFull: "{start} 至 {end}",
        taskCount: "任务数量",
        totalFees: "计发稿费总额",
        exportBtn: "导出该周报表",
        noData: "暂无周分组统计，请录入任务。",
        detailTitle: "该周任务明细表",
        detailId: "ID",
        detailName: "任务名称",
        detailPhoto: "拍摄人员",
        detailType: "任务类型",
        detailDate: "任务日期",
        detailFee: "分配稿费"
      }
    },
    settings: {
      title: "系统设置",
      subtitle: "管理系统主题、数据库连接、自定义报表模板与清空数据选项",
      cardAbout: {
        author: "作者：张铭轩",
        version: "版本：v0.8.0 (Desktop Native)",
        versionCurrent: "版本：v1.0.1 (Desktop Native)",
        updateDate: "更新日期：2026年05月25日",
        statusOk: "系统运行状态良好"
      },
      cardHelp: {
        title: "使用帮助",
        text: "如果您需要快速入门或批量导入规范，请查看位于根目录下的使用说明手册。如有问题或数据库异常，请联系张铭轩处理。"
      },
      cardLanguage: {
        title: "语言设置 (Language)",
        desc: "切换系统的用户界面语言 / Switch user interface language",
        btnZh: "简体中文 (Chinese)",
        btnEn: "English"
      },
      cardTheme: {
        title: "界面显示主题",
        desc: "自由切换系统外观配色模式，自适应极光渐变漫反射背景",
        themeLight: "浅色模式",
        themeDark: "深色模式",
        themeSystem: "跟随系统"
      },
      cardDb: {
        title: "本地 SQLite 数据库",
        desc: "查看数据库连接状态并提供数据清空防线（高危操作）",
        status: "数据库状态:",
        btnClear: "一键清空 TaskRecord 数据",
        confirmTitle: "高危操作确认！",
        confirmDesc: "您确定要彻底清空本地 SQLite 数据库中的所有任务与稿费登记流水吗？此操作不可逆，原有的所有数据都将被彻底清除！",
        btnCancel: "放弃清空",
        btnConfirm: "我已悉知，确定清空",
        alertSuccess: "数据库已清空成功！",
        alertFail: "清空数据库失败: ",
        dbCleared: "数据已清空 (Database Wiped)"
      },
      cardTemplate: {
        title: "Excel 导出自定义模板配置",
        desc: "自定义批量导出汇总大表时的文件结构布局与主副标题文字",
        labelStyle: "报表样式布局模板",
        styleClassic: "经典扁平纯数据网格 (Classic Grid)",
        styleEmbedded: "行政级主标题融合版 (Premium Integrated)",
        labelTitle: "报表主标题文字",
        placeholderTitle: "请输入报表第一行大标题文字",
        labelFilename: "导出文件命名模板",
        placeholderFilename: "请输入文件默认前缀名"
      }
    }
  },
  en: {
    nav: {
      dashboard: "Overview",
      tasks: "Tasks & Fees",
      stats: "Statistics",
      settings: "Settings",
      logo_title: "PANN Task Manager"
    },
    dashboard: {
      title: "Overview",
      subtitle: "Local SQLite database task registration, monthly grouping and fee payout center",
      filterLabel: "Filter Month:",
      allMonths: "All Months (Cumulative)",
      exportBtn: "Export Excel",
      cards: {
        registeredTasks: "Registered Tasks",
        payoutBudget: "Payouts Budget",
        activePhotographers: "Active Crew",
        taskTypes: "Task Types Involved",
        descTasksAll: "Total tasks registered locally",
        descTasksMonth: "{month} Tasks",
        descFeesAll: "Total historic payout expenditures",
        descFeesMonth: "{month} Total payouts",
        descPhotosAll: "Total active photographers",
        descPhotosMonth: "{month} Active photographers",
        descTypesAll: "Classified task types",
        descTypesMonth: "{month} Task types",
        unitTasks: "pcs",
        unitPhotos: "crew",
        unitTypes: "types"
      },
      table: {
        title: "Monthly Breakdown",
        month: "Month",
        taskCount: "Tasks",
        feeSum: "Total Fees",
        noData: "No monthly breakdown. Please add task records."
      },
      chart: {
        allTypesTitle: "All Types Distribution",
        monthTypesTitle: "{month} Distribution",
        noData: "No task type data for current month. Please add tasks in 'Tasks & Fees'."
      }
    },
    tasks: {
      title: "Tasks & Payouts",
      subtitle: "One-click registration, management, and analysis of your tasks and fees details",
      syncBadge: "Synced {count} records",
      importExcel: "Import Excel",
      importTxt: "Import TXT",
      addTask: "Add Task",
      batchPanel: {
        title: "Selected {count} tasks (Batch Actions)",
        btnDelete: "Delete Selected",
        labelType: "1. Batch Update Task Type",
        labelDate: "2. Batch Update Task Date",
        labelPhoto: "3. Batch Update Photographers",
        btnUpdate: "Update",
        btnCancel: "Cancel Selection",
        placeholderPhoto: "Photographer names separated by comma/slashes",
        optionMajor: "Major (120¥ Total)",
        optionMinor: "Minor (50¥ Total)",
        targetDatePlaceholder: "Please select a target date first",
        targetPhotoPlaceholder: "Please input a photographer name first",
        confirmDelete: "Warning! This action is IRREVERSIBLE.\nAre you sure you want to delete these {count} selected tasks?",
        successType: "Successfully updated {count} task types to '{type}', payouts recalculated!",
        successDate: "Successfully updated {count} task dates to '{date}'!",
        successPhoto: "Successfully updated {count} photographers to '{photo}', payouts split recalculated!",
        successDelete: "Successfully deleted {count} tasks!"
      },
      filters: {
        searchPlaceholder: "Search task name, photographers...",
        monthLabel: "Filter Month:",
        allMonths: "All Months (Display All)"
      },
      table: {
        select: "Select",
        id: "ID",
        taskName: "Task Name",
        photographer: "Photographers",
        taskType: "Task Type",
        taskDate: "Task Date",
        fee: "Payout (¥)",
        actions: "Actions",
        btnEdit: "Edit",
        btnDelete: "Delete",
        confirmDeleteOne: "Are you sure you want to delete this record?",
        noData: "No task records found for current month. Click 'Add Task' or 'Import' above.",
        majorBadge: "Major",
        minorBadge: "Minor",
        customBadge: "Custom",
        uncategorized: "Unclassified"
      },
      form: {
        titleAdd: "Add New Task",
        titleEdit: "Edit Task",
        fieldTitle: "Task Name *",
        placeholderTitle: "Enter task name",
        fieldPhoto: "Photographers *",
        placeholderPhoto: "Enter names, separated by commas or slashes",
        fieldType: "Task Type *",
        optionMinor: "Minor (50¥ Total / Split Equally)",
        optionMajor: "Major (120¥ Total / Split Equally)",
        optionCustom: "Custom Payout (Manual Allocation)",
        fieldDate: "Task Date *",
        fieldFeeTotal: "Total Payout (¥) *",
        fieldFeeIndividual: "Per Person Payout (¥)",
        splitTitle: "Photographer Payout Allocation (%)",
        btnEquallySplit: "Auto Share Equally",
        splitTotal: "Total Percentage:",
        placeholderRequire: "Please fill in all required fields (marked with *)",
        splitError: "Allocation Error!\nThe sum of all allocation percentages must be exactly 100% (currently {sum}%). Please adjust before saving.",
        saveFail: "Save failed, error details: ",
        editFail: "Edit failed, error details: ",
        btnCancel: "Cancel",
        btnSave: "Save"
      },
      loading: "Loading tasks data..."
    },
    stats: {
      title: "Statistics Center",
      subtitle: "In-depth summary of photographer payouts, monthly task breakdown, weekly grouping, and weekly report exports",
      tabPhotographer: "Monthly Photographers Payouts",
      tabMonth: "Monthly Tasks Volume",
      tabWeek: "Weekly Tasks Grouping",
      dropdownMonth: "Select Month:",
      dropdownAllMonths: "All Months (Cumulative)",
      cards: {
        activePhotographers: "Active Photographers",
        activeDesc: "Total crew active this month",
        activeDescAll: "Total historic crew in database",
        totalPayout: "Total Scheduled Payouts",
        payoutDesc: "Total payouts scheduled this month",
        payoutDescAll: "Total historic payouts scheduled",
        topEarner: "Top Paid Photographer",
        topDesc: "Highest paid photographer this month",
        topDescAll: "Historically highest paid photographer",
        unitPhotos: "crew",
        noData: "N/A"
      },
      tablePhotographer: {
        rank: "Rank",
        name: "Photographer Name",
        taskCount: "Tasks Joined",
        totalFee: "Earned Fee Total",
        exportBtn: "Export {month} Invoice",
        exportAllBtn: "Export Historic Invoice",
        noData: "No photographer data for selected month. Please add tasks."
      },
      tableMonth: {
        month: "Month",
        taskCount: "Tasks (pcs)",
        feeSum: "Total Fees (¥)",
        exportBtn: "Export Excel",
        noData: "No monthly breakdown data. Please log tasks."
      },
      tableWeek: {
        weekRange: "Week Range",
        weekRangeFull: "{start} to {end}",
        taskCount: "Tasks Count",
        totalFees: "Total Fees Payout",
        exportBtn: "Export Weekly Report",
        noData: "No weekly grouped statistics. Please log tasks.",
        detailTitle: "Weekly Tasks Detail",
        detailId: "ID",
        detailName: "Task Name",
        detailPhoto: "Photographers",
        detailType: "Task Type",
        detailDate: "Task Date",
        detailFee: "Allocated Payout"
      }
    },
    settings: {
      title: "Settings",
      subtitle: "Manage theme modes, database registries, export templates, and clearing data options",
      cardAbout: {
        author: "Author: Zhang Mingxuan",
        version: "Version: v0.8.0 (Desktop Native)",
        versionCurrent: "Version: v1.0.1 (Desktop Native)",
        updateDate: "Updated: 2026-05-25",
        statusOk: "System status: Healthy"
      },
      cardHelp: {
        title: "Help & Manual",
        text: "Please refer to the Instruction Manual in the root directory for quick onboarding or batch Excel/TXT imports. Contact Zhang Mingxuan for technical support."
      },
      cardLanguage: {
        title: "Language Settings",
        desc: "Toggle application user interface language",
        btnZh: "简体中文 (Chinese)",
        btnEn: "English (English)"
      },
      cardTheme: {
        title: "Display Theme Mode",
        desc: "Freely toggle system color schemes, adapting dynamic fluid ambient aurora backgrounds",
        themeLight: "Light Mode",
        themeDark: "Dark Mode",
        themeSystem: "System Theme"
      },
      cardDb: {
        title: "Local SQLite Database",
        desc: "Inspect database connection status and clear TaskRecords data safely",
        status: "Database connection:",
        btnClear: "Permanently Wipe TaskRecords Data",
        confirmTitle: "High Danger Zone!",
        confirmDesc: "Are you sure you want to permanently clear all task and fee records in local SQLite? This action is absolutely IRREVERSIBLE!",
        btnCancel: "Cancel",
        btnConfirm: "Yes, permanently wipe all data",
        alertSuccess: "Database wiped successfully!",
        alertFail: "Failed to wipe database: ",
        dbCleared: "Database wiped (Database Wiped)"
      },
      cardTemplate: {
        title: "Excel Export Custom Configuration",
        desc: "Configure layouts, custom headers, and default file naming for Excel report generation",
        labelStyle: "Report Grid Layout Style",
        styleClassic: "Classic Minimalistic Data Grid",
        styleEmbedded: "Integrated Formal Executive Header",
        labelTitle: "Main Excel Header Title",
        placeholderTitle: "Enter main title header",
        labelFilename: "Default Export Filename",
        placeholderFilename: "Enter default filename prefix"
      }
    }
  }
};

const LanguageContext = createContext<LanguageProviderState | undefined>(undefined);

export function LanguageProvider({
  children,
  defaultLanguage = "zh",
  storageKey = "taskmaster-lang"
}: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(storageKey) as Language) || defaultLanguage
  );

  const t = (path: string, variables?: Record<string, string | number>): string => {
    const keys = path.split(".");
    let value = translations[language];

    for (const key of keys) {
      if (value && value[key] !== undefined) {
        value = value[key];
      } else {
        // Fallback to zh if en key is missing
        let fallbackValue = translations["zh"];
        for (const fKey of keys) {
          if (fallbackValue && fallbackValue[fKey] !== undefined) {
            fallbackValue = fallbackValue[fKey];
          } else {
            return path; // Return original path key if not found
          }
        }
        value = fallbackValue;
        break;
      }
    }

    if (typeof value !== "string") {
      return path;
    }

    // Replace variables (e.g., {count})
    if (variables) {
      let result = value as string;
      Object.entries(variables).forEach(([key, val]) => {
        result = result.replace(new RegExp(`{${key}}`, "g"), String(val));
      });
      return result;
    }

    return value;
  };

  const value: LanguageProviderState = {
    language,
    setLanguage: (lang: Language) => {
      localStorage.setItem(storageKey, lang);
      setLanguage(lang);
    },
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
