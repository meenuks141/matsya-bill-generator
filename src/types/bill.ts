export type LanguageMode = 'mixed' | 'ml' | 'en';

export interface BillBook {
  id: string;
  ownerId: string;
  title: string;
  workerPhone: string;
  notes: string;
  billCount: number;
  latestNetBalance: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BillRecord {
  id: string;
  bookId: string;
  ownerId: string;
  billTitle: string;
  billDate: string;
  billNumber: string;
  languageMode: LanguageMode;
  previousBalance: number;
  itemsTotal: number;
  varavuTotal: number;
  netBalance: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BillItemRow {
  id: string;
  date: string;
  details: string;
  price: number;
  sortOrder: number;
}

export interface VaravuRow {
  id: string;
  date: string;
  note: string;
  amount: number;
  sortOrder: number;
}

export interface BillDraft {
  id: string;
  bookId: string;
  billTitle: string;
  workerPhone: string;
  billDate: string;
  billNumber: string;
  languageMode: LanguageMode;
  previousBalance: number;
  notes: string;
  items: BillItemRow[];
  varavu: VaravuRow[];
}
