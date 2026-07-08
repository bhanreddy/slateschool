import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Invoice } from '../types/invoices';
import { FeeTransaction, Parent, StudentFeeDueLine } from '../types/models';
import { SCHOOL_CONFIG, SCHOOL_RECOGNITION_LINE } from '../constants/schoolConfig';
import { printElementToWindow } from './exportCertificate';

/**
 * expo-print `printToFileAsync` / `printAsync` on web only call `window.print()` on the main
 * document — the receipt HTML is ignored, so the whole app (sidebar, shell) is printed.
 * Load the HTML in a hidden iframe and print that document only.
 */
export function printHtmlOnWeb(fullHtml: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'receipt-print');
    iframe.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;visibility:hidden;',
    );
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      reject(new Error('Could not open print frame'));
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
      resolve();
    };

    const runPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        finish();
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      win.addEventListener('afterprint', finish);
      setTimeout(finish, 4000);
    };

    doc.open();
    doc.write(fullHtml);
    doc.close();
    // Brief delay so layout / @import fonts can start (iframe is isolated)
    setTimeout(runPrint, 450);
  });
}

async function mountReceiptHtmlForCapture(fullHtml: string): Promise<{ element: HTMLElement; cleanup: () => void }> {
  if (typeof document === 'undefined') {
    throw new Error('Receipt export is only available in a browser context.');
  }

  const parsed = new DOMParser().parseFromString(fullHtml, 'text/html');
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:794px',
    'min-height:561px',
    'overflow:visible',
    'background:#ffffff',
    'z-index:-1',
  ].join(';');
  container.innerHTML = `<style>${BASE_CSS}</style>${parsed.body.innerHTML}`;
  document.body.appendChild(container);

  if ('fonts' in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      /* ignore font readiness failures */
    }
  }

  const element = container.querySelector('.page') as HTMLElement | null;
  if (!element) {
    container.remove();
    throw new Error('Receipt preview not found.');
  }

  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    element,
    cleanup: () => {
      try { container.remove(); } catch { /* noop */ }
    },
  };
}

// ─── Logo Loader ───────────────────────────────────────────────────────────────
export const loadLogoAsBase64 = async (imageAsset: any): Promise<string | null> => {
  try {
    // If it's a remote URL already, return as is
    if (typeof imageAsset === 'string' && imageAsset.startsWith('http')) {
      return imageAsset;
    }

    const asset = Asset.fromModule(imageAsset);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) {
      console.warn('Logo: no URI from asset');
      return null;
    }

    console.log('Logo asset URI:', uri);

    if (Platform.OS === 'web') {
      // If already a data URI, use it directly
      if (uri.startsWith('data:')) return uri;

      // Resolve the URI
      const resolvedUri = uri.startsWith('http')
        ? uri
        : `${window.location.origin}${uri.startsWith('/') ? '' : '/'}${uri}`;

      console.log('Logo resolved URI:', resolvedUri);

      // Primary approach: load into Image element → canvas → dataURL
      // This is the most reliable because it handles all URL formats
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const img = new (window as any).Image() as HTMLImageElement;
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { reject(new Error('no canvas context')); return; }
              ctx.drawImage(img, 0, 0);
              const result = canvas.toDataURL('image/png');
              console.log('Logo canvas conversion success, length:', result.length);
              resolve(result);
            } catch (canvasErr) {
              reject(canvasErr);
            }
          };
          img.onerror = (err) => {
            console.warn('Logo Image.onerror:', err);
            reject(new Error('Image load failed'));
          };
          img.src = resolvedUri;
        });
        return dataUrl;
      } catch (imgErr) {
        console.warn('Logo canvas approach failed:', imgErr);
      }

      // Fallback: fetch as blob → FileReader
      try {
        const response = await fetch(resolvedUri, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
        const blob = await response.blob();
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        console.log('Logo fetch+blob conversion success');
        return result;
      } catch (fetchErr) {
        console.warn('Logo fetch approach also failed:', fetchErr);
        // Last resort: return the raw URI and hope the browser can resolve it
        return resolvedUri;
      }
    }

    // Read local file as base64 (Native only)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const extension = uri.split('.').pop()?.toLowerCase();
    const mimeType =
      extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn('PDF Logo Error:', error);
    return null;
  }
};

// ─── Amount to Words ───────────────────────────────────────────────────────────
const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const numToWords = (n: number): string => {
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
};

const amountInWords = (amount: number): string => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = numToWords(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
};

