import React, { useMemo, useState } from 'react';
import { BookOpen, FilePlus2, Plus, Search, Trash2, X } from 'lucide-react';
import { formatCurrencyINR, formatShortDate } from '../lib/validation';
import type { BillBook, BillRecord } from '../types/bill';

interface BillBooksSidebarProps {
  books: BillBook[];
  selectedBookId: string | null;
  billsInBook: BillRecord[];
  selectedBillId: string | null;
  isSignedIn: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSelectBook: (bookId: string) => void;
  onCreateBook: (title: string, workerPhone: string) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onSelectBill: (bill: BillRecord) => void;
  onNewBillCarryForward: () => void;
  onDeleteBill: (billId: string) => Promise<void>;
  onSignIn: () => void;
}

export const BillBooksSidebar: React.FC<BillBooksSidebarProps> = ({
  books,
  selectedBookId,
  billsInBook,
  selectedBillId,
  isSignedIn,
  isOpenMobile,
  onCloseMobile,
  onSelectBook,
  onCreateBook,
  onDeleteBook,
  onSelectBill,
  onNewBillCarryForward,
  onDeleteBill,
  onSignIn,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDeleteBookId, setConfirmDeleteBookId] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.workerPhone.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      await onCreateBook(trimmed, newPhone.trim());
      setNewTitle('');
      setNewPhone('');
      setShowNewForm(false);
    } finally {
      setCreating(false);
    }
  };

  const sidebarBody = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-[#0f4c81] shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            Bill Titles · ബിൽ ബുക്കുകൾ
          </h2>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close bill titles panel"
          className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sign in banner if guest */}
      {!isSignedIn && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Bills are saved on this device. Sign in with Google to sync your bill title database across devices.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="w-full py-2 px-3 text-xs font-medium text-white bg-[#0f4c81] rounded-lg hover:bg-[#0c3c66] transition-colors whitespace-nowrap"
          >
            Sign in with Google
          </button>
        </div>
      )}

      {/* Search + Add Bill Title */}
      <div className="p-3 space-y-2.5 border-b border-slate-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bill title..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0f4c81]"
          />
        </div>

        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="w-full min-h-[40px] py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-[#0f4c81] bg-[#eff6ff] hover:bg-[#dbeafe] rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Bill Title</span>
          </button>
        ) : (
          <form onSubmit={handleCreateSubmit} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. രാജൻ വല പണി)"
              maxLength={120}
              autoFocus
              required
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0f4c81]"
            />
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="WhatsApp number (optional)"
              maxLength={24}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0f4c81]"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="flex-1 py-1.5 px-3 text-xs font-medium text-white bg-[#0f4c81] rounded-md hover:bg-[#0c3c66] disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="py-1.5 px-2.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bill Books List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredBooks.length === 0 ? (
          <div className="p-5 text-center space-y-1.5">
            <p className="text-xs font-medium text-slate-600">
              {books.length === 0 ? 'No saved bill titles yet' : 'No matching bill title'}
            </p>
            <p className="text-xs text-slate-400">
              Create a title for each worker, boat, or team to track bills & balances.
            </p>
          </div>
        ) : (
          filteredBooks.map((book) => {
            const isSelected = book.id === selectedBookId;
            return (
              <div
                key={book.id}
                className={`transition-colors ${
                  isSelected ? 'bg-[#f0f6fc]' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBook(book.id);
                      onCloseMobile();
                    }}
                    className="flex-1 text-left min-w-0 py-0.5"
                  >
                    <p
                      className={`text-sm font-medium truncate ${
                        isSelected ? 'text-[#0f4c81]' : 'text-slate-900'
                      }`}
                    >
                      {book.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-tabular">
                      {book.billCount} {book.billCount === 1 ? 'bill' : 'bills'} · Bal{' '}
                      {formatCurrencyINR(book.latestNetBalance)}
                    </p>
                  </button>

                  {confirmDeleteBookId === book.id ? (
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteBook(book.id);
                          setConfirmDeleteBookId(null);
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteBookId(null)}
                        className="px-1.5 py-1 text-[11px] text-slate-500 hover:text-slate-800"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteBookId(book.id)}
                      aria-label={`Delete ${book.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bills History nested cleanly under selected title */}
                {isSelected && (
                  <div className="px-3 pb-3 pt-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        Saved Bills
                      </span>
                      <button
                        type="button"
                        onClick={onNewBillCarryForward}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0f4c81] hover:underline"
                      >
                        <FilePlus2 className="w-3 h-3" />
                        <span>New Bill (+ Prev Bal)</span>
                      </button>
                    </div>
                    <div className="space-y-1">
                      {billsInBook.map((bill) => {
                        const activeBill = bill.id === selectedBillId;
                        return (
                          <div
                            key={bill.id}
                            className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs border ${
                              activeBill
                                ? 'bg-white border-[#0f4c81]/40 text-[#0f4c81] font-medium'
                                : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectBill(bill);
                                onCloseMobile();
                              }}
                              className="flex-1 text-left flex items-center justify-between gap-2 min-w-0"
                            >
                              <span className="truncate font-tabular">
                                {formatShortDate(bill.billDate)}
                                {bill.billNumber ? ` #${bill.billNumber}` : ''}
                              </span>
                              <span className="font-tabular shrink-0">
                                {formatCurrencyINR(bill.netBalance)}
                              </span>
                            </button>
                            {billsInBook.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeleteBill(bill.id)}
                                aria-label="Delete bill"
                                className="p-1 text-slate-400 hover:text-red-600 shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-[276px] shrink-0 h-[calc(100vh-57px)] sticky top-[57px]">
        {sidebarBody}
      </aside>

      {/* Mobile slide-over drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative w-[300px] max-w-[85vw] h-full z-10 shadow-xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
};
