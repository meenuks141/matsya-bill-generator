import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FilePlus2,
  LogIn,
  LogOut,
  Save,
  Share2,
} from 'lucide-react';
import { BillBooksSidebar } from './components/BillBooksSidebar';
import { BillEditorForm } from './components/BillEditorForm';
import { BillPaperPreview } from './components/BillPaperPreview';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  createBillBookWithBill,
  createNewBillInBook,
  deleteBillBookCascade,
  deleteBillCascade,
  fetchBillRows,
  saveExistingBill,
  subscribeToBillBooks,
  subscribeToBillsInBook,
  upsertUserProfile,
} from './lib/billService';
import {
  buildBillFilename,
  captureBillBlob,
  copyBlobToClipboard,
  downloadBillPdf,
  exportAndShareWhatsApp,
  triggerBlobDownload,
} from './lib/exportBillImage';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';
import { clampNonNegativeNumber, clampSignedNumber, generateSafeId } from './lib/validation';
import type { BillBook, BillDraft, BillRecord, LanguageMode } from './types/bill';

const LOCAL_STORAGE_KEY = 'matsya_local_ledger_v1';

interface LocalStoreData {
  books: BillBook[];
  billsByBook: Record<string, BillDraft[]>;
  selectedBookId: string | null;
  selectedBillId: string | null;
}

function createEmptyDraft(
  bookId = 'local_book_1',
  title = '',
  previousBalance = 0,
  workerPhone = '',
  languageMode: LanguageMode = 'mixed'
): BillDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: generateSafeId('bill'),
    bookId,
    billTitle: title,
    workerPhone,
    billDate: today,
    billNumber: '',
    languageMode,
    previousBalance,
    notes: '',
    items: [
      {
        id: generateSafeId('item'),
        date: today,
        details: '',
        price: 0,
        sortOrder: 0,
      },
    ],
    varavu: [],
  };
}

function computeDraftTotals(draft: BillDraft) {
  const itemsTotal = draft.items.reduce(
    (sum, item) => sum + clampNonNegativeNumber(item.price),
    0
  );
  const previousBalance = clampSignedNumber(draft.previousBalance);
  const varavuTotal = draft.varavu.reduce(
    (sum, v) => sum + clampNonNegativeNumber(v.amount),
    0
  );
  const netBalance = clampSignedNumber(itemsTotal + previousBalance - varavuTotal);
  return { itemsTotal, varavuTotal, previousBalance, netBalance };
}

function loadLocalStore(): LocalStoreData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStoreData;
      if (parsed && Array.isArray(parsed.books)) {
        return parsed;
      }
    }
  } catch {
    // Ignore invalid storage
  }
  const initialBookId = generateSafeId('book');
  const initialDraft = createEmptyDraft(initialBookId, 'രാജൻ വല പണി', 0, '', 'mixed');
  const initialBook: BillBook = {
    id: initialBookId,
    ownerId: 'local',
    title: 'രാജൻ വല പണി',
    workerPhone: '',
    notes: '',
    billCount: 1,
    latestNetBalance: 0,
  };
  return {
    books: [initialBook],
    billsByBook: { [initialBookId]: [initialDraft] },
    selectedBookId: initialBookId,
    selectedBillId: initialDraft.id,
  };
}

function MatsyaWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Local fallback store when guest
  const [localStore, setLocalStore] = useState<LocalStoreData>(() => loadLocalStore());

  // Firestore store when signed in
  const [cloudBooks, setCloudBooks] = useState<BillBook[]>([]);
  const [cloudBills, setCloudBills] = useState<BillRecord[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(
    () => loadLocalStore().selectedBookId
  );
  const [selectedBillId, setSelectedBillId] = useState<string | null>(
    () => loadLocalStore().selectedBillId
  );

  const [draft, setDraft] = useState<BillDraft>(() => {
    const initial = loadLocalStore();
    const bId = initial.selectedBookId;
    if (bId && initial.billsByBook[bId]?.length) {
      return (
        initial.billsByBook[bId].find((b) => b.id === initial.selectedBillId) ||
        initial.billsByBook[bId][0]
      );
    }
    return createEmptyDraft();
  });

  const [isCloudBillPersisted, setIsCloudBillPersisted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  // Export & WhatsApp feedback state
  const [exporting, setExporting] = useState(false);
  const [whatsappSheet, setWhatsappSheet] = useState<{
    filename: string;
    whatsappUrl: string;
    blob: Blob;
    copied: boolean;
  } | null>(null);

  const paperRef = useRef<HTMLDivElement | null>(null);
  const exportPaperRef = useRef<HTMLDivElement | null>(null);
  const editorSectionRef = useRef<HTMLDivElement | null>(null);
  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  // Persist local store when guest
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localStore));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [localStore, user]);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await upsertUserProfile(nextUser);
        } catch (err) {
          console.error(err);
        }
      } else {
        setCloudBooks([]);
        setCloudBills([]);
        setIsCloudBillPersisted(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore BillBooks when signed in
  useEffect(() => {
    if (!authReady || !user) return;
    const unsub = subscribeToBillBooks(user.uid, (books) => {
      setCloudBooks(books);
      setSelectedBookId((prev) => {
        if (prev && books.some((b) => b.id === prev)) return prev;
        return books[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [authReady, user]);

  // Subscribe to Bills in selected BillBook when signed in
  useEffect(() => {
    if (!authReady || !user || !selectedBookId) {
      if (user) setCloudBills([]);
      return;
    }
    const unsub = subscribeToBillsInBook(selectedBookId, user.uid, (bills) => {
      setCloudBills(bills);
      setSelectedBillId((prev) => {
        if (prev && bills.some((b) => b.id === prev)) return prev;
        return bills[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [authReady, user, selectedBookId]);

  // Load selected cloud bill rows when selectedBillId changes
  const activeBook = useMemo(() => {
    const list = user ? cloudBooks : localStore.books;
    return list.find((b) => b.id === selectedBookId) ?? null;
  }, [user, cloudBooks, localStore.books, selectedBookId]);

  const billsForSidebar: BillRecord[] = useMemo(() => {
    if (user) return cloudBills;
    if (!selectedBookId) return [];
    return (localStore.billsByBook[selectedBookId] || []).map((d) => {
      const totals = computeDraftTotals(d);
      return {
        id: d.id,
        bookId: d.bookId,
        ownerId: 'local',
        billTitle: d.billTitle,
        billDate: d.billDate,
        billNumber: d.billNumber,
        languageMode: d.languageMode,
        previousBalance: totals.previousBalance,
        itemsTotal: totals.itemsTotal,
        varavuTotal: totals.varavuTotal,
        netBalance: totals.netBalance,
        notes: d.notes,
      };
    });
  }, [user, cloudBills, localStore.billsByBook, selectedBookId]);

  // Load bill details from Firestore when user clicks a saved bill
  const loadCloudBill = useCallback(
    async (bill: BillRecord, bookPhone = '') => {
      if (!user) return;
      const rows = await fetchBillRows(bill.bookId, bill.id, user.uid);
      setDraft({
        id: bill.id,
        bookId: bill.bookId,
        billTitle: bill.billTitle,
        workerPhone: bookPhone,
        billDate: bill.billDate,
        billNumber: bill.billNumber,
        languageMode: bill.languageMode || 'mixed',
        previousBalance: bill.previousBalance,
        notes: bill.notes,
        items:
          rows.items.length > 0
            ? rows.items
            : [
                {
                  id: generateSafeId('item'),
                  date: bill.billDate,
                  details: '',
                  price: 0,
                  sortOrder: 0,
                },
              ],
        varavu: rows.varavu,
      });
      setIsCloudBillPersisted(true);
      setDirty(false);
    },
    [user]
  );

  useEffect(() => {
    if (!user || !selectedBillId || !selectedBookId) return;
    const match = cloudBills.find((b) => b.id === selectedBillId);
    if (!match) return;
    if (draft.id === match.id && isCloudBillPersisted) return;
    void loadCloudBill(match, activeBook?.workerPhone || '');
  }, [
    user,
    selectedBillId,
    selectedBookId,
    cloudBills,
    activeBook?.workerPhone,
    draft.id,
    isCloudBillPersisted,
    loadCloudBill,
  ]);

  // Previous bill's closing balance (to offer quick carry-forward)
  const previousBillClosingBalance = useMemo(() => {
    if (billsForSidebar.length === 0) return null;
    const otherBills = billsForSidebar.filter((b) => b.id !== draft.id);
    if (otherBills.length === 0) return null;
    return otherBills[0].netBalance;
  }, [billsForSidebar, draft.id]);

  // Update draft handler (also updates local store if guest)
  const handleDraftChange = useCallback(
    (updater: (prev: BillDraft) => BillDraft) => {
      setDraft((prev) => {
        const next = updater(prev);
        if (!user) {
          setLocalStore((store) => {
            const bookId = next.bookId;
            const existingList = store.billsByBook[bookId] || [];
            const exists = existingList.some((b) => b.id === next.id);
            const updatedList = exists
              ? existingList.map((b) => (b.id === next.id ? next : b))
              : [next, ...existingList];
            const totals = computeDraftTotals(next);
            const updatedBooks = store.books.map((bk) =>
              bk.id === bookId
                ? {
                    ...bk,
                    title: next.billTitle || bk.title,
                    workerPhone: next.workerPhone,
                    billCount: updatedList.length,
                    latestNetBalance: totals.netBalance,
                  }
                : bk
            );
            return {
              ...store,
              books: updatedBooks,
              billsByBook: { ...store.billsByBook, [bookId]: updatedList },
            };
          });
        }
        return next;
      });
      setDirty(true);
      setSavedNotice(null);
    },
    [user]
  );

  // Save current bill to Firestore (or local confirmation)
  const handleSaveBill = useCallback(async () => {
    if (!user) {
      setDirty(false);
      setSavedNotice('Saved on device');
      setTimeout(() => setSavedNotice(null), 2500);
      return;
    }

    setSaving(true);
    try {
      const titleToUse = draft.billTitle.trim() || activeBook?.title || 'Untitled Bill';
      if (!selectedBookId || !cloudBooks.some((b) => b.id === selectedBookId)) {
        const { bookId, billId } = await createBillBookWithBill(
          user.uid,
          titleToUse,
          { ...draft, billTitle: titleToUse },
          draft.workerPhone
        );
        setSelectedBookId(bookId);
        setSelectedBillId(billId);
        setDraft((prev) => ({ ...prev, id: billId, bookId, billTitle: titleToUse }));
        setIsCloudBillPersisted(true);
      } else if (!isCloudBillPersisted) {
        const newBillId = await createNewBillInBook(
          user.uid,
          selectedBookId,
          { ...draft, billTitle: titleToUse },
          cloudBills.length + 1
        );
        setSelectedBillId(newBillId);
        setDraft((prev) => ({ ...prev, id: newBillId, bookId: selectedBookId }));
        setIsCloudBillPersisted(true);
      } else {
        await saveExistingBill(
          user.uid,
          { ...draft, billTitle: titleToUse },
          titleToUse,
          draft.workerPhone
        );
      }
      setDirty(false);
      setSavedNotice('Saved');
      setTimeout(() => setSavedNotice(null), 2500);
    } finally {
      setSaving(false);
    }
  }, [
    user,
    draft,
    activeBook?.title,
    selectedBookId,
    cloudBooks,
    isCloudBillPersisted,
    cloudBills.length,
  ]);

  // Debounced auto-save when signed in and editing an existing cloud bill
  useEffect(() => {
    if (!user || !isCloudBillPersisted || !dirty || saving) return;
    const timer = setTimeout(() => {
      void handleSaveBill();
    }, 1400);
    return () => clearTimeout(timer);
  }, [user, isCloudBillPersisted, dirty, saving, handleSaveBill]);

  const handleCreateBook = async (title: string, workerPhone: string) => {
    if (user) {
      const freshDraft = createEmptyDraft('pending', title, 0, workerPhone, draft.languageMode);
      const { bookId, billId } = await createBillBookWithBill(
        user.uid,
        title,
        freshDraft,
        workerPhone
      );
      setSelectedBookId(bookId);
      setSelectedBillId(billId);
      setDraft({ ...freshDraft, id: billId, bookId });
      setIsCloudBillPersisted(true);
      setDirty(false);
    } else {
      const newBookId = generateSafeId('book');
      const freshDraft = createEmptyDraft(newBookId, title, 0, workerPhone, draft.languageMode);
      const newBook: BillBook = {
        id: newBookId,
        ownerId: 'local',
        title,
        workerPhone,
        notes: '',
        billCount: 1,
        latestNetBalance: 0,
      };
      setLocalStore((store) => ({
        books: [newBook, ...store.books],
        billsByBook: { ...store.billsByBook, [newBookId]: [freshDraft] },
        selectedBookId: newBookId,
        selectedBillId: freshDraft.id,
      }));
      setSelectedBookId(newBookId);
      setSelectedBillId(freshDraft.id);
      setDraft(freshDraft);
      setDirty(false);
    }
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    if (user) {
      setIsCloudBillPersisted(false);
      setSelectedBillId(null);
    } else {
      const list = localStore.billsByBook[bookId] || [];
      const first = list[0];
      if (first) {
        setSelectedBillId(first.id);
        setDraft(first);
      } else {
        const bk = localStore.books.find((b) => b.id === bookId);
        const fresh = createEmptyDraft(bookId, bk?.title || '', 0, bk?.workerPhone || '');
        setSelectedBillId(fresh.id);
        setDraft(fresh);
      }
      setLocalStore((s) => ({
        ...s,
        selectedBookId: bookId,
        selectedBillId: first?.id ?? null,
      }));
    }
  };

  const handleSelectBill = (bill: BillRecord) => {
    setSelectedBillId(bill.id);
    if (user) {
      void loadCloudBill(bill, activeBook?.workerPhone || '');
    } else {
      const found = (localStore.billsByBook[bill.bookId] || []).find(
        (b) => b.id === bill.id
      );
      if (found) {
        setDraft(found);
        setLocalStore((s) => ({ ...s, selectedBillId: found.id }));
      }
    }
  };

  const handleNewBillCarryForward = async () => {
    const totals = computeDraftTotals(draft);
    const carryBalance = totals.netBalance;
    const targetBookId = selectedBookId || activeBook?.id || generateSafeId('book');
    const title = draft.billTitle.trim() || activeBook?.title || 'Bill';
    const freshDraft = createEmptyDraft(
      targetBookId,
      title,
      carryBalance,
      draft.workerPhone || activeBook?.workerPhone || '',
      draft.languageMode
    );

    if (user && selectedBookId) {
      const newBillId = await createNewBillInBook(
        user.uid,
        selectedBookId,
        freshDraft,
        cloudBills.length + 1
      );
      setSelectedBillId(newBillId);
      setDraft({ ...freshDraft, id: newBillId });
      setIsCloudBillPersisted(true);
      setDirty(false);
    } else {
      setLocalStore((store) => {
        const existing = store.billsByBook[targetBookId] || [];
        const updated = [freshDraft, ...existing];
        return {
          ...store,
          books: store.books.map((bk) =>
            bk.id === targetBookId
              ? { ...bk, billCount: updated.length, latestNetBalance: carryBalance }
              : bk
          ),
          billsByBook: { ...store.billsByBook, [targetBookId]: updated },
          selectedBookId: targetBookId,
          selectedBillId: freshDraft.id,
        };
      });
      setSelectedBillId(freshDraft.id);
      setDraft(freshDraft);
      setDirty(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (user) {
      await deleteBillBookCascade(bookId, user.uid);
      if (selectedBookId === bookId) {
        const remaining = cloudBooks.filter((b) => b.id !== bookId);
        setSelectedBookId(remaining[0]?.id ?? null);
        setSelectedBillId(null);
        setIsCloudBillPersisted(false);
        if (remaining.length === 0) {
          setDraft(createEmptyDraft());
        }
      }
    } else {
      setLocalStore((store) => {
        const remainingBooks = store.books.filter((b) => b.id !== bookId);
        const nextBillsMap = { ...store.billsByBook };
        delete nextBillsMap[bookId];
        const nextBookId =
          store.selectedBookId === bookId
            ? remainingBooks[0]?.id ?? null
            : store.selectedBookId;
        const nextBill =
          nextBookId && nextBillsMap[nextBookId]?.[0]
            ? nextBillsMap[nextBookId][0]
            : createEmptyDraft();
        if (store.selectedBookId === bookId) {
          setSelectedBookId(nextBookId);
          setSelectedBillId(nextBill.id);
          setDraft(nextBill);
        }
        return {
          books: remainingBooks,
          billsByBook: nextBillsMap,
          selectedBookId: nextBookId,
          selectedBillId: nextBookId ? nextBill.id : null,
        };
      });
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!selectedBookId) return;
    if (user) {
      const remaining = cloudBills.filter((b) => b.id !== billId);
      await deleteBillCascade(selectedBookId, billId, user.uid, true, remaining.length);
      if (selectedBillId === billId) {
        setSelectedBillId(remaining[0]?.id ?? null);
        setIsCloudBillPersisted(false);
      }
    } else {
      setLocalStore((store) => {
        const list = (store.billsByBook[selectedBookId] || []).filter(
          (b) => b.id !== billId
        );
        const nextBill = list[0] ?? createEmptyDraft(selectedBookId, activeBook?.title || '');
        if (selectedBillId === billId) {
          setSelectedBillId(nextBill.id);
          setDraft(nextBill);
        }
        return {
          ...store,
          billsByBook: { ...store.billsByBook, [selectedBookId]: list },
          selectedBillId: nextBill.id,
        };
      });
    }
  };

  const handleDownloadPng = async () => {
    const target = exportPaperRef.current ?? paperRef.current;
    if (!target || exporting) return;
    setExporting(true);
    try {
      const blob = await captureBillBlob(target);
      triggerBlobDownload(blob, buildBillFilename(draft, 'png'));
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    const target = exportPaperRef.current ?? paperRef.current;
    if (!target || exporting) return;
    setExporting(true);
    try {
      await downloadBillPdf(target, draft);
    } finally {
      setExporting(false);
    }
  };

  const handleWhatsAppShare = async () => {
    const target = exportPaperRef.current ?? paperRef.current;
    if (!target || exporting) return;
    setExporting(true);
    try {
      const result = await exportAndShareWhatsApp(target, draft);
      if (result.mode === 'downloaded') {
        const copied = await copyBlobToClipboard(result.blob);
        setWhatsappSheet({
          filename: result.filename,
          whatsappUrl: result.whatsappUrl,
          blob: result.blob,
          copied,
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In could not be completed.'
      );
    }
  };

  const displayedBooks = user ? cloudBooks : localStore.books;

  return (
    <div className="min-h-screen bg-[#f1f4f7] text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-[57px] bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open bill titles database"
            className="lg:hidden min-h-[40px] min-w-[40px] -ml-2 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-[#0f3460] whitespace-nowrap shrink-0"
          >
            Matsya · മത്സ്യ
          </a>
        </div>

        {/* Zone 2: Concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Bill Books
          </button>
          <button
            type="button"
            onClick={() =>
              editorSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Ledger Entry
          </button>
          <button
            type="button"
            onClick={() =>
              previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Photo Bill
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="min-h-[38px] px-3.5 py-1.5 inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span className="max-w-[120px] truncate">
                {user.displayName || user.email}
              </span>
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="min-h-[38px] px-4 py-2 inline-flex items-center gap-2 text-xs font-medium text-white bg-[#0f4c81] hover:bg-[#0c3c66] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </header>

      {authError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Layout: Sidebar + Workspace */}
      <div className="flex-1 flex min-h-0">
        <BillBooksSidebar
          books={displayedBooks}
          selectedBookId={selectedBookId}
          billsInBook={billsForSidebar}
          selectedBillId={selectedBillId}
          isSignedIn={Boolean(user)}
          isOpenMobile={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
          onSelectBook={handleSelectBook}
          onCreateBook={handleCreateBook}
          onDeleteBook={handleDeleteBook}
          onSelectBill={handleSelectBill}
          onNewBillCarryForward={handleNewBillCarryForward}
          onDeleteBill={handleDeleteBill}
          onSignIn={() => void handleSignIn()}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 xl:pb-8">
          <div className="max-w-[1160px] mx-auto space-y-5">
            {/* Workspace Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
              {/* Language Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'mixed', label: 'മലയാളം + Eng' },
                    { id: 'ml', label: 'മലയാളം' },
                    { id: 'en', label: 'English' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      handleDraftChange((prev) => ({
                        ...prev,
                        languageMode: opt.id,
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      draft.languageMode === opt.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Save & Export Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {savedNotice && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803d] mr-1">
                    <Check className="w-3.5 h-3.5" />
                    {savedNotice}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => void handleNewBillCarryForward()}
                  className="min-h-[38px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>New Bill (+ Prev)</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSaveBill()}
                  disabled={saving}
                  className="min-h-[38px] px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#0f4c81] bg-[#eff6ff] hover:bg-[#dbeafe] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDownloadPng()}
                  disabled={exporting}
                  className="min-h-[38px] px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDownloadPdf()}
                  disabled={exporting}
                  className="min-h-[38px] px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleWhatsAppShare()}
                  disabled={exporting}
                  className="min-h-[38px] px-4 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#15803d] hover:bg-[#166534] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp Photo</span>
                </button>
              </div>
            </div>

            {/* Desktop WhatsApp Share Companion Banner (after PNG download) */}
            {whatsappSheet && (
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[#14532d]">
                    Photo bill downloaded ({whatsappSheet.filename})
                  </p>
                  <p className="text-xs text-[#166534]">
                    {whatsappSheet.copied
                      ? 'Photo copied to clipboard! Open WhatsApp and paste (Ctrl+V / Cmd+V) or attach the downloaded file.'
                      : 'Attach the downloaded photo bill inside your WhatsApp chat.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyBlobToClipboard(whatsappSheet.blob);
                      setWhatsappSheet((s) => (s ? { ...s, copied: ok } : null));
                    }}
                    className="px-3 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#14532d] bg-white border border-[#86efac] rounded-lg hover:bg-[#dcfce7] whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{whatsappSheet.copied ? 'Copied' : 'Copy Image'}</span>
                  </button>
                  <a
                    href={whatsappSheet.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#15803d] hover:bg-[#166534] rounded-lg whitespace-nowrap"
                  >
                    <span>Open WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setWhatsappSheet(null)}
                    className="px-2 py-2 text-xs text-[#166534] hover:underline"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Mobile / Tablet View Toggle (< xl) */}
            <div className="xl:hidden flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setMobileTab('edit')}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                  mobileTab === 'edit'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                Edit Ledger · ബിൽ എഴുതുക
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                  mobileTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                Handwritten Bill Photo
              </button>
            </div>

            {/* Editor + Live Handwritten Paper Bill Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <section
                ref={editorSectionRef}
                className={`xl:col-span-7 ${
                  mobileTab === 'edit' ? 'block' : 'hidden xl:block'
                }`}
              >
                <BillEditorForm
                  draft={draft}
                  previousBillClosingBalance={previousBillClosingBalance}
                  onChange={handleDraftChange}
                />
              </section>

              <section
                ref={previewSectionRef}
                className={`xl:col-span-5 xl:sticky xl:top-[81px] ${
                  mobileTab === 'preview' ? 'block' : 'hidden xl:block'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-slate-500">
                      Live Photo Preview · വാട്‌സാപ്പ് ബിൽ
                    </span>
                    <span className="text-xs text-slate-400">
                      Ruled Paper Format
                    </span>
                  </div>
                  <BillPaperPreview draft={draft} paperRef={paperRef} />
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Offscreen full-width 460px sheet for crisp unclipped PNG/PDF/WhatsApp export */}
      <div
        aria-hidden="true"
        className="fixed -left-[10000px] top-0 w-[460px] pointer-events-none"
      >
        <BillPaperPreview draft={draft} paperRef={exportPaperRef} isExportSheet />
      </div>

      {/* Mobile Compact Bottom Action Bar (< 15% viewport height) */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDownloadPng()}
          disabled={exporting}
          className="min-h-[42px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg"
        >
          <Download className="w-4 h-4" />
          <span>PNG</span>
        </button>
        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          disabled={exporting}
          className="min-h-[42px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg"
        >
          <FileDown className="w-4 h-4" />
          <span>PDF</span>
        </button>
        <button
          type="button"
          onClick={() => void handleWhatsAppShare()}
          disabled={exporting}
          className="flex-1 min-h-[42px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-[#15803d] rounded-lg"
        >
          <Share2 className="w-4 h-4" />
          <span>WhatsApp Bill</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MatsyaWorkspace />
    </ErrorBoundary>
  );
}
