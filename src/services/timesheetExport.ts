import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const UK_TIMEZONE = 'Europe/London';

export interface TimesheetRow {
  jobCode: string;
  jobName: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  rate: number;
  earnings: number;
  expenses: number;
  notes: string;
}

export interface ExportOptions {
  workerName: string;
  dateRange: string;
  rangeType: 'weekly' | 'monthly' | 'custom';
  organizationName?: string;
  organizationLogo?: string;
  hourlyRate: number;
}

// Build notes string from entry flags
const buildNotes = (entry: any): string => {
  const notes: string[] = [];
  
  if (entry.auto_clocked_out) {
    notes.push(`Auto Clock-Out${entry.auto_clockout_type ? ` (${entry.auto_clockout_type})` : ''}`);
  }
  
  if (entry.notes?.includes('Time Amendment') || entry.notes?.includes('amendment')) {
    notes.push('Time Amendment');
  }
  
  if (entry.manual_entry) {
    notes.push('Manual Entry');
  }
  
  if (entry.is_overtime) {
    notes.push(`Overtime${entry.ot_status ? ` (${entry.ot_status})` : ''}`);
  }
  
  if (entry.notes && !notes.some(n => entry.notes.includes(n))) {
    notes.push(entry.notes);
  }
  
  return notes.length > 0 ? notes.join(', ') : '—';
};

// Calculate total expenses for an entry
const calculateExpenses = (additionalCosts: any[]): number => {
  if (!additionalCosts || !Array.isArray(additionalCosts)) return 0;
  return additionalCosts.reduce((sum, cost) => sum + parseFloat(cost.amount || 0), 0);
};

// Generate consistent filename
const generateFilename = (
  workerName: string,
  dateRange: any,
  extension: string
): string => {
  const safeName = workerName.replace(/[^a-zA-Z0-9]/g, '_');
  const startDate = format(dateRange.start, 'yyyy-MM-dd');
  const endDate = format(dateRange.end, 'yyyy-MM-dd');
  return `timesheet_${safeName}_${startDate}_to_${endDate}.${extension}`;
};

// Excel Export
export const generateExcelExport = (
  entries: any[],
  dateRange: any,
  options: ExportOptions
) => {
  // Prepare data rows
  const rows = entries.map(entry => ({
    'Job Site Code': entry.jobs?.code || 'N/A',
    'Job Name': entry.jobs?.name || 'Unknown',
    'Clock In': entry.clock_in ? formatInTimeZone(new Date(entry.clock_in), UK_TIMEZONE, 'dd/MM/yyyy HH:mm') : '',
    'Clock Out': entry.clock_out 
      ? formatInTimeZone(new Date(entry.clock_out), UK_TIMEZONE, 'dd/MM/yyyy HH:mm')
      : 'In Progress',
    'Total Hours': entry.total_hours?.toFixed(2) || '0.00',
    'Rate (£)': options.hourlyRate.toFixed(2),
    'Earnings (£)': ((entry.total_hours || 0) * options.hourlyRate).toFixed(2),
    'Expenses (£)': calculateExpenses(entry.additional_costs).toFixed(2),
    'Notes': buildNotes(entry)
  }));

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
  const totalEarnings = totalHours * options.hourlyRate;
  const totalExpenses = entries.reduce((sum, e) => 
    sum + calculateExpenses(e.additional_costs), 0);

  // Add totals row
  rows.push({
    'Job Site Code': '',
    'Job Name': 'TOTAL',
    'Clock In': '',
    'Clock Out': '',
    'Total Hours': totalHours.toFixed(2),
    'Rate (£)': '',
    'Earnings (£)': totalEarnings.toFixed(2),
    'Expenses (£)': totalExpenses.toFixed(2),
    'Notes': ''
  });

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(rows);

  // Add header info
  XLSX.utils.sheet_add_aoa(ws, [
    [`Timesheet Export - ${options.workerName}`],
    [`Date Range: ${options.dateRange} (${options.rangeType})`],
    [`Organization: ${options.organizationName || 'N/A'}`],
    [] // Empty row
  ], { origin: 'A1' });

  // Adjust row positions for header
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  range.s.r = 0; // Start from row 0
  ws['!ref'] = XLSX.utils.encode_range(range);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');

  // Generate filename and download
  const filename = generateFilename(options.workerName, dateRange, 'xlsx');
  XLSX.writeFile(wb, filename);
};

// PDF Export
export const generatePDFExport = async (
  entries: any[],
  dateRange: any,
  options: ExportOptions
) => {
  const doc = new jsPDF();

  // Title and header
  doc.setFontSize(18);
  doc.text('Timesheet Report', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Worker: ${options.workerName}`, 14, 30);
  doc.text(`Date Range: ${options.dateRange} (${options.rangeType})`, 14, 36);
  doc.text(`Organization: ${options.organizationName || 'N/A'}`, 14, 42);

  // Prepare table data
  const tableData = entries.map(entry => [
    entry.jobs?.code || 'N/A',
    entry.jobs?.name || 'Unknown',
    entry.clock_in ? formatInTimeZone(new Date(entry.clock_in), UK_TIMEZONE, 'dd/MM HH:mm') : '',
    entry.clock_out 
      ? formatInTimeZone(new Date(entry.clock_out), UK_TIMEZONE, 'dd/MM HH:mm')
      : 'In Progress',
    (entry.total_hours || 0).toFixed(2),
    `£${options.hourlyRate.toFixed(2)}`,
    `£${((entry.total_hours || 0) * options.hourlyRate).toFixed(2)}`,
    `£${calculateExpenses(entry.additional_costs).toFixed(2)}`,
    buildNotes(entry)
  ]);

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
  const totalEarnings = totalHours * options.hourlyRate;
  const totalExpenses = entries.reduce((sum, e) => 
    sum + calculateExpenses(e.additional_costs), 0);

  // Add table
  autoTable(doc, {
    head: [['Code', 'Job', 'Clock In', 'Clock Out', 'Hours', 'Rate', 'Earnings', 'Expenses', 'Notes']],
    body: tableData,
    startY: 50,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [52, 73, 94], textColor: 255 },
    foot: [[
      '', 'TOTAL', '', '', 
      totalHours.toFixed(2), '', 
      `£${totalEarnings.toFixed(2)}`,
      `£${totalExpenses.toFixed(2)}`,
      ''
    ]],
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    }
  });

  // Generate filename and save
  const filename = generateFilename(options.workerName, dateRange, 'pdf');
  doc.save(filename);
};
