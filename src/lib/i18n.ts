import { LanguageMode } from '../types/bill';

export interface BillLabels {
  brandTitle: string;
  billFor: string;
  date: string;
  billNo: string;
  colDate: string;
  colItem: string;
  colPrice: string;
  itemsSubtotal: string;
  prevBalance: string;
  grossTotal: string;
  varavuHeading: string;
  varavuTotal: string;
  netBalance: string;
  advanceCreditNote: string;
  notesLabel: string;
  emptyItems: string;
  thankYou: string;
}

export const BILL_LABELS: Record<LanguageMode, BillLabels> = {
  mixed: {
    brandTitle: 'മത്സ്യ · Matsya',
    billFor: 'പേര് / Bill Title',
    date: 'തീയതി / Date',
    billNo: 'നമ്പർ / No.',
    colDate: 'തീയതി',
    colItem: 'വിവരണം / Item',
    colPrice: 'തുക (₹)',
    itemsSubtotal: 'ആകെ തുക (Items Total)',
    prevBalance: 'മുൻ ബാക്കി (+ Prev. Balance)',
    grossTotal: 'മൊത്തം തുക (Total)',
    varavuHeading: 'വരവ് / Varavu (−)',
    varavuTotal: 'ആകെ വരവ് (Total Varavu)',
    netBalance: 'ബാക്കി തുക (Balance)',
    advanceCreditNote: 'അധിക വരവ് (Credit)',
    notesLabel: 'കുറിപ്പ് / Note',
    emptyItems: 'ഇനങ്ങൾ ചേർത്തിട്ടില്ല · No items added yet',
    thankYou: 'മത്സ്യ · Matsya',
  },
  ml: {
    brandTitle: 'മത്സ്യ',
    billFor: 'പേര് / വിഭാഗം',
    date: 'തീയതി',
    billNo: 'ബിൽ നം.',
    colDate: 'തീയതി',
    colItem: 'വിവരണം',
    colPrice: 'തുക (₹)',
    itemsSubtotal: 'ഇനങ്ങളുടെ ആകെ തുക',
    prevBalance: 'മുൻ ബാക്കി (+)',
    grossTotal: 'മൊത്തം തുക',
    varavuHeading: 'വരവ് വിവരങ്ങൾ (−)',
    varavuTotal: 'ആകെ വരവ് (−)',
    netBalance: 'നൽകാനുള്ള ബാക്കി',
    advanceCreditNote: 'ബാക്കി വരവ് (അധികം)',
    notesLabel: 'കുറിപ്പ്',
    emptyItems: 'ഇനങ്ങൾ ഒന്നും ചേർത്തിട്ടില്ല',
    thankYou: 'മത്സ്യ',
  },
  en: {
    brandTitle: 'Matsya',
    billFor: 'Bill Title',
    date: 'Date',
    billNo: 'Bill No.',
    colDate: 'Date',
    colItem: 'Item / Details',
    colPrice: 'Price (₹)',
    itemsSubtotal: 'Items Total',
    prevBalance: 'Previous Balance (+)',
    grossTotal: 'Grand Total',
    varavuHeading: 'Varavu / Deductions (−)',
    varavuTotal: 'Total Varavu (−)',
    netBalance: 'Net Balance',
    advanceCreditNote: 'Advance Credit',
    notesLabel: 'Note',
    emptyItems: 'No items added yet',
    thankYou: 'Matsya',
  },
};

export const QUICK_ITEM_PRESETS = [
  { label: 'പുതുവല', full: 'പുതുവല' },
  { label: 'ചെയിൻ', full: 'ചെയിൻ' },
  { label: 'ലെഡ്', full: 'ലെഡ്' },
  { label: 'പുതുവല + റോപ്പ്', full: 'പുതുവല + റോപ്പ്' },
  { label: 'പണിക്കൂലി', full: 'പണിക്കൂലി' },
  { label: 'റിപ്പയർ', full: 'റിപ്പയർ' },
  { label: 'വല', full: 'വല' },
  { label: 'കോഡന്റ്', full: 'കോഡന്റ്' },
  { label: 'മണി', full: 'മണി' },
  { label: 'കിളിവല', full: 'കിളിവല' },
];

export const QUICK_VARAVU_PRESETS = [
  { label: 'വരവ്', full: 'വരവ്' },
];
