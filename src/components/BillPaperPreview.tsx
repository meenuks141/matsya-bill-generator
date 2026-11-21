import React from 'react';
import { BILL_LABELS } from '../lib/i18n';
import { formatCurrencyINR, formatShortDate } from '../lib/validation';
import type { BillDraft } from '../types/bill';

interface BillPaperPreviewProps {
  draft: BillDraft;
  paperRef?: React.RefObject<HTMLDivElement | null>;
  isExportSheet?: boolean;
}

export const BillPaperPreview: React.FC<BillPaperPreviewProps> = ({
  draft,
  paperRef,
  isExportSheet = false,
}) => {
  const labels = BILL_LABELS[draft.languageMode];

  const activeItems = draft.items.filter(
    (item) => item.details.trim().length > 0 || item.price > 0
  );
  const activeVaravu = draft.varavu.filter(
    (v) => v.note.trim().length > 0 || v.amount > 0
  );

  const itemsTotal = activeItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const previousBalance = Number(draft.previousBalance) || 0;
  const grossTotal = itemsTotal + previousBalance;
  const varavuTotal = activeVaravu.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const netBalance = grossTotal - varavuTotal;

  const sheetElement = (
    <div
      ref={paperRef}
      className={`ledger-paper ledger-margin-line relative w-full border border-[#d6d0c0] text-[#17253d] overflow-hidden select-none ${
        isExportSheet
          ? 'rounded-none shadow-none'
          : 'rounded-[4px] shadow-[0_6px_24px_rgba(15,23,42,0.08)]'
      }`}
    >
      {/* Top Notebook Header */}
      <div className="pl-12 pr-5 pt-5 pb-3 border-b-2 border-[#1e3a5f]/35">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-hand text-[24px] leading-tight text-[#0f3460] tracking-tight">
            {labels.brandTitle}
          </h2>
          {draft.billNumber.trim() ? (
            <span className="font-hand text-sm text-[#475569] tabular-nums">
              {labels.billNo} {draft.billNumber}
            </span>
          ) : null}
        </div>

        {/* Bill Title & Date */}
        <div className="mt-2.5 pt-2 border-t border-dashed border-[#1e3a5f]/20 flex items-baseline justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="font-hand text-[12px] text-[#526075] block">
              {labels.billFor}
            </span>
            <p className="font-hand text-[18px] text-[#0f172a] leading-snug break-words">
              {draft.billTitle.trim() || '—'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-hand text-[12px] text-[#526075] block">
              {labels.date}
            </span>
            <p className="font-hand text-[15px] text-[#17253d] tabular-nums">
              {formatShortDate(draft.billDate) || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Ruled Table: Date | Item Name/Details | Price */}
      <div className="pl-12 pr-5 pt-2 pb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#1e3a5f]/40">
              <th className="font-hand text-left text-[13px] font-normal text-[#475569] py-1.5 pr-2 w-[74px]">
                {labels.colDate}
              </th>
              <th className="font-hand text-left text-[13px] font-normal text-[#475569] py-1.5 pr-2">
                {labels.colItem}
              </th>
              <th className="font-hand text-right text-[13px] font-normal text-[#475569] py-1.5 w-[86px]">
                {labels.colPrice}
              </th>
            </tr>
          </thead>
          <tbody>
            {activeItems.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="font-hand text-[14px] text-[#64748b] py-5 text-center"
                >
                  {labels.emptyItems}
                </td>
              </tr>
            ) : (
              activeItems.map((item) => (
                <tr key={item.id} className="border-b border-[#1e3a5f]/12 align-top">
                  <td className="font-hand text-[13px] text-[#475569] py-2 pr-2 tabular-nums whitespace-nowrap">
                    {formatShortDate(item.date)}
                  </td>
                  <td className="font-hand text-[16px] text-[#17253d] py-1.5 pr-2 leading-snug break-words">
                    {item.details || '—'}
                  </td>
                  <td className="font-hand text-[16px] text-[#17253d] py-1.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrencyINR(Number(item.price) || 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals & Previous Balance */}
        <div className="mt-3 pt-2 border-t border-[#1e3a5f]/35 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-hand text-[15px] text-[#334155]">
              {labels.itemsSubtotal}
            </span>
            <span className="font-hand text-[17px] text-[#17253d] tabular-nums">
              {formatCurrencyINR(itemsTotal)}
            </span>
          </div>

          {previousBalance !== 0 && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-hand text-[15px] text-[#334155]">
                  {labels.prevBalance}
                </span>
                <span className="font-hand text-[16px] text-[#17253d] tabular-nums">
                  {previousBalance > 0
                    ? `+ ${formatCurrencyINR(previousBalance)}`
                    : formatCurrencyINR(previousBalance)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-dashed border-[#1e3a5f]/25">
                <span className="font-hand text-[16px] text-[#0f3460]">
                  {labels.grossTotal}
                </span>
                <span className="font-hand text-[18px] text-[#0f3460] tabular-nums">
                  {formatCurrencyINR(grossTotal)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Varavu Rows (Minused from Total) */}
        {activeVaravu.length > 0 && (
          <div className="mt-3 pt-2 border-t border-dashed border-[#1e3a5f]/30">
            <p className="font-hand text-[14px] text-[#7c2d12] mb-1">
              {labels.varavuHeading}
            </p>
            <div className="space-y-1">
              {activeVaravu.map((v) => (
                <div
                  key={v.id}
                  className="flex items-baseline justify-between gap-2 text-[#7c2d12]"
                >
                  <div className="min-w-0 flex-1 flex items-baseline gap-2">
                    {v.date ? (
                      <span className="font-hand text-[12px] text-[#9a3412]/80 tabular-nums shrink-0">
                        {formatShortDate(v.date)}
                      </span>
                    ) : null}
                    <span className="font-hand text-[15px] truncate">
                      {v.note.trim() || 'വരവ് / Varavu'}
                    </span>
                  </div>
                  <span className="font-hand text-[15px] tabular-nums shrink-0">
                    − {formatCurrencyINR(Number(v.amount) || 0)}
                  </span>
                </div>
              ))}
            </div>
            {activeVaravu.length > 1 && (
              <div className="flex items-baseline justify-between gap-2 mt-1.5 pt-1 border-t border-[#7c2d12]/20 text-[#7c2d12]">
                <span className="font-hand text-[14px]">{labels.varavuTotal}</span>
                <span className="font-hand text-[15px] tabular-nums">
                  − {formatCurrencyINR(varavuTotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Final Net Balance */}
        <div className="mt-4 pt-2.5 pb-1 border-t-2 border-b-2 border-[#0f3460]/55 flex items-baseline justify-between gap-3">
          <div>
            <span className="font-hand text-[18px] text-[#0f3460] block leading-tight">
              {labels.netBalance}
            </span>
            {netBalance < 0 && (
              <span className="font-hand text-[12px] text-[#15803d]">
                {labels.advanceCreditNote}
              </span>
            )}
          </div>
          <span className="font-hand text-[24px] text-[#0f3460] tabular-nums leading-none">
            {formatCurrencyINR(netBalance)}
          </span>
        </div>

        {/* Optional Notes */}
        {draft.notes.trim() ? (
          <div className="mt-3 pt-1">
            <p className="font-hand text-[13px] text-[#475569] leading-snug break-words">
              {labels.notesLabel}: {draft.notes}
            </p>
          </div>
        ) : null}

        {/* Minimal Footer */}
        <div className="mt-4 pt-2 flex items-center justify-between text-[11px] text-[#64748b] font-hand">
          <span>{labels.thankYou}</span>
          <span>{formatShortDate(draft.billDate)}</span>
        </div>
      </div>
    </div>
  );

  if (isExportSheet) {
    return sheetElement;
  }

  return <div className="w-full max-w-[460px] mx-auto">{sheetElement}</div>;
};
