import { toBlob, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { formatCurrencyINR, formatShortDate } from './validation';
import type { BillDraft } from '../types/bill';

export function buildBillFilename(draft: BillDraft, ext: 'png' | 'pdf' = 'png'): string {
  const slug = (draft.billTitle || 'matsya-bill')
    .toLowerCase()
    .replace(/[^a-z0-9\u0d00-\u0d7f]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const datePart = draft.billDate || new Date().toISOString().slice(0, 10);
  return `matsya-${slug || 'bill'}-${datePart}.${ext}`;
}

async function ensureFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

function getExportOptions(element: HTMLElement) {
  const width = Math.max(440, element.scrollWidth || element.offsetWidth || 460);
  const height = Math.max(200, element.scrollHeight || element.offsetHeight || 500);
  return {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor: '#fcfbf6',
    width,
    height,
    style: {
      margin: '0',
      transform: 'none',
      width: `${width}px`,
    },
  };
}

export async function captureBillBlob(element: HTMLElement): Promise<Blob> {
  await ensureFontsReady();
  const blob = await toBlob(element, getExportOptions(element));
  if (!blob) {
    throw new Error('Could not render bill image.');
  }
  return blob;
}

export async function downloadBillPdf(
  element: HTMLElement,
  draft: BillDraft
): Promise<void> {
  await ensureFontsReady();
  const options = getExportOptions(element);
  const dataUrl = await toPng(element, options);

  const pageWidthMm = 120;
  const pageHeightMm = Math.max(
    60,
    Math.round(((options.height / options.width) * pageWidthMm) * 10) / 10
  );

  const pdf = new jsPDF({
    orientation: pageHeightMm >= pageWidthMm ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    compress: true,
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
  pdf.save(buildBillFilename(draft, 'pdf'));
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function buildWhatsAppText(draft: BillDraft): string {
  const activeItems = draft.items.filter(
    (item) => item.details.trim().length > 0 || item.price > 0
  );
  const activeVaravu = draft.varavu.filter(
    (v) => v.note.trim().length > 0 || v.amount > 0
  );
  const itemsTotal = activeItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const prev = Number(draft.previousBalance) || 0;
  const gross = itemsTotal + prev;
  const varavuTotal = activeVaravu.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const net = gross - varavuTotal;

  const lines = [
    `*മത്സ്യ · Matsya*`,
    `${draft.billTitle || 'Bill'} (${formatShortDate(draft.billDate)})`,
    `Items Total: ${formatCurrencyINR(itemsTotal)}`,
  ];
  if (prev !== 0) {
    lines.push(`മുൻ ബാക്കി / Prev. Balance: ${formatCurrencyINR(prev)}`);
  }
  if (varavuTotal > 0) {
    lines.push(`വരവ് / Varavu (−): ${formatCurrencyINR(varavuTotal)}`);
  }
  lines.push(`*ബാക്കി / Net Balance: ${formatCurrencyINR(net)}*`);
  return lines.join('\n');
}

export function buildWhatsAppUrl(draft: BillDraft, phone?: string): string {
  const text = encodeURIComponent(buildWhatsAppText(draft));
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 10) {
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${normalized}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

export async function exportAndShareWhatsApp(
  element: HTMLElement,
  draft: BillDraft
): Promise<{
  mode: 'native-share' | 'downloaded';
  blob: Blob;
  filename: string;
  whatsappUrl: string;
}> {
  const blob = await captureBillBlob(element);
  const filename = buildBillFilename(draft, 'png');
  const file = new File([blob], filename, { type: 'image/png' });
  const whatsappUrl = buildWhatsAppUrl(draft, draft.workerPhone);

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${draft.billTitle || 'Matsya'} Bill`,
          text: buildWhatsAppText(draft),
        });
        return { mode: 'native-share', blob, filename, whatsappUrl };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { mode: 'native-share', blob, filename, whatsappUrl };
      }
    }
  }

  triggerBlobDownload(blob, filename);
  return { mode: 'downloaded', blob, filename, whatsappUrl };
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
