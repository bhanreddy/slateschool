import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { FeeTransaction } from '../types/models';
import { printHtmlOnWeb } from './pdfGenerator';

export const PAYMENT_MODES = ['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'online'] as const;

export type PaymentMode = typeof PAYMENT_MODES[number];

export interface CollectionReportMeta {
  schoolName: string;
  accountantName: string;
  dateLabel: string;
  dateIso: string;
  /** When export/print reflects active filters, e.g. "Payment: Cash · Fee: Tuition" */
  filterNote?: string;
}

export interface CollectionTotals {
  count: number;
  grandTotal: number;
  byMode: Record<string, { count: number; total: number }>;
}

export function formatPaymentMethod(method?: string | null): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    cheque: 'Cheque',
    bank_transfer: 'Bank transfer',
    online: 'Online',
  };
  const key = String(method ?? '').toLowerCase();
  return map[key] ?? (method ? String(method) : '—');
}

export function formatClassSection(className?: string | null, sectionName?: string | null): string {
  const parts = [className, sectionName].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatAmount(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function computeCollectionTotals(rows: FeeTransaction[]): CollectionTotals {
  const byMode: Record<string, { count: number; total: number }> = {};
  for (const mode of PAYMENT_MODES) {
    byMode[mode] = { count: 0, total: 0 };
  }

  let grandTotal = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    grandTotal += amount;
    const key = String(row.payment_method ?? '').toLowerCase() || 'other';
    if (!byMode[key]) byMode[key] = { count: 0, total: 0 };
    byMode[key].count += 1;
    byMode[key].total += amount;
  }

  return { count: rows.length, grandTotal, byMode };
}

function escapeCsv(value: string): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value?: string | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fileSafe(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'accountant'
  );
}

export function getCollectionCsvFileName(meta: CollectionReportMeta): string {
  return `collection_${fileSafe(meta.accountantName)}_${meta.dateIso}.csv`;
}

export function buildCollectionCsv(rows: FeeTransaction[], meta: CollectionReportMeta): string {
  const totals = computeCollectionTotals(rows);
  const lines: string[] = [
    escapeCsv(meta.schoolName),
    `Accountant,${escapeCsv(meta.accountantName)}`,
    `Date,${escapeCsv(meta.dateLabel)}`,
    ...(meta.filterNote ? [`Filters,${escapeCsv(meta.filterNote)}`] : []),
    '',
    [
      'Fee type',
      'Collection mode',
      'Student name',
      'Father name',
      'Admission no',
      'Class · Section',
      'Time',
      'Amount',
    ].map(escapeCsv).join(','),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.fee_type ?? '—',
        formatPaymentMethod(row.payment_method),
        row.student_name ?? '—',
        row.father_name ?? '—',
        row.admission_no ?? '—',
        formatClassSection(row.class_name, row.section_name),
        formatTime(row.paid_at),
        Number(row.amount || 0).toFixed(2),
      ].map(escapeCsv).join(','),
    );
  }

  lines.push('');
  lines.push(`Grand total,,,,,,,${totals.grandTotal.toFixed(2)}`);
  for (const mode of PAYMENT_MODES) {
    const bucket = totals.byMode[mode];
    if (!bucket || bucket.count === 0) continue;
    lines.push(`${formatPaymentMethod(mode)} subtotal,,,,,,${bucket.count} txn,${bucket.total.toFixed(2)}`);
  }

  return lines.join('\n');
}

async function shareCsvWeb(csv: string, fileName: string): Promise<void> {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function shareCsvNative(csv: string, fileName: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      dialogTitle: 'Export collection report',
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
    return;
  }
  throw new Error('Sharing is not available on this device.');
}

export async function exportCollectionCsv(rows: FeeTransaction[], meta: CollectionReportMeta): Promise<string> {
  const csv = buildCollectionCsv(rows, meta);
  const fileName = getCollectionCsvFileName(meta);
  if (Platform.OS === 'web') {
    await shareCsvWeb(csv, fileName);
  } else {
    await shareCsvNative(csv, fileName);
  }
  return fileName;
}

