# Matsya Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **User Isolation**: Every `BillBook`, `Bill`, `BillItem`, and `VaravuEntry` belongs strictly to `ownerId == request.auth.uid`.
2. **Master Gate**: Every `Bill`, `BillItem`, and `VaravuEntry` requires the parent `BillBook` to exist and be owned by `request.auth.uid`.
3. **Immutable Ownership & Genealogy**: `id`, `ownerId`, `bookId`, `billId`, and `createdAt` cannot be modified after creation.
4. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`.
6. **Strict Bounds & Schema**: Every string has bounded length; every document forbids unexpected shadow fields via `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Identity Spoofing**: Create `/billBooks/book1` with `ownerId: "other-uid"`.
2. **Unverified Email Write**: Create `/billBooks/book1` when `email_verified == false`.
3. **Shadow Field Injection**: Create `/billBooks/book1` with extra key `isAdmin: true`.
4. **ID Poisoning**: Create `/billBooks/..%2Fevil` or 200-char ID.
5. **Client Timestamp Tampering**: Create `/billBooks/book1` with `createdAt` != `request.time`.
6. **Ownership Transfer**: Update `/billBooks/book1` changing `ownerId` to another user.
7. **Orphaned Bill**: Create `/billBooks/nonexistent/bills/b1` where parent book does not exist.
8. **Cross-Tenant Subcollection Read**: `get` `/billBooks/victimBook/bills/b1` as attacker.
9. **Blanket List Scraping**: `list` `/billBooks` without `where("ownerId", "==", auth.uid)`.
10. **PII Leak**: `get` `/users/victimUid` by another authenticated user.
11. **Value Poisoning**: Update `/billBooks/book1` with `title` length > 120 chars or numeric `title`.
12. **Type Confusion on Language**: Create `/billBooks/book1/bills/b1` with `languageMode: "fr"`.