// ─── Shared CSS ────────────────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  /* Preserve deliberate fills in non-receipt documents. Receipt pages opt into
     economy printing below and avoid dark fills altogether. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { margin: 0; size: A4 portrait; }
  html, body { height: auto; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1F2937;
    background: #fff;
    font-size: 10px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    padding: 10px 16px;
    max-width: 700px;
    margin: 0 auto;
    overflow: hidden;
    background: #ffffff;
  }
  .page.receipt-page {
    width: 794px;
    min-height: 561px;
    max-width: none;
    padding: 20px;
    margin: 0;
  }
  .receipt-page .watermark,
  .receipt-page .watermark-logo {
    display: none;
  }
  .receipt-page,
  .receipt-page * {
    -webkit-print-color-adjust: economy !important;
    print-color-adjust: economy !important;
  }

  /* ── Watermark (straight, faint, forced BEHIND content) ──
     Straight + centred means it sits directly under the body text, so it MUST
     be far fainter than the old sloped version or it wrecks legibility. */
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-size: 72px; font-weight: 800;
    opacity: 0.05; color: #4F46E5;
    pointer-events: none; z-index: 0;
    white-space: nowrap; letter-spacing: 14px;
    text-transform: uppercase;
  }
  .watermark-logo {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 360px; height: 360px;
    object-fit: contain;
    opacity: 0.045;
    pointer-events: none; z-index: 0;
    filter: grayscale(100%);
  }
  /* Lift every real section above the watermark in one rule — no markup change.
     Without this, a straight z-index:0 watermark paints OVER non-positioned
     content (table, totals). Covers both receipt and invoice pages. */
  .page > *:not(.watermark):not(.watermark-logo) {
    position: relative;
    z-index: 1;
  }

  /* ── Header ── */
  .doc-header {
    display: flex; justify-content: space-between;
    align-items: flex-start; margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid #9CA3AF;
  }
  .school-brand {
    display: flex; align-items: center; gap: 12px;
    flex: 1; min-width: 0;
  }
  .school-info { min-width: 0; flex: 1; }
  .school-logo {
    width: 56px; height: 56px; flex-shrink: 0;
    object-fit: contain; margin: 0;
  }
  .school-logo-fallback {
    width: 56px; height: 56px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 800; color: #374151;
    background: #F3F4F6; border-radius: 10px;
    border: 1px solid #E5E7EB;
  }
  .school-name {
    font-size: 17px; font-weight: 800; color: #111827;
    line-height: 1.2;
  }
  .school-sub { font-size: 8px; color: #6B7280; margin-top: 2px; max-width: 320px; line-height: 1.25; }
  .school-reg { font-size: 8px; font-weight: 700; color: #374151; margin-top: 2px; letter-spacing: 0.2px; }

  .doc-title-block { text-align: right; flex-shrink: 0; }
  .doc-title { font-size: 14px; font-weight: 800; letter-spacing: 0.5px; color: #111827; }
  .doc-no { font-size: 9px; color: #6B7280; margin-top: 1px; font-weight: 600; }

  /* ── Info grid ── */
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 5px; margin-bottom: 6px;
  }
  .info-box {
    background: #F9FAFB; border-radius: 5px;
    padding: 4px 7px; border: 1px solid #F3F4F6;
  }
  .info-box.highlight { background: #FFFFFF; border-color: #D1D5DB; }
  .info-label {
    font-size: 7px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #9CA3AF; margin-bottom: 1px;
  }
  .info-value { font-size: 10px; font-weight: 700; color: #111827; }
  .info-sub { font-size: 8px; color: #6B7280; margin-top: 0; }

  /* ── Table ──
     Header is a quiet light fill with dark text for grayscale-friendly output. */
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  thead tr { background: #F3F4F6; }
  thead th {
    padding: 5px 8px; text-align: left;
    font-size: 8px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: #111827;
    border-bottom: 1px solid #D1D5DB;
  }
  thead th:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #F9FAFB; }
  tbody td { padding: 4px 7px; font-size: 10px; border-bottom: 1px solid #F3F4F6; }
  tbody td:last-child {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .td-desc-main { font-weight: 600; color: #111827; }
  .td-desc-sub { font-size: 8px; color: #9CA3AF; margin-top: 0; }

  /* ── Totals ── */
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 6px; }
  .totals-box { width: 210px; }
  .totals-row {
    display: flex; justify-content: space-between;
    padding: 2px 0; font-size: 10px; color: #4B5563;
    border-bottom: 1px dashed #E5E7EB;
  }
  .totals-row span:last-child { font-variant-numeric: tabular-nums; }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand {
    font-size: 11px; font-weight: 800;
    color: #111827; padding-top: 4px; margin-top: 2px;
    border-top: 1.5px solid #111827; border-bottom: none;
  }
  .totals-row.paid-row { color: #111827; font-weight: 600; }
  .totals-row.due-row  { color: #111827; font-weight: 700; }

  /* ── Due amount footer bar ── */
  .due-amount-bar {
    display: flex; justify-content: space-between; align-items: center;
    border-radius: 6px; padding: 6px 10px; margin-bottom: 6px;
    border: 1px solid #D1D5DB;
  }
  .due-amount-bar.pending {
    background: #FFFFFF; border-color: #D1D5DB;
  }
  .due-amount-bar.clear {
    background: #FFFFFF; border-color: #D1D5DB;
  }
  .due-amount-left { display: flex; flex-direction: column; gap: 1px; }
  .due-amount-label {
    font-size: 7px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .due-amount-bar.pending .due-amount-label { color: #374151; }
  .due-amount-bar.clear .due-amount-label { color: #374151; }
  .due-amount-sub { font-size: 8px; color: #6B7280; }
  .due-amount-value {
    font-size: 14px; font-weight: 800; letter-spacing: -0.5px;
    font-variant-numeric: tabular-nums;
  }
  .due-amount-bar.pending .due-amount-value { color: #111827; }
  .due-amount-bar.clear .due-amount-value { color: #111827; }
  .due-status-badge {
    font-size: 8px; font-weight: 700; padding: 3px 8px;
    border-radius: 20px; text-transform: uppercase; letter-spacing: 0.4px;
  }
  .due-status-badge.pending { background: #FFFFFF; color: #111827; border: 1px solid #D1D5DB; }
  .due-status-badge.clear { background: #FFFFFF; color: #111827; border: 1px solid #D1D5DB; }

  /* ── Amount in words ── */
  .amount-words {
    background: #FFFFFF; border: 1px solid #D1D5DB; border-radius: 5px;
    padding: 4px 8px; margin-bottom: 6px; font-size: 9px;
    color: #111827; font-weight: 500;
  }
  .amount-words strong { font-weight: 700; }

  /* ── All fee dues summary ── */
  .dues-section {
    margin: 10px 0 8px;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  .dues-section-title {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 10px;
    background: #F3F4F6;
    border-bottom: 1px solid #E5E7EB;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.7px; color: #374151;
  }
  .dues-section-title span {
    font-size: 8px; font-weight: 500; text-transform: none;
    letter-spacing: 0; color: #6B7280;
  }
  .dues-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 0;
    background: #fff;
  }
  .dues-table thead tr { background: #F9FAFB; }
  .dues-table thead th {
    padding: 6px 8px;
    font-size: 7.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #4B5563;
    border-bottom: 1px solid #E5E7EB;
    text-align: left;
  }
  .dues-table thead th.col-num { text-align: right; }
  .dues-table thead th.col-year { text-align: center; width: 18%; }
  .dues-table thead th.col-fee { width: 32%; }
  .dues-table tbody tr { border-bottom: 1px solid #F3F4F6; }
  .dues-table tbody tr:nth-child(even) { background: #F9FAFB; }
  .dues-table tbody tr:last-child { border-bottom: none; }
  .dues-table tbody td {
    padding: 7px 8px;
    font-size: 9.5px;
    color: #374151;
    vertical-align: middle;
    font-weight: 500;
  }
  .dues-table tbody td.col-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #111827;
  }
  .dues-table tbody td.col-year {
    text-align: center;
    color: #6B7280;
    font-size: 9px;
  }
  .dues-table tbody td.col-fee { font-weight: 600; color: #111827; }
  .dues-table tbody td.col-due {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #111827;
  }
  .dues-table tbody tr.dues-paid td.col-due { color: #111827; }
  .dues-table tbody tr.dues-paid td.col-num-paid { color: #111827; }
  .dues-table tbody tr.dues-highlight {
    background: #fff !important;
    box-shadow: inset 3px 0 0 #9CA3AF;
  }
  .dues-table tbody tr.dues-highlight td.col-fee { color: #111827; }
  .dues-payment-tag {
    display: inline-block;
    margin-left: 4px;
    padding: 1px 5px;
    border-radius: 10px;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.2px;
    text-transform: uppercase;
    color: #4B5563;
    background: #E5E7EB;
    border: 1px solid #D1D5DB;
    vertical-align: middle;
  }
  .dues-table tfoot tr { background: #F9FAFB; }
  .dues-table tfoot td {
    padding: 7px 8px;
    font-size: 9.5px;
    font-weight: 800;
    color: #111827;
    border-top: 2px solid #D1D5DB;
    vertical-align: middle;
  }
  .dues-table tfoot td.col-label {
    text-align: left;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-size: 8px;
  }
  .dues-table tfoot td.col-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .dues-table tfoot td.col-due-total {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #111827;
    font-size: 10px;
  }

  /* ── Status badge ── */
  .badge {
    display: inline-block; padding: 2px 7px;
    border-radius: 20px; font-size: 8px; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .badge-paid,
  .badge-pending,
  .badge-partial,
  .badge-unpaid {
    background: #FFFFFF;
    color: #111827;
    border: 1px solid #D1D5DB;
  }

  /* ── Payment method chip ── */
  .method-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: #FFFFFF; color: #111827;
    border: 1px solid #D1D5DB;
    padding: 2px 6px; border-radius: 5px;
    font-size: 8px; font-weight: 700; letter-spacing: 0.5px;
  }

  /* ── Signature ── */
  .signature-row {
    display: flex; justify-content: space-between;
    align-items: flex-end; margin-top: 6px; padding-top: 5px;
    border-top: 1px dashed #D1D5DB;
  }
  .sig-block { text-align: center; }
  .sig-line {
    border-top: 1px solid #9CA3AF; width: 100px;
    padding-top: 2px; font-size: 8px; color: #6B7280; margin-top: 10px;
  }
  .qr-placeholder {
    width: 32px; height: 32px; border: 1px dashed #D1D5DB;
    border-radius: 4px; display: flex; align-items: center;
    justify-content: center; font-size: 7px; color: #9CA3AF;
    text-align: center; padding: 2px; line-height: 1.2;
  }
  .stamp-block { text-align: center; }
  .stamp-label {
    font-size: 8px; color: #9CA3AF; margin-bottom: 3px;
    text-transform: uppercase; letter-spacing: 0.4px;
  }
  .stamp-placeholder {
    width: 52px; height: 52px; border: 2px dashed #D1D5DB;
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; font-size: 7px; font-weight: 600;
    color: #9CA3AF; text-align: center; padding: 4px;
    line-height: 1.15; background: rgba(243,244,246,0.5);
  }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 5px; padding-top: 4px;
    border-top: 1px solid #F3F4F6;
    text-align: center; font-size: 7px; color: #9CA3AF; line-height: 1.3;
  }
  .doc-footer strong { color: #6B7280; }

  /* ── Divider ── */
  .section-divider { border: none; border-top: 1px solid #F3F4F6; margin: 5px 0; }

  /* ── Receipt specific ── */
  .receipt-banner {
    background: #FFFFFF;
    border: 1px solid #9CA3AF;
    border-radius: 7px; padding: 7px 10px; margin-bottom: 6px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .receipt-banner-label {
    font-size: 8px; color: #4B5563;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;
  }
  .receipt-banner-amount {
    font-size: 17px; font-weight: 800; color: #111827; letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
  }
  .receipt-banner-right { text-align: right; }
  .receipt-banner-date { font-size: 8px; color: #4B5563; margin-top: 1px; }

  /* ── Two-up compact fee receipt (2 copies side-by-side in the top half) ── */
  .receipt-duplex {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 12px;
    width: 100%;
    /* Fill the full inner height of the half-page (.receipt-page 561px − 40px
       padding) so each bordered copy occupies the whole top half, not ~1/3. */
    min-height: 521px;
  }
  .receipt-card {
    flex: 1 1 0;
    min-width: 0;
    border: 1.4px solid #111827;
    border-radius: 6px;
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    color: #111827;
    font-size: 9px;
    line-height: 1.3;
    background: #fff;
  }
  .rc-metarow {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 8px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.4px; color: #4B5563; margin-bottom: 5px;
  }
  .rc-metarow .rc-rcpt { color: #111827; font-size: 9px; }
  .rc-header {
    display: flex; align-items: center; gap: 8px;
    padding-bottom: 6px; margin-bottom: 6px;
    border-bottom: 1.5px solid #111827;
  }
  .rc-logo { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
  .rc-logo-fallback {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    background: #F3F4F6; border: 1px solid #E5E7EB;
    font-size: 13px; font-weight: 800; color: #374151;
  }
  .rc-head-text { flex: 1; min-width: 0; text-align: center; }
  .rc-school { font-size: 12.5px; font-weight: 800; line-height: 1.15; color: #111827; }
  .rc-school-sub { font-size: 7.5px; color: #6B7280; margin-top: 2px; line-height: 1.25; }
  .rc-info {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px;
    margin-bottom: 6px;
  }
  .rc-info .full { grid-column: 1 / -1; }
  .rc-info .lbl {
    display: block; font-size: 6.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.4px; color: #9CA3AF; margin-bottom: 1px;
  }
  .rc-info .val { display: block; font-size: 10px; font-weight: 700; color: #111827; }
  .rc-info .val.big { font-size: 13px; line-height: 1.2; }
  .rc-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .rc-table th {
    text-align: left; font-size: 7px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.4px; color: #111827; background: #F3F4F6;
    padding: 4px 6px; border: 1px solid #E5E7EB;
  }
  .rc-table th:last-child, .rc-table td:last-child { text-align: right; }
  .rc-table td { font-size: 9px; padding: 4px 6px; border: 1px solid #F3F4F6; }
  .rc-table td.amt { font-variant-numeric: tabular-nums; font-weight: 700; }
  .rc-totals { margin-bottom: 6px; }
  .rc-totrow {
    display: flex; justify-content: space-between; font-size: 9px;
    padding: 2px 0; color: #4B5563; border-bottom: 1px dashed #E5E7EB;
  }
  .rc-totrow span:last-child { font-variant-numeric: tabular-nums; color: #111827; }
  .rc-totrow.grand {
    font-size: 13px; font-weight: 800; color: #111827;
    border-bottom: none; border-top: 1.5px solid #111827;
    padding-top: 4px; margin-top: 1px;
  }
  .rc-totrow.grand span:last-child { font-weight: 800; }
  .rc-words {
    font-size: 8px; border: 1px solid #D1D5DB; border-radius: 4px;
    padding: 4px 6px; margin-bottom: 6px; line-height: 1.35;
  }
  .rc-words strong { font-weight: 700; }
  .rc-due {
    display: flex; justify-content: space-between; align-items: center;
    border: 1.4px solid #111827; border-radius: 5px;
    padding: 5px 9px; margin-bottom: 8px;
  }
  .rc-due-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; }
  .rc-due-val { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; color: #111827; }
  .rc-badge {
    display: inline-block; margin-top: 2px;
    font-size: 6.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    border: 1px solid #111827; border-radius: 10px; padding: 1px 6px; color: #111827;
  }
  .rc-foot {
    margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;
    padding-top: 4px;
  }
  .rc-foot-meta { font-size: 7.5px; color: #4B5563; line-height: 1.5; }
  .rc-foot-meta b { color: #111827; }
  .rc-sign { text-align: center; }
  .rc-sign-line { border-top: 1px solid #6B7280; padding-top: 2px; min-width: 90px; font-size: 7.5px; color: #4B5563; }
  .rc-dues { border: 1px solid #E5E7EB; border-radius: 5px; overflow: hidden; margin-bottom: 6px; }
  .rc-dues-title {
    display: flex; justify-content: space-between; align-items: center;
    background: #F3F4F6; padding: 4px 6px;
    font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #374151;
  }
  .rc-dues-title span { font-size: 7px; font-weight: 500; color: #6B7280; text-transform: none; letter-spacing: 0; }
  .rc-dues-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .rc-dues-table th {
    text-align: left; font-size: 6.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    color: #6B7280; padding: 3px 6px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;
  }
  .rc-dues-table th:not(:first-child), .rc-dues-table td:not(:first-child) { text-align: right; }
  .rc-dues-table td {
    font-size: 8px; padding: 3px 6px; border-bottom: 1px solid #F3F4F6;
    color: #374151; font-variant-numeric: tabular-nums;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rc-dues-table td.fee { font-weight: 600; color: #111827; }
  .rc-dues-table tbody tr:last-child td { border-bottom: none; }
  .rc-dues-table tr.paid td { color: #6B7280; }
  .rc-dues-table tr.this-pay { background: #EEF0F3; }
  .rc-dues-table tr.this-pay td { color: #111827; }
  .rc-dues-table tr.this-pay td.fee { font-weight: 700; }
  .rc-dues-table tfoot td {
    font-size: 8px; font-weight: 800; color: #111827;
    border-top: 1.5px solid #D1D5DB; padding: 3px 6px;
  }
  .rc-dues-table tfoot td.fee { text-transform: uppercase; font-size: 7px; letter-spacing: 0.3px; }

  /* ── Print-specific overrides ── */
  @media print {
    html, body { height: auto !important; overflow: visible !important; }
    .page { page-break-inside: avoid; page-break-after: avoid; }
  }
`;

// ─── Receipt PDF ───────────────────────────────────────────────────────────────
function normalizeFeeDueLine(raw: Record<string, unknown>): StudentFeeDueLine {
  const amountDue = Number(raw.amount_due ?? 0);
  const amountPaid = Number(raw.amount_paid ?? 0);
  const discount = Number(raw.discount ?? 0);
  const balanceDue = Number(
    raw.balance_due ?? Math.max(0, amountDue - discount - amountPaid),
  );
  return {
    student_fee_id: raw.student_fee_id as string | undefined,
    fee_type: String(raw.fee_type ?? 'Fee'),
    academic_year: raw.academic_year ? String(raw.academic_year) : undefined,
    amount_due: amountDue,
    amount_paid: amountPaid,
    discount,
    balance_due: balanceDue,
    status: raw.status ? String(raw.status) : undefined,
  };
}

function fatherFromTransaction(transaction: FeeTransaction): { fatherName: string; fatherMobile: string } {
  return {
    fatherName: (transaction.father_name || '').trim(),
    fatherMobile: (
      transaction.father_mobile ||
      (transaction as { father_phone?: string; parent_phone?: string }).father_phone ||
      (transaction as { father_phone?: string; parent_phone?: string }).parent_phone ||
      ''
    ).trim(),
  };
}

function isSerialReceiptNo(value: string): boolean {
  return /^RCT-/i.test(value) || /^SCH\d+-RCT-/i.test(value);
}

async function resolveReceiptNo(transaction: FeeTransaction): Promise<string> {
  const direct = (transaction.receipt_no || (transaction as { receiptNo?: string }).receiptNo || '').trim();
  if (direct && isSerialReceiptNo(direct)) return direct;

  const txId = transaction.id;
  if (txId) {
    try {
      const { FeeService } = await import('../services/feeService');
      const looked = await FeeService.lookupReceiptNo(txId);
      if (looked) return looked;
    } catch {
      /* optional lookup */
    }
  }

  return txId ? `RCP-${txId.slice(0, 8).toUpperCase()}` : 'N/A';
}

function fatherFromParents(parents: Parent[] | undefined): { fatherName: string; fatherMobile: string } {
  if (!parents?.length) return { fatherName: '', fatherMobile: '' };
  const father =
    parents.find((p) => p.relation === 'Father') ||
    parents.find((p) => p.is_primary) ||
    parents[0];
  if (!father) return { fatherName: '', fatherMobile: '' };
  const fatherName = [father.first_name, father.last_name].filter(Boolean).join(' ').trim();
  return { fatherName, fatherMobile: (father.phone || '').trim() };
}

async function resolveReceiptContext(transaction: FeeTransaction): Promise<{
  feeDues: StudentFeeDueLine[];
  fatherName: string;
  fatherMobile: string;
  receiptNo: string;
}> {
  const studentId =
    transaction.student_id ||
    (transaction as { studentId?: string }).studentId;
  const fromTx = fatherFromTransaction(transaction);
  let fatherName = fromTx.fatherName;
  let fatherMobile = fromTx.fatherMobile;

  const embedded = (transaction as FeeTransaction & { fee_dues?: unknown[] }).fee_dues;
  if (Array.isArray(embedded) && embedded.length > 0) {
    const feeDues = embedded.map((row) =>
      normalizeFeeDueLine(row as unknown as Record<string, unknown>),
    );
    if ((!fatherName || !fatherMobile) && studentId) {
      try {
        const { FeeService } = await import('../services/feeService');
        const data = await FeeService.getStudentFees(studentId);
        fatherName = fatherName || (data.student?.father_name || '').trim();
        fatherMobile = fatherMobile || (data.student?.father_mobile || '').trim();
        if (!fatherName || !fatherMobile) {
          const picked = fatherFromParents(data.student?.parents);
          fatherName = fatherName || picked.fatherName;
          fatherMobile = fatherMobile || picked.fatherMobile;
        }
      } catch {
        /* keep transaction values */
      }
    }
    const receiptNo = await resolveReceiptNo(transaction);
    return { feeDues, fatherName, fatherMobile, receiptNo };
  }

  if (!studentId) {
    const receiptNo = await resolveReceiptNo(transaction);
    return { feeDues: [], fatherName, fatherMobile, receiptNo };
  }

  try {
    const { FeeService } = await import('../services/feeService');
    const data = await FeeService.getStudentFees(studentId);
    const feeDues = (data.fees || []).map((f) =>
      normalizeFeeDueLine({
        student_fee_id: f.id,
        fee_type: f.fee_type,
        academic_year: (f as { academic_year?: string }).academic_year,
        amount_due: f.amount_due,
        amount_paid: f.amount_paid,
        discount: f.discount,
        status: f.status,
      }),
    );
    fatherName = fatherName || (data.student?.father_name || '').trim();
    fatherMobile = fatherMobile || (data.student?.father_mobile || '').trim();
    if (!fatherName || !fatherMobile) {
      const picked = fatherFromParents(data.student?.parents);
      fatherName = fatherName || picked.fatherName;
      fatherMobile = fatherMobile || picked.fatherMobile;
    }
    if (!fatherName || !fatherMobile) {
      try {
        const { StudentService } = await import('../services/studentService');
        const parents = await StudentService.getParents(studentId, { silent: true });
        const picked = fatherFromParents(parents);
        fatherName = fatherName || picked.fatherName;
        fatherMobile = fatherMobile || picked.fatherMobile;
      } catch {
        /* optional fallback */
      }
    }
    const receiptNo = await resolveReceiptNo(transaction);
    return { feeDues, fatherName, fatherMobile, receiptNo };
  } catch {
    const receiptNo = await resolveReceiptNo(transaction);
    return { feeDues: [], fatherName, fatherMobile, receiptNo };
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatClassSection(transaction: FeeTransaction): string | null {
  const className =
    transaction.class_name ||
    (transaction as { class?: string }).class;
  const sectionName =
    transaction.section_name ||
    (transaction as { section?: string }).section;
  if (className && sectionName) return `${className} — ${sectionName}`;
  if (className) return className;
  if (sectionName) return `Section ${sectionName}`;
  return null;
}

export const generateReceiptPDF = async (transaction: FeeTransaction) => {
  try {
    const { feeDues, fatherName, fatherMobile, receiptNo } = await resolveReceiptContext(transaction);
    const studentName = transaction.student_name || 'Student';
    const admissionNo = transaction.admission_no || 'N/A';
    const classSectionText = formatClassSection(transaction);
    const paidAtStr = transaction.paid_at || new Date().toISOString();
    const dateObj = new Date(paidAtStr);
    const dateFull = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const dateTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const feeName = transaction.fee_type || 'School Fee';
    // Combined multi-fee-type receipt: one receipt lists several paid fee types.
    const lineItems = (transaction as FeeTransaction & {
      line_items?: { fee_type: string; academic_year?: string; amount: number }[];
    }).line_items;
    const hasLineItems = Array.isArray(lineItems) && lineItems.length > 0;
    const paidFeeIds = new Set(
      ((transaction as FeeTransaction & { paid_fee_ids?: string[] }).paid_fee_ids || [])
        .concat(transaction.student_fee_id ? [transaction.student_fee_id] : [])
        .filter(Boolean),
    );
    const amountNum = hasLineItems
      ? lineItems!.reduce((sum, li) => sum + Number(li.amount || 0), 0)
      : Number(transaction.amount || 0);
    const amountFmt = amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const paymentMethod = (transaction.payment_method || 'Cash').toUpperCase();
    const academicYearText =
      transaction.academic_year ||
      (transaction as any).academicYear ||
      `${dateObj.getFullYear()}–${dateObj.getFullYear() + 1}`;
    const words = amountInWords(amountNum);
    const fmtINR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const totalFeeDue = Number(
      transaction.amount_due != null
        ? transaction.amount_due - (transaction.discount ?? 0)
        : amountNum,
    );
    const totalPaidOnFee = Number(transaction.total_paid ?? amountNum);
    const balanceDue = Math.max(
      0,
      Number(
        transaction.balance_due ??
        (transaction as any).remaining_balance ??
        totalFeeDue - totalPaidOnFee,
      ),
    );
    const totalFeeFmt = fmtINR(totalFeeDue);
    const totalPaidFmt = fmtINR(totalPaidOnFee);
    const balanceDueFmt = fmtINR(balanceDue);
    const totalOutstandingAll = feeDues.reduce((sum, line) => sum + line.balance_due, 0);
    const totalGrossDue = feeDues.reduce((sum, line) => sum + Math.max(0, line.amount_due), 0);
    const totalDiscountAll = feeDues.reduce((sum, line) => sum + Math.max(0, line.discount ?? 0), 0);
    const totalAssignedDue = feeDues.reduce(
      (sum, line) => sum + Math.max(0, line.amount_due - (line.discount ?? 0)),
      0,
    );
    const totalPaidAll = feeDues.reduce((sum, line) => sum + line.amount_paid, 0);
    const useAllFeesSummary = feeDues.length > 0;
    const displayOutstanding = useAllFeesSummary ? totalOutstandingAll : balanceDue;
    const isFullyPaid = displayOutstanding <= 0;
    const showDiscountColumn = totalDiscountAll > 0 || (transaction.discount ?? 0) > 0;

    const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
    const cardLogoHtml = logoBase64
      ? `<img src="${logoBase64}" class="rc-logo" alt="" />`
      : `<div class="rc-logo-fallback">${SCHOOL_CONFIG.name.slice(0, 2).toUpperCase()}</div>`;

    const clerkName = transaction.received_by || '';
    const dueLabel = isFullyPaid ? 'Total Outstanding' : 'Outstanding Balance';
    const dueValue = isFullyPaid ? '₹0.00' : `₹${fmtINR(displayOutstanding)}`;
    const dueBadge = isFullyPaid ? 'Fully Paid' : 'Due Pending';
    const remarksText = (transaction.remarks || '').trim();

    // Compact "all assigned fee dues" breakdown — fills the card with real data
    // instead of whitespace. Capped so an unusually long list can't overflow the
    // half-page (the true totals still come from the footer row).
    const MAX_DUES_ROWS = 7;
    const shownDues = feeDues.slice(0, MAX_DUES_ROWS);
    const hiddenDuesCount = feeDues.length - shownDues.length;
    const duesRowsHtml =
      shownDues
        .map((line) => {
          const netDue = Math.max(0, line.amount_due - (line.discount ?? 0));
          const isPaid = line.balance_due <= 0;
          const isThisPayment =
            line.student_fee_id != null &&
            paidFeeIds.has(line.student_fee_id);
          const cls = [isThisPayment ? 'this-pay' : '', isPaid ? 'paid' : '']
            .filter(Boolean)
            .join(' ');
          const discountCell = showDiscountColumn ? `<td>₹${fmtINR(line.discount ?? 0)}</td>` : '';
          return `<tr class="${cls}"><td class="fee">${escapeHtml(line.fee_type)}</td><td>₹${fmtINR(showDiscountColumn ? line.amount_due : netDue)}</td>${discountCell}<td>₹${fmtINR(line.amount_paid)}</td><td>₹${fmtINR(line.balance_due)}</td></tr>`;
        })
        .join('') +
      (hiddenDuesCount > 0
        ? `<tr><td class="fee" colspan="${showDiscountColumn ? 5 : 4}" style="text-align:center;color:#6B7280;font-weight:500;">+ ${hiddenDuesCount} more fee type${hiddenDuesCount === 1 ? '' : 's'}</td></tr>`
        : '');
    const duesHeaderHtml = showDiscountColumn
      ? '<thead><tr><th style="width:34%;">Fee Type</th><th>Total</th><th>Discount</th><th>Paid</th><th>Balance</th></tr></thead>'
      : '<thead><tr><th style="width:40%;">Fee Type</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>';
    const duesFooterHtml = showDiscountColumn
      ? `<tfoot><tr><td class="fee">Total</td><td>₹${fmtINR(totalGrossDue)}</td><td>₹${fmtINR(totalDiscountAll)}</td><td>₹${fmtINR(totalPaidAll)}</td><td>₹${fmtINR(totalOutstandingAll)}</td></tr></tfoot>`
      : `<tfoot><tr><td class="fee">Total</td><td>₹${fmtINR(totalAssignedDue)}</td><td>₹${fmtINR(totalPaidAll)}</td><td>₹${fmtINR(totalOutstandingAll)}</td></tr></tfoot>`;
    const duesSectionHtml =
      feeDues.length > 0
        ? `<div class="rc-dues">
            <div class="rc-dues-title">All Assigned Fee Dues<span>${feeDues.length} fee type${feeDues.length === 1 ? '' : 's'}</span></div>
            <table class="rc-dues-table">
              ${duesHeaderHtml}
              <tbody>${duesRowsHtml}</tbody>
              ${duesFooterHtml}
            </table>
          </div>`
        : '';

    // One compact receipt copy — sized so two sit side-by-side in the top half.
    const renderReceiptCard = () => `
      <div class="receipt-card">
        <div class="rc-metarow">
          <span>Receipt No: <b class="rc-rcpt">${escapeHtml(receiptNo)}</b></span>
          <span>${dateFull} · ${dateTime}</span>
        </div>
        <div class="rc-header">
          ${cardLogoHtml}
          <div class="rc-head-text">
            <div class="rc-school">${SCHOOL_CONFIG.name}</div>
            <div class="rc-school-sub">${[SCHOOL_CONFIG.address, `Academic Year: ${academicYearText}`].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div class="rc-info">
          <div class="full"><span class="lbl">Student Name</span><span class="val big">${escapeHtml(studentName)}</span></div>
          <div><span class="lbl">Father's Name</span><span class="val">${escapeHtml(fatherName || '—')}</span></div>
          <div><span class="lbl">Father Mobile</span><span class="val">${escapeHtml(fatherMobile || '—')}</span></div>
          <div><span class="lbl">Admission No</span><span class="val">${escapeHtml(admissionNo)}</span></div>
          <div><span class="lbl">Class &amp; Section</span><span class="val big">${escapeHtml(classSectionText || '—')}</span></div>
        </div>
        <table class="rc-table">
          <thead><tr><th>Fee Description</th><th>Amount (₹)</th></tr></thead>
          <tbody>
            ${hasLineItems
              ? lineItems!
                  .map((li) => {
                    const label = li.academic_year
                      ? `${escapeHtml(li.fee_type)} <span style="color:#6B7280;font-weight:500;">(${escapeHtml(String(li.academic_year))})</span>`
                      : escapeHtml(li.fee_type);
                    return `<tr><td>${label}</td><td class="amt">${fmtINR(Number(li.amount || 0))}</td></tr>`;
                  })
                  .join('')
              : `<tr><td>${escapeHtml(feeName)}</td><td class="amt">${amountFmt}</td></tr>`}
          </tbody>
        </table>
        <div class="rc-totals">
          <div class="rc-totrow"><span>${hasLineItems ? 'Total This Payment' : 'Total Fee'}</span><span>₹${hasLineItems ? amountFmt : totalFeeFmt}</span></div>
          ${!hasLineItems && (transaction.discount ?? 0) > 0 ? `<div class="rc-totrow"><span>Discount</span><span>− ₹${fmtINR(transaction.discount ?? 0)}</span></div>` : ''}
          <div class="rc-totrow grand"><span>Amount Paid</span><span>₹${amountFmt}</span></div>
        </div>
        <div class="rc-words"><strong>In Words:</strong> ${words}</div>
        ${remarksText ? `<div class="rc-words"><strong>Remarks:</strong> ${escapeHtml(remarksText)}</div>` : ''}
        ${duesSectionHtml}
        <div class="rc-due">
          <div class="rc-due-label">${dueLabel}</div>
          <div style="text-align:right;">
            <div class="rc-due-val">${dueValue}</div>
            <span class="rc-badge">${dueBadge}</span>
          </div>
        </div>
        <div class="rc-foot">
          <div class="rc-foot-meta">
            <div>Mode: <b>${paymentMethod}</b></div>
            <div>Print Date: ${dateFull}</div>
          </div>
          <div class="rc-sign">
            <div class="rc-sign-line">${clerkName ? escapeHtml(clerkName) + ' · ' : ''}Clerk</div>
          </div>
        </div>
      </div>
    `;

    // Two identical copies side-by-side, filling the top half of the A4 sheet
    // (the .receipt-page is 148.5mm tall). Tear down the middle → payer copy +
    // office copy. The bottom half of the sheet is intentionally left blank.
    const receiptPageHtml = `
          <div class="page receipt-page">
            <div class="receipt-duplex">
              ${renderReceiptCard()}
              ${renderReceiptCard()}
            </div>
          </div>
    `;

    const wrapHtml = () => `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>${BASE_CSS}</style>
        </head>
        <body>
          ${receiptPageHtml}
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      // Both copies live in one captured .page, which prints as the top half of
      // the A4 (contentHeight = 148.5mm) — no vertical stacking needed.
      const mounted = await mountReceiptHtmlForCapture(wrapHtml());
      try {
        await printElementToWindow(mounted.element, 'RECEIPT', { title: 'Fee Receipt' });
      } finally {
        mounted.cleanup();
      }
      return;
    }
    const { uri } = await Print.printToFileAsync({ html: wrapHtml() });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    throw error;
  }
};

// ─── Invoice PDF ───────────────────────────────────────────────────────────────
export const generateInvoicePDF = async (invoice: Invoice) => {
  try {
    const studentName = invoice.student?.person?.display_name || 'Student';
    const admissionNo = invoice.student?.admission_no || 'N/A';
    const dateObj = new Date(invoice.created_at);
    const invoiceDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const feeName = invoice.fee_structure?.fee_type?.name || 'School Fee';
    const feeDesc = invoice.fee_structure?.fee_type?.description || '';
    const invoiceNo = `INV-${dateObj.getFullYear()}-${invoice.id.slice(0, 8).toUpperCase()}`;

    const subtotal = invoice.amount_due;
    const discount = invoice.discount ?? 0;
    const paid = invoice.amount_paid ?? 0;
    const netDue = Math.max(subtotal - discount - paid, 0);

    const statusKey =
      invoice.status?.toLowerCase() === 'paid' ? 'paid'
        : paid > 0 ? 'partial'
          : 'unpaid';
    const statusLabel =
      statusKey === 'paid' ? 'PAID'
        : statusKey === 'partial' ? 'PARTIAL'
          : 'UNPAID';

    const dueDateObj = new Date(dateObj);
    dueDateObj.setDate(dueDateObj.getDate() + 30);
    const dueDate = dueDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" class="school-logo" alt="" />`
      : `<div class="school-logo-fallback">${SCHOOL_CONFIG.name.slice(0, 2).toUpperCase()}</div>`;
    const schoolBrandHtml = `
              <div class="school-brand">
                ${logoHtml}
                <div class="school-info">
                  <div class="school-name">${SCHOOL_CONFIG.name}</div>
                  <div class="school-sub">${SCHOOL_CONFIG.address || ''}</div>
                  ${SCHOOL_RECOGNITION_LINE ? `<div class="school-reg">${SCHOOL_RECOGNITION_LINE}</div>` : ''}
                </div>
              </div>`;
    const watermarkHtml = logoBase64
      ? `<img src="${logoBase64}" class="watermark-logo" alt="" />`
      : `<div class="watermark">${statusLabel}</div>`;

    const academicYearText =
      (invoice as any).academic_year ||
      (invoice.fee_structure as any)?.academic_year ||
      `${dateObj.getFullYear()}–${dateObj.getFullYear() + 1}`;
    const fmtINR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>${BASE_CSS}</style>
        </head>
        <body>
          <div class="page">
            ${watermarkHtml}

            <!-- Header -->
            <div class="doc-header">
              ${schoolBrandHtml}
              <div class="doc-title-block">
                <div class="doc-title">INVOICE</div>
                <div class="doc-no"># ${invoiceNo}</div>
                <div style="margin-top:8px;">
                  <span class="badge badge-${statusKey}">${statusLabel}</span>
                </div>
              </div>
            </div>

            <!-- Info Grid -->
            <div class="info-grid">
              <div class="info-box highlight">
                <div class="info-label">Bill To</div>
                <div class="info-value">${studentName}</div>
                <div class="info-sub">Admission No: ${admissionNo}</div>
              </div>
              <div class="info-box highlight">
                <div class="info-label">Bill From</div>
                <div class="info-value">${SCHOOL_CONFIG.name}</div>
                <div class="info-sub">${SCHOOL_CONFIG.address || ''}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Invoice Date</div>
                <div class="info-value">${invoiceDate}</div>
                <div class="info-sub">Ref: ${invoiceNo}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Due Date</div>
                <div class="info-value" style="color:${statusKey === 'unpaid' ? '#DC2626' : 'inherit'};">${dueDate}</div>
                <div class="info-sub">Academic Year: ${academicYearText}</div>
              </div>
            </div>

            <!-- Table -->
            <table>
              <thead>
                <tr>
                  <th style="width:5%;">#</th>
                  <th style="width:45%;">Description</th>
                  <th>Fee Type</th>
                  <th>Academic Year</th>
                  <th>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="color:#9CA3AF;">01</td>
                  <td>
                    <div class="td-desc-main">${feeName}</div>
                    ${feeDesc ? `<div class="td-desc-sub">${feeDesc}</div>` : ''}
                  </td>
                  <td>${feeName}</td>
                  <td>${academicYearText}</td>
                  <td>${fmtINR(subtotal)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>Sub Total</span>
                  <span>₹${fmtINR(subtotal)}</span>
                </div>
                ${discount > 0 ? `
                <div class="totals-row" style="color:#059669;">
                  <span>Discount</span>
                  <span>− ₹${fmtINR(discount)}</span>
                </div>` : ''}
                ${paid > 0 ? `
                <div class="totals-row paid-row">
                  <span>Amount Paid</span>
                  <span>− ₹${fmtINR(paid)}</span>
                </div>` : ''}
                <div class="totals-row grand ${statusKey === 'paid' ? '' : 'due-row'}">
                  <span>${statusKey === 'paid' ? '✓ Settled' : 'Balance Due'}</span>
                  <span>₹${fmtINR(netDue)}</span>
                </div>
              </div>
            </div>

            <!-- Amount in words -->
            <div class="amount-words">
              <strong>Amount Due in Words:</strong> ${amountInWords(netDue)}
            </div>

            <!-- Payment instructions (only when not paid) -->
            ${statusKey !== 'paid' ? `
            <div style="background:#FFF7ED; border:1px solid #FED7AA; border-radius:8px; padding:8px 12px; margin-bottom:10px;">
              <div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#92400E; margin-bottom:5px;">Payment Instructions</div>
              <div style="font-size:11px; color:#78350F; line-height:1.6;">
                Please make the payment before <strong>${dueDate}</strong> to avoid late fees.<br/>
                ${SCHOOL_CONFIG.contact ? `For queries, contact: <strong>${SCHOOL_CONFIG.contact}</strong>` : ''}
              </div>
            </div>` : ''}

            <!-- Signature row -->
            <div class="signature-row">
              <div>
                <div style="font-size:9px; color:#9CA3AF; margin-bottom:4px;">SCAN TO VERIFY</div>
                <div class="qr-placeholder">QR<br/>Verify</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Principal / Authorized</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Accounts Department</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="doc-footer">
              <p>📄 This is a system-generated invoice. Please retain for your records.</p>
              <p>
                ${SCHOOL_CONFIG.contact ? `<strong>Phone:</strong> ${SCHOOL_CONFIG.contact}` : ''}
                ${SCHOOL_CONFIG.website ? ` &nbsp;|&nbsp; <strong>Web:</strong> ${SCHOOL_CONFIG.website}` : ''}
              </p>
              <p style="margin-top:3px;">Generated on ${new Date().toLocaleString('en-IN')}</p>
            </div>

          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      await printHtmlOnWeb(html);
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    throw error;
  }
};

export interface AdjustmentPdfData {
  receipt_no: string;
  amount: number;
  reason: string;
  fee_component: string;
  created_at: string;
  adjusted_by_name: string;
  student_name: string;
  admission_no: string;
  class_name?: string;
  section_name?: string;
  adjustment_type?: 'waive' | 'add';
}

export const generateAdjustmentPDF = async (adjustment: AdjustmentPdfData, schoolSettings: any) => {
  try {
    const isAdd = adjustment.adjustment_type === 'add';
    const studentName = adjustment.student_name || 'Student';
    const admissionNo = adjustment.admission_no || 'N/A';
    const classSectionText = [adjustment.class_name, adjustment.section_name].filter(Boolean).join(' — ') || 'N/A';
    const dateObj = new Date(adjustment.created_at || new Date());
    const dateFull = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const amountNum = Number(adjustment.amount || 0);
    const amountFmt = amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const receiptNo = adjustment.receipt_no || 'N/A';
    const words = amountInWords(amountNum);
    const schoolName = schoolSettings?.school_name || 'School';
    const schoolAddress = schoolSettings?.school_address || '';
    const schoolPhone = schoolSettings?.school_phone || '';
    const schoolWebsite = schoolSettings?.school_website || '';

    const typeLabel = isAdd ? 'Fee Addition' : 'Fee Waiver';
    const voucherTitle = isAdd ? 'Fee Addition Voucher' : 'Fee Waiver Voucher';
    const bannerLabel = isAdd ? 'Fee Amount Added' : 'Waiver Amount Applied';
    const amountSign = isAdd ? '+' : '−';
    const badgeLabel = isAdd ? 'Fee Addition' : 'Discount / Waiver';
    const primaryColor = isAdd ? '#D97706' : '#DC2626';
    const primaryDark = isAdd ? '#B45309' : '#B91C1C';
    const bannerGradient = isAdd
      ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
      : 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)';
    const highlightBg = isAdd ? '#FFFBEB' : '#FEF2F2';
    const highlightBorder = isAdd ? '#FCD34D' : '#FCA5A5';
    const wordsBg = isAdd ? '#FFFBEB' : '#FEF2F2';
    const wordsBorder = isAdd ? '#FCD34D' : '#FCA5A5';
    const wordsColor = isAdd ? '#92400E' : '#991B1B';
    const badgeBg = isAdd ? '#FFEDD5' : '#FEE2E2';
    const badgeColor = isAdd ? '#9A3412' : '#991B1B';

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            ${BASE_CSS}
            .adjustment-badge {
              background-color: ${badgeBg};
              color: ${badgeColor};
              font-size: 8px;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 20px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
          </style>
        </head>
        <body>
          <div class="page receipt-page">
            <!-- Header -->
            <div class="doc-header">
              <div class="school-brand">
                <div class="school-info">
                  <div class="school-name">${escapeHtml(schoolName)}</div>
                  ${schoolAddress ? `<div class="school-sub">${escapeHtml(schoolAddress)}</div>` : ''}
                  ${SCHOOL_RECOGNITION_LINE ? `<div class="school-reg">${SCHOOL_RECOGNITION_LINE}</div>` : ''}
                  ${schoolPhone || schoolWebsite ? `
                    <div class="school-sub">
                      ${schoolPhone ? `Phone: ${escapeHtml(schoolPhone)}` : ''}
                      ${schoolPhone && schoolWebsite ? ' &nbsp;|&nbsp; ' : ''}
                      ${schoolWebsite ? `Web: ${escapeHtml(schoolWebsite)}` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div class="doc-title-block">
                <div class="doc-title" style="color: ${primaryColor};">${escapeHtml(voucherTitle)}</div>
                <div class="doc-no">Voucher No: ${escapeHtml(receiptNo)}</div>
              </div>
            </div>

            <!-- Info grid -->
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">Student Details</div>
                <div class="info-value">${escapeHtml(studentName)}</div>
                <div class="info-sub">Adm No: ${escapeHtml(admissionNo)} | Class: ${escapeHtml(classSectionText)}</div>
              </div>
              <div class="info-box highlight" style="background: ${highlightBg}; border-color: ${highlightBorder};">
                <div class="info-label" style="color: ${primaryDark};">Voucher Details</div>
                <div class="info-value">Date: ${escapeHtml(dateFull)}</div>
                <div class="info-sub">Adjustment Type: ${escapeHtml(typeLabel)}</div>
                <div class="info-sub">Status: Approved by Higher Authority</div>
              </div>
            </div>

            <!-- Receipt Banner -->
            <div class="receipt-banner" style="background: ${bannerGradient};">
              <div>
                <div class="receipt-banner-label">${escapeHtml(bannerLabel)}</div>
                <div class="receipt-banner-amount">${amountSign} ₹${amountFmt}</div>
              </div>
              <div class="receipt-banner-right">
                <div class="receipt-banner-label">Authorized by</div>
                <div class="receipt-banner-date" style="font-weight: 700;">Admin: ${escapeHtml(adjustment.adjusted_by_name)}</div>
              </div>
            </div>

            <!-- Amount in words -->
            <div class="amount-words" style="background: ${wordsBg}; border: 1px solid ${wordsBorder}; color: ${wordsColor};">
              <strong>Adjustment Amount in Words:</strong> Rupees ${words}
            </div>

            <!-- Table of adjusted items -->
            <table style="margin-top: 15px;">
              <thead>
                <tr>
                  <th style="color: ${primaryDark}; border-bottom-color: ${highlightBorder}; background: ${highlightBg};">Fee Component</th>
                  <th style="color: ${primaryDark}; border-bottom-color: ${highlightBorder}; background: ${highlightBg};">Adjustment Type</th>
                  <th style="text-align: right; color: ${primaryDark}; border-bottom-color: ${highlightBorder}; background: ${highlightBg};">Amount Adjusted</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="td-desc-main">${escapeHtml(adjustment.fee_component)}</td>
                  <td><span class="adjustment-badge">${escapeHtml(badgeLabel)}</span></td>
                  <td style="text-align: right; color: ${primaryColor};">${amountSign} ₹${amountFmt}</td>
                </tr>
              </tbody>
            </table>

            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-top: 15px; margin-bottom: 20px;">
              <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #4B5563; margin-bottom: 4px;">Reason for Adjustment</div>
              <div style="font-size: 11px; color: #1F2937; line-height: 1.5; font-style: italic;">
                "${escapeHtml(adjustment.reason)}"
              </div>
            </div>

            <!-- Signature row -->
            <div class="signature-row" style="margin-top: 25px;">
              <div>
                <div style="font-size: 9px; color: #9CA3AF; margin-bottom: 4px;">SCAN TO VERIFY</div>
                <div class="qr-placeholder">QR<br/>Verify</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Authorized Signatory</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Higher Authority Stamp</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="doc-footer">
              <p>📄 This is a secure system-generated document. No manual signature is required.</p>
              <p style="margin-top: 3px;">Generated on ${new Date().toLocaleString('en-IN')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      await printHtmlOnWeb(html);
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    throw error;
  }
};