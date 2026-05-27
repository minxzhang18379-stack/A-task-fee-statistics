import ExcelJS from 'exceljs';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { sendNotification as tauriSendNotification } from '@tauri-apps/plugin-notification';
import { getTasks, addTask, isTauri } from './db';
import { calculateFee, getPhotographerShares } from '../pages/tasks';

// Browser-compatible file selection and loading helper
function selectAndReadFile(accept: string, readAsText = false): Promise<{ name: string; data: Uint8Array | string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (readAsText) {
          resolve({ name: file.name, data: reader.result as string });
        } else {
          resolve({ name: file.name, data: new Uint8Array(reader.result as ArrayBuffer) });
        }
      };
      reader.onerror = () => resolve(null);
      if (readAsText) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    };
    input.click();
  });
}

// Unified cross-platform notification helper
function sendNotification(options: { title: string; body: string }) {
  if (isTauri) {
    tauriSendNotification(options);
  } else {
    console.log(`[Notification] ${options.title}: ${options.body}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body });
    }
  }
}

// --- Helper to parse and format various date formats into standard YYYY-MM-DD ---
export function parseAndFormatDate(dateVal: any): string {
  if (!dateVal) {
    return new Date().toISOString().split('T')[0];
  }
  
  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) {
      return dateVal.toISOString().split('T')[0];
    }
  }

  // Convert to number if it's a numeric value or numeric string representing an Excel serial date (> 1000)
  // Float numbers like 4.10, 4.1, 4.16 representing dates are <= 1000 and should NOT be treated as serial dates!
  const numVal = typeof dateVal === 'number' ? dateVal : Number(dateVal);
  if (!isNaN(numVal) && numVal > 1000) {
    // Excel serial date number
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numVal * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const dateStr = String(dateVal).trim();
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }

  // 1. Check for YYYY-MM-DD or YYYY-M-D or YYYY.M.D or YYYY/M/D
  const fullMatch = dateStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (fullMatch) {
    const y = fullMatch[1];
    const m = fullMatch[2].padStart(2, '0');
    const d = fullMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Check for MM-DD or M-D or M.D or M/D (without year)
  const shortMatch = dateStr.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (shortMatch) {
    const y = new Date().getFullYear();
    const m = shortMatch[1].padStart(2, '0');
    const d = shortMatch[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. Fallback to standard JS parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return dateStr;
}

// --- Safe Excel Export (Splits multi-photographer tasks into separate rows) ---
export async function exportToExcel(specificTasks?: any[], filenamePrefix = "稿费统计汇总表") {
  try {
    const exportMode = localStorage.getItem("export_mode") || "embedded";
    const exportTitle = localStorage.getItem("export_title") || "新闻嗅觉图片社任务汇总";
    const defaultFilename = localStorage.getItem("export_filename") || filenamePrefix;

    const workbook = new ExcelJS.Workbook();
    let worksheet: ExcelJS.Worksheet | undefined;
    let startRow = 2;

    if (exportMode === "embedded") {
      // 1. Generate premium structured Excel sheet programmatically in memory
      worksheet = workbook.addWorksheet("稿费明细汇总");
      
      // Set precise column widths
      worksheet.columns = [
        { header: "日期", key: "taskDate", width: 15 },
        { header: "任务名称", key: "title", width: 35 },
        { header: "拍摄人员", key: "photographer", width: 25 },
        { header: "个人平均", key: "fee", width: 15 },
        { header: "任务总计", key: "totalFee", width: 15 },
        { header: "备注", key: "remark", width: 20 }
      ];

      // Row 1: Merged Main Title
      worksheet.insertRow(1, [exportTitle]);
      worksheet.mergeCells("A1:F1");
      
      const titleRow = worksheet.getRow(1);
      titleRow.height = 42;
      
      const titleCell = titleRow.getCell(1);
      titleCell.font = {
        name: "Microsoft YaHei",
        size: 16,
        bold: true,
        color: { argb: "FFFFFFFF" }
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D5A27" } // Premium deep green matching your color palette
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      // Row 2: Header Columns Row
      const headerRow = worksheet.getRow(2);
      headerRow.height = 28;
      
      // Explicitly set text headers
      headerRow.getCell(1).value = "日期";
      headerRow.getCell(2).value = "任务名称";
      headerRow.getCell(3).value = "拍摄人员";
      headerRow.getCell(4).value = "个人平均";
      headerRow.getCell(5).value = "任务总计";
      headerRow.getCell(6).value = "备注";

      for (let c = 1; c <= 6; c++) {
        const cell = headerRow.getCell(c);
        cell.font = {
          name: "Microsoft YaHei",
          size: 11,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF3D6B37" } // Olive green
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCCCCCC" } },
          left: { style: "thin", color: { argb: "FFCCCCCC" } },
          bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
          right: { style: "thin", color: { argb: "FFCCCCCC" } }
        };
      }

      startRow = 3;
    } else {
      // 2. Original External Template Loading Method (fully backward compatible)
      let fileData: Uint8Array;
      if (isTauri) {
        const templatePath = await open({
          title: '选择 Excel 模板文件',
          filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
          directory: false,
          multiple: false,
        });

        if (!templatePath || typeof templatePath !== 'string') return;
        fileData = await readFile(templatePath);
      } else {
        const fileResult = await selectAndReadFile('.xlsx,.xls');
        if (!fileResult) return;
        fileData = fileResult.data as Uint8Array;
      }

      await workbook.xlsx.load(fileData);

      worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('模板中没有工作表');

      // Detect header row by scanning rows 1 to 10
      for (let r = 1; r <= 10; r++) {
        const row = worksheet.getRow(r);
        const cellA = row.getCell(1).value;
        if (cellA && typeof cellA === 'string' && (
          cellA.includes('时间') || cellA.includes('日期') || cellA.includes('序号') || 
          cellA.includes('ID') || cellA.includes('编号') || cellA.includes('任务')
        )) {
          startRow = r + 1;
          break;
        }
      }
    }

    // 4. Get data and sort chronologically by date
    const records = specificTasks ? [...specificTasks] : await getTasks();
    records.sort((a, b) => (a.taskDate || '').localeCompare(b.taskDate || ''));

    // 6. Inject data, splitting multi-photographer tasks into separate rows
    let currentRow = startRow;
    const templateRow = worksheet.getRow(startRow);

    for (const record of records) {
      // Get photographer shares using our master helper
      const shares = getPhotographerShares(record.photographer || '', record.taskType || '', record.fee || 0);
      
      const photographerList = shares.length > 0 ? shares : [{ name: '', fee: 0 }];

      // For each photographer, write a separate row to Excel as per Screenshot 3!
      let isFirstPhotoOfTask = true;
      for (const share of photographerList) {
        const row = worksheet.getRow(currentRow);

        // Apply appropriate styling
        if (exportMode === 'embedded') {
          // High-quality default styles for in-memory embedded template
          for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.font = { name: "Microsoft YaHei", size: 10 };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE0E0E0" } },
              left: { style: "thin", color: { argb: "FFE0E0E0" } },
              bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
              right: { style: "thin", color: { argb: "FFE0E0E0" } }
            };
            
            // Alignment config
            if (c === 1 || c === 3 || c === 4 || c === 5) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }
            
            // Format numeric columns with RMB ¥ currency format
            if (c === 4 || c === 5) {
              cell.numFmt = "¥#,##0.00";
            }
          }
        } else {
          // Copy styles from the loaded template row
          for (let c = 1; c <= 6; c++) {
            const templateCell = templateRow.getCell(c);
            const cell = row.getCell(c);
            if (templateCell.style) {
              cell.style = { ...templateCell.style };
            }
          }
        }

        // Get total task fee
        let totalTaskFee = 0;
        if (record.taskType === '重大') {
          totalTaskFee = 120;
        } else if (record.taskType === '非重大') {
          totalTaskFee = 50;
        } else {
          totalTaskFee = record.fee || 0; // For '自定义', record.fee is the total fee
        }

        // Format dates: e.g. "2026-05-23" -> format to simplified or keep
        row.getCell(1).value = record.taskDate || '';      // 时间 / 日期
        row.getCell(2).value = record.title || '';         // 任务名称
        row.getCell(3).value = share.name;                 // 拍摄人员 (单个拍摄人)
        row.getCell(4).value = share.fee;                  // 个人平均 (人均稿费)
        row.getCell(5).value = isFirstPhotoOfTask ? totalTaskFee : ''; // 任务总计 (总稿费) - ONLY FIRST PHOTO
        row.getCell(6).value = '';                         // 备注/其他空余

        row.commit();
        currentRow++;
        isFirstPhotoOfTask = false;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    if (isTauri) {
      // 7. Choose save location (Tauri)
      const savePath = await save({
        title: '保存报表',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
        defaultPath: `${defaultFilename}.xlsx`,
      });

      if (!savePath) return;

      // 8. Write file (Tauri)
      await writeFile(savePath, new Uint8Array(buffer));

      // 9. Notify
      sendNotification({
        title: '导出成功',
        body: `报表已成功保存`,
      });
    } else {
      // Web browser file download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${defaultFilename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sendNotification({
        title: '导出成功',
        body: `报表已下载到您的本地设备`,
      });
    }
  } catch (error) {
    console.error('Export failed:', error);
    sendNotification({
      title: '导出失败',
      body: error instanceof Error ? error.message : '导出过程中发生未知错误',
    });
    alert("导出失败，错误信息: " + (error instanceof Error ? error.message : String(error)));
  }
}

// --- Dedicated Personal Bill Export (Generates sheet formatted matching "2026年4月图片社稿费.xlsx") ---
export async function exportPersonalBill(tasks: any[], filenamePrefix: string, language: string = "zh") {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("个人账单汇总");

    // Set exact column widths matching Simsun/Microsoft YaHei formatting
    worksheet.columns = [
      { key: "name", width: 15 },
      { key: "fee", width: 18 },
      { key: "workload", width: 85 }
    ];

    // Row 1: Headers
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    
    const h1 = language === "zh" ? "姓名" : "Name";
    const h2 = language === "zh" ? "新闻部稿费" : "News Dept Fee";
    const h3 = language === "zh" ? "工作量" : "Workload";

    headerRow.getCell(1).value = h1;
    headerRow.getCell(2).value = h2;
    headerRow.getCell(3).value = h3;

    // Apply header row styles
    for (let c = 1; c <= 3; c++) {
      const cell = headerRow.getCell(c);
      cell.font = {
        name: "Microsoft YaHei",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" }
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3D6B37" } // Premium olive green matching the main table
      };
      cell.alignment = { 
        horizontal: c === 3 ? "left" : "center", 
        vertical: "middle" 
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } }
      };
    }

    // 1. Aggregate photographer stats
    const photographerMap: Record<string, { name: string; totalFee: number; taskList: { title: string; fee: number; numPeople: number }[] }> = {};
    
    tasks.forEach((t) => {
      // Get shares using tasks getPhotographerShares helper (imported in excelEngine.ts)
      const shares = getPhotographerShares(t.photographer || '', t.taskType || '', t.fee || 0);
      shares.forEach((share) => {
        const name = share.name;
        if (!photographerMap[name]) {
          photographerMap[name] = { name, totalFee: 0, taskList: [] };
        }
        photographerMap[name].totalFee += share.fee;
        photographerMap[name].taskList.push({
          title: t.title,
          fee: share.fee,
          numPeople: shares.length
        });
      });
    });

    // Sort photographers descending by total fee sum
    const photographers = Object.values(photographerMap).sort((a, b) => b.totalFee - a.totalFee);

    // 2. Generate and write photographer rows
    let currentRow = 2;
    for (const photo of photographers) {
      const row = worksheet.getRow(currentRow);
      row.height = 22;

      // Classify and summarize workload
      let meetingCount = 0;
      const detailsMap: Record<string, number> = {};

      photo.taskList.forEach((task) => {
        const title = task.title.trim();
        const fraction = 1 / task.numPeople;

        // Custom prefixes and keywords matching Simsun style
        const keywords = ["策划", "文案", "标题", "封面", "排版", "视频", "图片", "日历图", "大图"];
        let matchedKeyword = "";
        let prefix = "";
        for (const kw of keywords) {
          if (title.includes(kw)) {
            matchedKeyword = kw;
            prefix = title.split(kw)[0].trim();
            break;
          }
        }

        if (matchedKeyword) {
          const key = prefix + matchedKeyword;
          detailsMap[key] = (detailsMap[key] || 0) + fraction;
        } else {
          meetingCount++;
        }
      });

      // Build workload parts
      const parts: string[] = [];
      if (meetingCount > 0) {
        parts.push(`${meetingCount}${language === "zh" ? "次会议拍摄" : " meeting shooting(s)"}`);
      }

      Object.entries(detailsMap).forEach(([key, val]) => {
        // Format fraction elegantly
        let formattedVal = "";
        if (Math.abs(val - 1/3) < 0.05) formattedVal = "1/3";
        else if (Math.abs(val - 2/3) < 0.05) formattedVal = "2/3";
        else if (Math.abs(val - 0.5) < 0.05) formattedVal = "1/2";
        else if (Math.abs(val - 0.25) < 0.05) formattedVal = "1/4";
        else if (Math.abs(val - 0.75) < 0.05) formattedVal = "3/4";
        else if (Number.isInteger(val)) formattedVal = val.toString();
        else formattedVal = val.toFixed(1);

        if (key.endsWith("图片") || key.endsWith("日历图") || key.endsWith("大图")) {
          parts.push(`${formattedVal}${language === "zh" ? "张" : " "}${key}`);
        } else {
          parts.push(`${formattedVal}${key}`);
        }
      });

      const workloadText = parts.join("、");

      // Write values
      row.getCell(1).value = photo.name;
      row.getCell(2).value = photo.totalFee;
      row.getCell(3).value = workloadText || "-";

      // Apply cell styles matching main table exactly
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        cell.font = {
          name: "Microsoft YaHei",
          size: 10
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } }
        };
        cell.alignment = {
          horizontal: c === 3 ? "left" : "center", // center Name and Fee, left-align Workload
          vertical: "middle",
          wrapText: c === 3
        };

        if (c === 2) {
          cell.numFmt = "¥#,##0.00"; // Currency format matching the main table exactly
        }
      }

      row.commit();
      currentRow++;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    if (isTauri) {
      // 3. Select save location (Tauri)
      const savePath = await save({
        title: language === "zh" ? '保存个人账单' : 'Save Personal Bill',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
        defaultPath: `${filenamePrefix}.xlsx`,
      });

      if (!savePath) return;

      // 4. Save Excel (Tauri)
      await writeFile(savePath, new Uint8Array(buffer));

      // 5. Notify success (Tauri)
      sendNotification({
        title: language === "zh" ? '导出成功' : 'Export Succeeded',
        body: language === "zh" ? `个人账单已成功保存` : `Personal bill saved successfully`,
      });
    } else {
      // Web browser file download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenamePrefix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sendNotification({
        title: language === "zh" ? '导出成功' : 'Export Succeeded',
        body: language === "zh" ? `个人账单已下载到您的本地设备` : `Personal bill downloaded to your device`,
      });
    }
  } catch (error) {
    console.error('Export personal bill failed:', error);
    sendNotification({
      title: language === "zh" ? '导出失败' : 'Export Failed',
      body: error instanceof Error ? error.message : 'Unknown error during export',
    });
    alert(
      (language === "zh" ? "导出失败，错误信息: " : "Export failed, error: ") + 
      (error instanceof Error ? error.message : String(error))
    );
  }
}

// --- Batch Import Tasks from Excel (With Smart Header Detection and Auto-Type/Fee calculations) ---
export async function importFromExcel(): Promise<number> {
  try {
    let fileData: Uint8Array;
    if (isTauri) {
      // 1. Select Excel data file to import (Tauri)
      const filePath = await open({
        title: '选择要导入的 Excel 数据文件',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
        directory: false,
        multiple: false,
      });

      if (!filePath || typeof filePath !== 'string') return 0;

      // 2. Read file (Tauri)
      fileData = await readFile(filePath);
    } else {
      const fileResult = await selectAndReadFile('.xlsx,.xls');
      if (!fileResult) return 0;
      fileData = fileResult.data as Uint8Array;
    }

    // 3. Load ExcelJS Workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileData);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('Excel 文件中没有有效的工作表');

    // 4. Smart column detection by scanning rows 1 to 5.
    // Pick the row that has the MAXIMUM matches to avoid merged header block mismatches.
    let bestRowIndex = 2; // Default to row 2
    let maxMatches = -1;
    let colIndices = {
      title: 2,
      photographer: 3,
      taskType: -1,
      taskDate: 1,
      fee: -1,
    };

    for (let r = 1; r <= 5; r++) {
      const row = worksheet.getRow(r);
      let tempIndices = { title: -1, photographer: -1, taskType: -1, taskDate: -1, fee: -1 };
      let matches = 0;
      
      for (let c = 1; c <= 20; c++) {
        const val = row.getCell(c).text?.trim();
        if (!val) continue;

        if (val === '任务名称' || val === '任务' || val === '任务内容' || val === 'Title') {
          tempIndices.title = c;
          matches++;
        } else if (val === '拍摄人' || val === '拍摄人员' || val === '摄影' || val === '摄影师' || val === 'Photographer' || val === 'Camera') {
          tempIndices.photographer = c;
          matches++;
        } else if (val === '任务类型' || val === '类型' || val === '类别' || val === 'Type' || val === 'Category') {
          tempIndices.taskType = c;
          matches++;
        } else if (val === '任务日期' || val === '日期' || val === '时间' || val === 'Date' || val === 'Time') {
          tempIndices.taskDate = c;
          matches++;
        } else if (val === '稿费' || val === '单价' || val === '金额' || val === '费用' || val === 'Fee' || val === 'Price') {
          tempIndices.fee = c;
          matches++;
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIndex = r;
        if (tempIndices.title !== -1) colIndices.title = tempIndices.title;
        if (tempIndices.photographer !== -1) colIndices.photographer = tempIndices.photographer;
        if (tempIndices.taskType !== -1) colIndices.taskType = tempIndices.taskType;
        if (tempIndices.taskDate !== -1) colIndices.taskDate = tempIndices.taskDate;
        if (tempIndices.fee !== -1) colIndices.fee = tempIndices.fee;
      }
    }

    // 5. Parse data rows starting after the header row
    let importCount = 0;
    const totalRows = worksheet.rowCount;

    for (let r = bestRowIndex + 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const title = row.getCell(colIndices.title).text?.trim();
      
      // Skip empty title rows
      if (!title) continue;

      let photographer = row.getCell(colIndices.photographer).text?.trim() || '未知';
      photographer = photographer.replace(/\s*[（\(]修图[）\)]/g, '').trim();
      
      // Smart Auto-detection of taskType: if title contains "重大" ->重大, else -> 非重大
      let taskType = "非重大";
      if (title.includes("重大") || title.includes("（重大）") || title.includes("(重大)")) {
        taskType = "重大";
      } else if (colIndices.taskType !== -1) {
        taskType = row.getCell(colIndices.taskType).text?.trim() || "非重大";
      }

      // Extract taskDate nicely, formatting dots: e.g. "4.1" -> "2026-04-01"
      const rawDateCell = row.getCell(colIndices.taskDate);
      let dateInput: any = rawDateCell.value;
      // Prioritize rawDateCell.text for non-Date cells to preserve trailing zeros (e.g. 4.10 -> "4.10")!
      if (!(rawDateCell.value instanceof Date) && rawDateCell.text) {
        dateInput = rawDateCell.text.trim();
      }
      const taskDate = parseAndFormatDate(dateInput);

      // Smart Auto-calculation of fee based on taskType and split photographers
      let fee = 0;
      if (colIndices.fee !== -1 && row.getCell(colIndices.fee).value !== null) {
        const rawFee = row.getCell(colIndices.fee).value;
        if (typeof rawFee === 'number') {
          fee = rawFee;
        } else {
          fee = parseFloat(row.getCell(colIndices.fee).text) || 0;
        }
      } else {
        // Auto-calculate split fee!
        fee = calculateFee(taskType, photographer);
      }

      // Add to SQLite database
      await addTask({
        title,
        photographer,
        taskType,
        taskDate,
        fee,
      });

      importCount++;
    }

    if (importCount > 0) {
      sendNotification({
        title: '批量导入成功',
        body: `成功导入了 ${importCount} 条任务记录`,
      });
      alert(`导入成功！共自 Excel 导入 ${importCount} 条任务记录。`);
    } else {
      alert("没有在 Excel 文件中解析到有效的任务数据，请核对列名或内容是否为空。");
    }

    return importCount;
  } catch (error) {
    console.error('Import failed:', error);
    alert("导入失败，错误信息: " + (error instanceof Error ? error.message : String(error)));
    return 0;
  }
}

// --- Batch Import Tasks from TXT Files ---
export async function importFromTxt(): Promise<number> {
  try {
    let fileContent = '';
    if (isTauri) {
      // 1. Select TXT file (Tauri)
      const filePath = await open({
        title: '选择要导入的 TXT 数据文件',
        filters: [{ name: '文本文件', extensions: ['txt'] }],
        directory: false,
        multiple: false,
      });

      if (!filePath || typeof filePath !== 'string') return 0;

      // 2. Read file (Tauri)
      const fileData = await readFile(filePath);
      fileContent = new TextDecoder('utf-8').decode(fileData);
    } else {
      const fileResult = await selectAndReadFile('.txt', true);
      if (!fileResult) return 0;
      fileContent = fileResult.data as string;
    }

    // 3. Parse lines
    const lines = fileContent.split(/\r?\n/);
    let importCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Extract date: first word matching M.D or MM.DD e.g. "5.19"
      const dateMatch = line.match(/^(\d{1,2})\.(\d{1,2})/);
      if (!dateMatch) continue; // Skip lines that don't start with a date

      const rawDate = dateMatch[0]; // "5.19"
      const month = dateMatch[1].padStart(2, '0');
      const day = dateMatch[2].padStart(2, '0');
      const year = new Date().getFullYear();
      const taskDate = `${year}-${month}-${day}`;

      // Remove the date from the beginning of the line
      const restLine = line.substring(rawDate.length).trim();

      // Split by "拍摄人员：" or "拍摄人员:"
      const parts = restLine.split(/\s*拍摄人员[：:]\s*/);
      if (parts.length < 2) continue; // Skip if no photographer prefix

      // Strip any location details (e.g. "地点：...") from the task title
      const title = parts[0].split(/\s*地点[：:]\s*/)[0].trim();
      const photoInfo = parts[1].trim();

      // Extract photographer name: everything before any parenthesis
      let photographer = photoInfo.split(/[（\(]/)[0].trim();

      // Strip any trailing phone numbers (digits at the end)
      photographer = photographer.replace(/\s*\d+$/, '').trim();

      // Strip retoucher tags automatically
      photographer = photographer.replace(/\s*[（\(]修图[）\)]/g, '').trim();

      if (!title || !photographer) continue;

      // Auto-detect taskType: if title contains "重大" -> 重大, else -> 非重大
      let taskType = "非重大";
      if (title.includes("重大") || title.includes("（重大）") || title.includes("(重大)")) {
        taskType = "重大";
      }

      // Auto-calculate individual split fee
      const fee = calculateFee(taskType, photographer);

      // Add to SQLite database
      await addTask({
        title,
        photographer,
        taskType,
        taskDate,
        fee,
      });

      importCount++;
    }

    if (importCount > 0) {
      sendNotification({
        title: '批量导入 TXT 成功',
        body: `成功从 TXT 导入了 ${importCount} 条任务记录`,
      });
      alert(`导入成功！共自 TXT 导入 ${importCount} 条任务记录。`);
    } else {
      alert("没有在 TXT 文件中解析到任何排班任务。请确保每一行都符合格式，例如：5.19 任务名称 拍摄人员：姓名（时间）");
    }

    return importCount;
  } catch (error) {
    console.error('Import TXT failed:', error);
    alert("导入失败，错误信息: " + (error instanceof Error ? error.message : String(error)));
    return 0;
  }
}
