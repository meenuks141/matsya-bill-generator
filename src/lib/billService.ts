import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BLUEPRINT_LIMITS,
  clampNonNegativeNumber,
  clampSignedNumber,
  generateSafeId,
  sanitizeId,
  truncateString,
} from './validation';
import type {
  BillBook,
  BillDraft,
  BillItemRow,
  BillRecord,
  LanguageMode,
  VaravuRow,
} from '../types/bill';

export async function upsertUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', sanitizeId(user.uid));
    const displayName = truncateString(
      user.displayName || 'Matsya User',
      BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
    );
    const email = truncateString(user.email || '', BLUEPRINT_LIMITS.EMAIL_MAX);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      await updateDoc(userRef, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        uid: sanitizeId(user.uid),
        displayName,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function getTimestampMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function subscribeToBillBooks(
  ownerId: string,
  onData: (books: BillBook[]) => void
): Unsubscribe {
  const path = 'billBooks';
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const books: BillBook[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? ownerId),
            title: String(data.title ?? ''),
            workerPhone: String(data.workerPhone ?? ''),
            notes: String(data.notes ?? ''),
            billCount: Number(data.billCount ?? 0),
            latestNetBalance: Number(data.latestNetBalance ?? 0),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
        .sort((a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt));
      onData(books);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToBillsInBook(
  bookId: string,
  ownerId: string,
  onData: (bills: BillRecord[]) => void
): Unsubscribe {
  const path = `billBooks/${bookId}/bills`;
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const bills: BillRecord[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            bookId: String(data.bookId ?? bookId),
            ownerId: String(data.ownerId ?? ownerId),
            billTitle: String(data.billTitle ?? ''),
            billDate: String(data.billDate ?? ''),
            billNumber: String(data.billNumber ?? ''),
            languageMode: (data.languageMode as LanguageMode) || 'mixed',
            previousBalance: Number(data.previousBalance ?? 0),
            itemsTotal: Number(data.itemsTotal ?? 0),
            varavuTotal: Number(data.varavuTotal ?? 0),
            netBalance: Number(data.netBalance ?? 0),
            notes: String(data.notes ?? ''),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
        .sort((a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt));
      onData(bills);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function fetchBillRows(
  bookId: string,
  billId: string,
  ownerId: string
): Promise<{ items: BillItemRow[]; varavu: VaravuRow[] }> {
  const itemsPath = `billBooks/${bookId}/bills/${billId}/items`;
  const varavuPath = `billBooks/${bookId}/bills/${billId}/varavu`;
  try {
    const [itemsSnap, varavuSnap] = await Promise.all([
      getDocs(query(collection(db, itemsPath), where('ownerId', '==', ownerId))),
      getDocs(query(collection(db, varavuPath), where('ownerId', '==', ownerId))),
    ]);

    const items: BillItemRow[] = itemsSnap.docs
      .map((d, idx) => {
        const data = d.data();
        return {
          id: d.id,
          date: String(data.date ?? ''),
          details: String(data.details ?? ''),
          price: Number(data.price ?? 0),
          sortOrder: Number(data.sortOrder ?? idx),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const varavu: VaravuRow[] = varavuSnap.docs
      .map((d, idx) => {
        const data = d.data();
        return {
          id: d.id,
          date: String(data.date ?? ''),
          note: String(data.note ?? ''),
          amount: Number(data.amount ?? 0),
          sortOrder: Number(data.sortOrder ?? idx),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return { items, varavu };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, itemsPath);
  }
}

function computeTotals(draft: BillDraft) {
  const itemsTotal = draft.items.reduce(
    (sum, item) => sum + clampNonNegativeNumber(item.price),
    0
  );
  const varavuTotal = draft.varavu.reduce(
    (sum, v) => sum + clampNonNegativeNumber(v.amount),
    0
  );
  const previousBalance = clampSignedNumber(draft.previousBalance);
  const netBalance = clampSignedNumber(itemsTotal + previousBalance - varavuTotal);
  return {
    itemsTotal: Math.round(itemsTotal * 100) / 100,
    varavuTotal: Math.round(varavuTotal * 100) / 100,
    previousBalance,
    netBalance,
  };
}

export async function createBillBookWithBill(
  ownerId: string,
  title: string,
  draft: BillDraft,
  workerPhone = ''
): Promise<{ bookId: string; billId: string }> {
  const safeOwnerId = sanitizeId(ownerId);
  const bookId = generateSafeId('book');
  const billId = generateSafeId('bill');
  const safeTitle =
    truncateString(title, BLUEPRINT_LIMITS.BOOK_TITLE_MAX) || 'Untitled Bill Book';
  const safePhone = truncateString(workerPhone, BLUEPRINT_LIMITS.WORKER_PHONE_MAX);
  const totals = computeTotals(draft);

  const bookPath = `billBooks/${bookId}`;
  try {
    await setDoc(doc(db, 'billBooks', bookId), {
      id: bookId,
      ownerId: safeOwnerId,
      title: safeTitle,
      workerPhone: safePhone,
      notes: '',
      billCount: 1,
      latestNetBalance: totals.netBalance,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, bookPath);
  }

  const billPath = `billBooks/${bookId}/bills/${billId}`;
  try {
    await setDoc(doc(db, 'billBooks', bookId, 'bills', billId), {
      id: billId,
      bookId,
      ownerId: safeOwnerId,
      billTitle: safeTitle,
      billDate: truncateString(draft.billDate, BLUEPRINT_LIMITS.DATE_MAX) || new Date().toISOString().slice(0, 10),
      billNumber: truncateString(draft.billNumber, BLUEPRINT_LIMITS.BILL_NUMBER_MAX),
      languageMode: BLUEPRINT_LIMITS.LANGUAGE_MODES.includes(draft.languageMode)
        ? draft.languageMode
        : 'mixed',
      previousBalance: totals.previousBalance,
      itemsTotal: totals.itemsTotal,
      varavuTotal: totals.varavuTotal,
      netBalance: totals.netBalance,
      notes: truncateString(draft.notes, BLUEPRINT_LIMITS.BILL_NOTES_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, billPath);
  }

  await syncBillSubcollections(bookId, billId, safeOwnerId, draft.items, draft.varavu);
  return { bookId, billId };
}

export async function createNewBillInBook(
  ownerId: string,
  bookId: string,
  draft: BillDraft,
  nextBillCount: number
): Promise<string> {
  const safeOwnerId = sanitizeId(ownerId);
  const safeBookId = sanitizeId(bookId);
  const billId = generateSafeId('bill');
  const totals = computeTotals(draft);
  const safeTitle =
    truncateString(draft.billTitle, BLUEPRINT_LIMITS.BILL_TITLE_MAX) || 'Bill';

  const billPath = `billBooks/${safeBookId}/bills/${billId}`;
  try {
    await setDoc(doc(db, 'billBooks', safeBookId, 'bills', billId), {
      id: billId,
      bookId: safeBookId,
      ownerId: safeOwnerId,
      billTitle: safeTitle,
      billDate: truncateString(draft.billDate, BLUEPRINT_LIMITS.DATE_MAX) || new Date().toISOString().slice(0, 10),
      billNumber: truncateString(draft.billNumber, BLUEPRINT_LIMITS.BILL_NUMBER_MAX),
      languageMode: BLUEPRINT_LIMITS.LANGUAGE_MODES.includes(draft.languageMode)
        ? draft.languageMode
        : 'mixed',
      previousBalance: totals.previousBalance,
      itemsTotal: totals.itemsTotal,
      varavuTotal: totals.varavuTotal,
      netBalance: totals.netBalance,
      notes: truncateString(draft.notes, BLUEPRINT_LIMITS.BILL_NOTES_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'billBooks', safeBookId), {
      billCount: Math.max(1, nextBillCount),
      latestNetBalance: totals.netBalance,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, billPath);
  }

  await syncBillSubcollections(safeBookId, billId, safeOwnerId, draft.items, draft.varavu);
  return billId;
}

export async function saveExistingBill(
  ownerId: string,
  draft: BillDraft,
  bookTitle?: string,
  workerPhone?: string
): Promise<void> {
  const safeOwnerId = sanitizeId(ownerId);
  const safeBookId = sanitizeId(draft.bookId);
  const safeBillId = sanitizeId(draft.id);
  const totals = computeTotals(draft);
  const safeTitle =
    truncateString(draft.billTitle, BLUEPRINT_LIMITS.BILL_TITLE_MAX) || 'Bill';

  const billPath = `billBooks/${safeBookId}/bills/${safeBillId}`;
  try {
    await updateDoc(doc(db, 'billBooks', safeBookId, 'bills', safeBillId), {
      billTitle: safeTitle,
      billDate: truncateString(draft.billDate, BLUEPRINT_LIMITS.DATE_MAX) || new Date().toISOString().slice(0, 10),
      billNumber: truncateString(draft.billNumber, BLUEPRINT_LIMITS.BILL_NUMBER_MAX),
      languageMode: BLUEPRINT_LIMITS.LANGUAGE_MODES.includes(draft.languageMode)
        ? draft.languageMode
        : 'mixed',
      previousBalance: totals.previousBalance,
      itemsTotal: totals.itemsTotal,
      varavuTotal: totals.varavuTotal,
      netBalance: totals.netBalance,
      notes: truncateString(draft.notes, BLUEPRINT_LIMITS.BILL_NOTES_MAX),
      updatedAt: serverTimestamp(),
    });

    const bookUpdates: Record<string, unknown> = {
      latestNetBalance: totals.netBalance,
      updatedAt: serverTimestamp(),
    };
    if (bookTitle !== undefined) {
      bookUpdates.title =
        truncateString(bookTitle, BLUEPRINT_LIMITS.BOOK_TITLE_MAX) || safeTitle;
    }
    if (workerPhone !== undefined) {
      bookUpdates.workerPhone = truncateString(
        workerPhone,
        BLUEPRINT_LIMITS.WORKER_PHONE_MAX
      );
    }
    await updateDoc(doc(db, 'billBooks', safeBookId), bookUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, billPath);
  }

  await syncBillSubcollections(safeBookId, safeBillId, safeOwnerId, draft.items, draft.varavu);
}

async function syncBillSubcollections(
  bookId: string,
  billId: string,
  ownerId: string,
  items: BillItemRow[],
  varavu: VaravuRow[]
): Promise<void> {
  const itemsPath = `billBooks/${bookId}/bills/${billId}/items`;
  const varavuPath = `billBooks/${bookId}/bills/${billId}/varavu`;

  try {
    const [existingItemsSnap, existingVaravuSnap] = await Promise.all([
      getDocs(query(collection(db, itemsPath), where('ownerId', '==', ownerId))),
      getDocs(query(collection(db, varavuPath), where('ownerId', '==', ownerId))),
    ]);

    const existingItemIds = new Set(existingItemsSnap.docs.map((d) => d.id));
    const existingVaravuIds = new Set(existingVaravuSnap.docs.map((d) => d.id));

    const validItems = items.filter(
      (item) => item.details.trim().length > 0 || clampNonNegativeNumber(item.price) > 0
    );
    const validVaravu = varavu.filter(
      (v) => v.note.trim().length > 0 || clampNonNegativeNumber(v.amount) > 0
    );

    const nextItemIds = new Set(validItems.map((i) => sanitizeId(i.id)));
    const nextVaravuIds = new Set(validVaravu.map((v) => sanitizeId(v.id)));

    const batch = writeBatch(db);

    for (const oldId of existingItemIds) {
      if (!nextItemIds.has(oldId)) {
        batch.delete(doc(db, itemsPath, oldId));
      }
    }
    for (const oldId of existingVaravuIds) {
      if (!nextVaravuIds.has(oldId)) {
        batch.delete(doc(db, varavuPath, oldId));
      }
    }

    validItems.forEach((item, index) => {
      const safeItemId = sanitizeId(item.id);
      const itemRef = doc(db, itemsPath, safeItemId);
      const safeDetails =
        truncateString(item.details, BLUEPRINT_LIMITS.ITEM_DETAILS_MAX) || 'Item';
      const safeDate = truncateString(item.date, BLUEPRINT_LIMITS.DATE_MAX);
      const safePrice = clampNonNegativeNumber(item.price);

      if (existingItemIds.has(safeItemId)) {
        batch.update(itemRef, {
          date: safeDate,
          details: safeDetails,
          price: safePrice,
          sortOrder: index,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(itemRef, {
          id: safeItemId,
          bookId,
          billId,
          ownerId,
          date: safeDate,
          details: safeDetails,
          price: safePrice,
          sortOrder: index,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    validVaravu.forEach((v, index) => {
      const safeVaravuId = sanitizeId(v.id);
      const varavuRef = doc(db, varavuPath, safeVaravuId);
      const safeNote = truncateString(v.note, BLUEPRINT_LIMITS.VARAVU_NOTE_MAX);
      const safeDate = truncateString(v.date, BLUEPRINT_LIMITS.DATE_MAX);
      const safeAmount = clampNonNegativeNumber(v.amount);

      if (existingVaravuIds.has(safeVaravuId)) {
        batch.update(varavuRef, {
          date: safeDate,
          note: safeNote,
          amount: safeAmount,
          sortOrder: index,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(varavuRef, {
          id: safeVaravuId,
          bookId,
          billId,
          ownerId,
          date: safeDate,
          note: safeNote,
          amount: safeAmount,
          sortOrder: index,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, itemsPath);
  }
}

export async function deleteBillBookCascade(bookId: string, ownerId: string): Promise<void> {
  const safeBookId = sanitizeId(bookId);
  const billsPath = `billBooks/${safeBookId}/bills`;
  try {
    const billsSnap = await getDocs(
      query(collection(db, billsPath), where('ownerId', '==', ownerId))
    );
    for (const billDoc of billsSnap.docs) {
      await deleteBillCascade(safeBookId, billDoc.id, ownerId, false);
    }
    await deleteDoc(doc(db, 'billBooks', safeBookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `billBooks/${safeBookId}`);
  }
}

export async function deleteBillCascade(
  bookId: string,
  billId: string,
  ownerId: string,
  updateBookCount = true,
  remainingCount = 0
): Promise<void> {
  const safeBookId = sanitizeId(bookId);
  const safeBillId = sanitizeId(billId);
  const itemsPath = `billBooks/${safeBookId}/bills/${safeBillId}/items`;
  const varavuPath = `billBooks/${safeBookId}/bills/${safeBillId}/varavu`;
  try {
    const [itemsSnap, varavuSnap] = await Promise.all([
      getDocs(query(collection(db, itemsPath), where('ownerId', '==', ownerId))),
      getDocs(query(collection(db, varavuPath), where('ownerId', '==', ownerId))),
    ]);

    const batch = writeBatch(db);
    itemsSnap.docs.forEach((d) => batch.delete(d.ref));
    varavuSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'billBooks', safeBookId, 'bills', safeBillId));
    await batch.commit();

    if (updateBookCount) {
      await updateDoc(doc(db, 'billBooks', safeBookId), {
        billCount: Math.max(0, remainingCount),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `billBooks/${safeBookId}/bills/${safeBillId}`
    );
  }
}
