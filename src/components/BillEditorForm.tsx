import React from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { QUICK_ITEM_PRESETS, QUICK_VARAVU_PRESETS } from '../lib/i18n';
import {
  BLUEPRINT_LIMITS,
  clampNonNegativeNumber,
  clampSignedNumber,
  formatCurrencyINR,
  generateSafeId,
} from '../lib/validation';
import type { BillDraft, BillItemRow, VaravuRow } from '../types/bill';

interface BillEditorFormProps {
  draft: BillDraft;
  previousBillClosingBalance: number | null;
  onChange: (updater: (prev: BillDraft) => BillDraft) => void;
}

export const BillEditorForm: React.FC<BillEditorFormProps> = ({
  draft,
  previousBillClosingBalance,
  onChange,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const itemsTotal = draft.items.reduce(
    (sum, item) => sum + (Number(item.price) || 0),
    0
  );
  const previousBalance = Number(draft.previousBalance) || 0;
  const grossTotal = itemsTotal + previousBalance;
  const varavuTotal = draft.varavu.reduce(
    (sum, v) => sum + (Number(v.amount) || 0),
    0
  );
  const netBalance = grossTotal - varavuTotal;

  const updateItem = (id: string, patch: Partial<BillItemRow>) => {
    onChange((prev) => ({
      ...prev,
      items: prev.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  };

  const addItemRow = (details = '') => {
    onChange((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: generateSafeId('item'),
          date: prev.billDate || todayStr,
          details,
          price: 0,
          sortOrder: prev.items.length,
        },
      ],
    }));
  };

  const handleQuickItem = (label: string) => {
    onChange((prev) => {
      const emptyIndex = prev.items.findIndex(
        (i) => i.details.trim() === '' && Number(i.price) === 0
      );
      if (emptyIndex >= 0) {
        const updated = [...prev.items];
        updated[emptyIndex] = { ...updated[emptyIndex], details: label };
        return { ...prev, items: updated };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: generateSafeId('item'),
            date: prev.billDate || todayStr,
            details: label,
            price: 0,
            sortOrder: prev.items.length,
          },
        ],
      };
    });
  };

  const removeItemRow = (id: string) => {
    onChange((prev) => {
      const next = prev.items.filter((row) => row.id !== id);
      return {
        ...prev,
        items:
          next.length > 0
            ? next
            : [
                {
                  id: generateSafeId('item'),
                  date: prev.billDate || todayStr,
                  details: '',
                  price: 0,
                  sortOrder: 0,
                },
              ],
      };
    });
  };

  const updateVaravu = (id: string, patch: Partial<VaravuRow>) => {
    onChange((prev) => ({
      ...prev,
      varavu: prev.varavu.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  };

  const addVaravuRow = (note = '') => {
    onChange((prev) => ({
      ...prev,
      varavu: [
        ...prev.varavu,
        {
          id: generateSafeId('varavu'),
          date: prev.billDate || todayStr,
          note,
          amount: 0,
          sortOrder: prev.varavu.length,
        },
      ],
    }));
  };

  const handleQuickVaravu = (label: string) => {
    onChange((prev) => {
      const emptyIndex = prev.varavu.findIndex(
        (v) => v.note.trim() === '' && Number(v.amount) === 0
      );
      if (emptyIndex >= 0) {
        const updated = [...prev.varavu];
        updated[emptyIndex] = { ...updated[emptyIndex], note: label };
        return { ...prev, varavu: updated };
      }
      return {
        ...prev,
        varavu: [
          ...prev.varavu,
          {
            id: generateSafeId('varavu'),
            date: prev.billDate || todayStr,
            note: label,
            amount: 0,
            sortOrder: prev.varavu.length,
          },
        ],
      };
    });
  };

  const removeVaravuRow = (id: string) => {
    onChange((prev) => ({
      ...prev,
      varavu: prev.varavu.filter((row) => row.id !== id),
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-5">
      {/* Bill Header Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Bill Title · പേര് / വിഭാഗം
          </label>
          <input
            type="text"
            value={draft.billTitle}
            maxLength={BLUEPRINT_LIMITS.BILL_TITLE_MAX}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, billTitle: e.target.value }))
            }
            placeholder="ഉദാ: രാജൻ വല പണി / Rajan Boat"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#0f4c81]"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Bill Date · തീയതി
          </label>
          <input
            type="date"
            value={draft.billDate}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, billDate: e.target.value }))
            }
            className="w-full px-3 py-2 text-sm font-tabular bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#0f4c81]"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            WhatsApp No. (Optional)
          </label>
          <input
            type="tel"
            value={draft.workerPhone}
            maxLength={BLUEPRINT_LIMITS.WORKER_PHONE_MAX}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, workerPhone: e.target.value }))
            }
            placeholder="9847..."
            className="w-full px-3 py-2 text-sm font-tabular bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#0f4c81]"
          />
        </div>
      </div>

      {/* Quick Malayalam/English Tap-to-Insert Chips */}
      <div className="space-y-1.5">
        <span className="text-xs text-slate-500 block">
          Quick Add Item (തൊട്ട് ചേർക്കുക):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ITEM_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleQuickItem(preset.full)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-[#eff6ff] hover:text-[#0f4c81] rounded-md transition-colors whitespace-nowrap"
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Section: Date | Item Name or Details | Price */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Items · ഇനങ്ങൾ
          </h3>
          <span className="text-xs font-tabular text-slate-500">
            {draft.items.length} {draft.items.length === 1 ? 'row' : 'rows'}
          </span>
        </div>

        <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500">
          <div className="sm:col-span-3">Date · തീയതി</div>
          <div className="sm:col-span-6">Item Details · വിവരണം</div>
          <div className="sm:col-span-2 text-right">Price (₹)</div>
          <div className="sm:col-span-1" />
        </div>

        <div className="space-y-2">
          {draft.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 sm:bg-transparent p-2 sm:p-0 rounded-lg border border-slate-200 sm:border-0"
            >
              <input
                type="date"
                value={item.date}
                aria-label="Item date"
                onChange={(e) => updateItem(item.id, { date: e.target.value })}
                className="col-span-5 sm:col-span-3 px-2.5 py-2 text-xs font-tabular bg-white sm:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
              />
              <input
                type="text"
                value={item.details}
                maxLength={BLUEPRINT_LIMITS.ITEM_DETAILS_MAX}
                aria-label="Item name or details"
                placeholder="വിവരണം / Item details"
                onChange={(e) => updateItem(item.id, { details: e.target.value })}
                className="col-span-12 sm:col-span-6 order-first sm:order-none px-3 py-2 text-sm bg-white sm:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                aria-label="Item price"
                value={item.price === 0 ? '' : item.price}
                placeholder="0"
                onChange={(e) =>
                  updateItem(item.id, {
                    price:
                      e.target.value === ''
                        ? 0
                        : clampNonNegativeNumber(e.target.value),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItemRow();
                  }
                }}
                className="col-span-5 sm:col-span-2 px-2.5 py-2 text-sm text-right font-tabular bg-white sm:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
              />
              <button
                type="button"
                onClick={() => removeItemRow(item.id)}
                aria-label="Remove item row"
                className="col-span-2 sm:col-span-1 min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => addItemRow()}
          className="min-h-[40px] px-3 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#0f4c81] hover:bg-[#eff6ff] rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item Row · പുതിയ വരി</span>
        </button>
      </div>

      {/* Subtotal + Previous Bill Balance */}
      <div className="pt-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Items Total · ആകെ തുക</span>
          <span className="font-semibold font-tabular text-slate-900">
            {formatCurrencyINR(itemsTotal)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <label
              htmlFor="prev-balance-input"
              className="text-sm font-medium text-slate-800 block"
            >
              Previous Bill Balance · മുൻ ബാക്കി (+)
            </label>
            {previousBillClosingBalance !== null &&
              previousBillClosingBalance !== draft.previousBalance && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      previousBalance: previousBillClosingBalance,
                    }))
                  }
                  className="inline-flex items-center gap-1 text-xs text-[#0f4c81] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    Use last bill balance ({formatCurrencyINR(previousBillClosingBalance)})
                  </span>
                </button>
              )}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="prev-balance-input"
              type="number"
              inputMode="decimal"
              step="any"
              value={draft.previousBalance === 0 ? '' : draft.previousBalance}
              placeholder="0"
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  previousBalance:
                    e.target.value === '' ? 0 : clampSignedNumber(e.target.value),
                }))
              }
              className="w-32 px-3 py-2 text-sm text-right font-tabular bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
            />
            {draft.previousBalance !== 0 && (
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, previousBalance: 0 }))}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm pt-2 border-t border-dashed border-slate-200">
          <span className="font-medium text-slate-800">
            Total with Previous Balance · മൊത്തം തുക
          </span>
          <span className="font-semibold font-tabular text-slate-900">
            {formatCurrencyINR(grossTotal)}
          </span>
        </div>
      </div>

      {/* Varavu Section (Multiple rows subtracted from total) */}
      <div className="pt-4 border-t border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Varavu · വരവ് (−)
            </h3>
            <p className="text-xs text-slate-500">
              Advances or cash received — automatically subtracted from total
            </p>
          </div>
          <span className="text-sm font-semibold font-tabular text-[#9a3412]">
            − {formatCurrencyINR(varavuTotal)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_VARAVU_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleQuickVaravu(preset.full)}
              className="px-2.5 py-1 text-xs font-medium text-[#7c2d12] bg-[#fff7ed] hover:bg-[#ffedd5] rounded-md transition-colors whitespace-nowrap"
            >
              + {preset.label}
            </button>
          ))}
        </div>

        {draft.varavu.length > 0 && (
          <div className="space-y-2">
            {draft.varavu.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-12 gap-2 items-center bg-[#fffaf5] sm:bg-transparent p-2 sm:p-0 rounded-lg border border-orange-200/70 sm:border-0"
              >
                <input
                  type="date"
                  value={v.date}
                  aria-label="Varavu date"
                  onChange={(e) => updateVaravu(v.id, { date: e.target.value })}
                  className="col-span-5 sm:col-span-3 px-2.5 py-2 text-xs font-tabular bg-white sm:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
                />
                <input
                  type="text"
                  value={v.note}
                  maxLength={BLUEPRINT_LIMITS.VARAVU_NOTE_MAX}
                  aria-label="Varavu details"
                  placeholder="വരവ് വിവരണം / Advance note"
                  onChange={(e) => updateVaravu(v.id, { note: e.target.value })}
                  className="col-span-12 sm:col-span-6 order-first sm:order-none px-3 py-2 text-sm bg-white sm:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  aria-label="Varavu amount"
                  value={v.amount === 0 ? '' : v.amount}
                  placeholder="0"
                  onChange={(e) =>
                    updateVaravu(v.id, {
                      amount:
                        e.target.value === ''
                          ? 0
                          : clampNonNegativeNumber(e.target.value),
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addVaravuRow();
                    }
                  }}
                  className="col-span-5 sm:col-span-2 px-2.5 py-2 text-sm text-right font-tabular bg-white sm:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
                />
                <button
                  type="button"
                  onClick={() => removeVaravuRow(v.id)}
                  aria-label="Remove varavu row"
                  className="col-span-2 sm:col-span-1 min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => addVaravuRow()}
          className="min-h-[40px] px-3 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#9a3412] hover:bg-[#fff7ed] rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Varavu Row · വരവ് ചേർക്കുക</span>
        </button>
      </div>

      {/* Optional Note & Net Balance Summary Bar */}
      <div className="pt-4 border-t border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Note · കുറിപ്പ് (Optional)
            </label>
            <input
              type="text"
              value={draft.notes}
              maxLength={BLUEPRINT_LIMITS.BILL_NOTES_MAX}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="ഉദാ: അടുത്ത ആഴ്ച തീർക്കാം / Boat #4"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Bill No. (Optional)
            </label>
            <input
              type="text"
              value={draft.billNumber}
              maxLength={BLUEPRINT_LIMITS.BILL_NUMBER_MAX}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, billNumber: e.target.value }))
              }
              placeholder="01"
              className="w-full px-3 py-2 text-sm font-tabular bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0f4c81]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#f0f6fc] border border-[#0f4c81]/20">
          <span className="text-sm font-semibold text-[#0f3460]">
            Net Balance · ബാക്കി തുക
          </span>
          <span className="text-xl font-bold font-tabular text-[#0f3460]">
            {formatCurrencyINR(netBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};