function buildCollectionHtml(rows: FeeTransaction[], meta: CollectionReportMeta): string {
  const totals = computeCollectionTotals(rows);
  const modeSummary = PAYMENT_MODES
    .map((mode) => {
      const bucket = totals.byMode[mode];
      if (!bucket || bucket.count === 0) return '';
      return `<tr><td>${escapeHtml(formatPaymentMethod(mode))}</td><td class="num">${bucket.count}</td><td class="num">${escapeHtml(formatAmount(bucket.total))}</td></tr>`;
    })
    .filter(Boolean)
    .join('');

  const tableRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.fee_type ?? '—')}</td>
        <td>${escapeHtml(formatPaymentMethod(row.payment_method))}</td>
        <td>${escapeHtml(row.student_name ?? '—')}</td>
        <td>${escapeHtml(row.father_name ?? '—')}</td>
        <td>${escapeHtml(row.admission_no ?? '—')}</td>
        <td>${escapeHtml(formatClassSection(row.class_name, row.section_name))}</td>
        <td>${escapeHtml(formatTime(row.paid_at))}</td>
        <td class="num">${escapeHtml(formatAmount(Number(row.amount || 0)))}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Today's Collection</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; margin: 0; padding: 24px; background: #fff; }
    .sheet { max-width: 980px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1E293B; padding-bottom: 12px; }
    .school { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
    .title { font-size: 16px; font-weight: 700; margin-top: 6px; color: #334155; }
    .meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0 20px; }
    .summary-card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; background: #F8FAFC; }
    .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.4px; }
    .summary-value { font-size: 18px; font-weight: 800; margin-top: 4px; color: #0F766E; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #CBD5E1; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #EEF2FF; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 14px; width: 320px; margin-left: auto; }
    .signatures { margin-top: 36px; display: flex; justify-content: space-between; gap: 24px; }
    .sign-box { flex: 1; border-top: 1px solid #94A3B8; padding-top: 8px; font-size: 12px; color: #475569; }
    @media print {
      body { padding: 12px; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="school">${escapeHtml(meta.schoolName)}</div>
      <div class="title">Today's Collection</div>
      <div class="meta">${escapeHtml(meta.accountantName)} · ${escapeHtml(meta.dateLabel)}</div>
      ${meta.filterNote ? `<div class="meta">Filters: ${escapeHtml(meta.filterNote)}</div>` : ''}
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Transactions</div>
        <div class="summary-value">${totals.count}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Grand total</div>
        <div class="summary-value">${escapeHtml(formatAmount(totals.grandTotal))}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Report generated</div>
        <div class="summary-value" style="font-size:13px;color:#334155;">${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Mode summary</th>
          <th class="num">Count</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${modeSummary}</tbody>
    </table>

    <table style="margin-top:16px;">
      <thead>
        <tr>
          <th>Fee type</th>
          <th>Mode</th>
          <th>Student</th>
          <th>Father</th>
          <th>Adm no</th>
          <th>Class · Section</th>
          <th>Time</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="8">No collections recorded today.</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7"><strong>Grand total (${totals.count} transactions)</strong></td>
          <td class="num"><strong>${escapeHtml(formatAmount(totals.grandTotal))}</strong></td>
        </tr>
      </tfoot>
    </table>

    <div class="signatures">
      <div class="sign-box">Collected by ____________________</div>
      <div class="sign-box">Verified by ____________________</div>
    </div>
  </div>
</body>
</html>`;
}

async function printCollectionNative(html: string): Promise<void> {
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: "Print today's collection",
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }
  await Print.printAsync({ uri });
}

export async function printCollectionReport(rows: FeeTransaction[], meta: CollectionReportMeta): Promise<void> {
  const html = buildCollectionHtml(rows, meta);
  if (Platform.OS === 'web') {
    await printHtmlOnWeb(html);
    return;
  }
  await printCollectionNative(html);
}
