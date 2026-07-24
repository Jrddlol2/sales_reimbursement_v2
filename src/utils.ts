import Papa from 'papaparse';
import { Claim, Approval, User } from './types';
import { getStatusBadgeClass, getStatusConfig } from './statusConfig';

// Thin re-exports over statusConfig.ts (the single source of truth for
// status -> color/label/icon) kept for existing callers that need a raw
// class string or label instead of the <StatusBadge> component.
export const getStatusColor = getStatusBadgeClass;

// Canonical display label for a status, e.g. 'Ready for Claim' -> 'Ready to
// Claim', 'ReturnedForRevision' -> 'Returned for Revision'. <StatusBadge>
// already applies this by default — only call this directly when you need
// the bare label string outside a badge.
export const getStatusDisplayLabel = (status: string): string => getStatusConfig(status).label;

export const formatPHP = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};

// Single source of truth for date display — call sites otherwise reach for
// whichever toLocaleDateString/toLocaleString options are at hand, producing
// "7/24/2026" in one table and "July 24, 2026" in the next for the same kind
// of value. Defaults to a compact "Jul 24, 2026" form; pass `options` to
// override for a specific need (e.g. a "Month Year" grouping label).
export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Every claim gets a real claim_number once /api/claims persists it; this
// fallback only ever applies to a claim object that hasn't round-tripped
// through the server yet (there shouldn't be any in normal use, but it keeps
// display code crash-proof either way).
export const getClaimNumber = (claim: Pick<Claim, 'id' | 'claim_number'>): string =>
  claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;

// Resolves the approver's name and comment for a claim's most recent
// "Approved" decision, falling back to the currently assigned approver's
// name (no comment on file) if no Approved decision exists yet.
export const getApproverInfo = (
  claim: { approvals?: Approval[]; current_approver_id?: string },
  users: User[]
): { name: string; comment: string } => {
  const approvalRecord = (claim.approvals || []).slice().reverse().find(a => a.decision === 'Approved');
  if (approvalRecord) {
    const approver = users.find(u => u.id === approvalRecord.approver_id);
    return { name: approver?.name || 'Unknown Approver', comment: approvalRecord.comment || 'No comment provided.' };
  }
  const approver = users.find(u => u.id === claim.current_approver_id);
  return { name: approver?.name || 'Unknown Approver', comment: 'No comment on file.' };
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const userId = localStorage.getItem('mockUserId');
  const headers: Record<string, string> = {};
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    headers
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to upload file');
  }
  const data = await res.json();
  return data.url;
};


// TEMPORARY (Phase 0 interim upload access gate — see server.ts's
// /uploads/:filename route) — appends the current mock user id as a query
// param so direct browser resource loads (<img src>, <iframe src>,
// window.open, <a href>) still carry an identity the server can check, since
// those requests can't attach the X-User-Id header apiFetch() uses. Wrap any
// receipt/MOM attachment URL with this before handing it to the DOM. Safe to
// call on an already-external or empty URL — passes it through unchanged.
export const getUploadUrl = (url?: string | null): string => {
  if (!url || !url.startsWith('/uploads/')) return url || '';
  const userId = localStorage.getItem('mockUserId');
  if (!userId) return url;
  return `${url}?uid=${encodeURIComponent(userId)}`;
};

export const IS_DEMO_MODE = (import.meta as any).env?.VITE_IS_DEMO_MODE !== 'false';

// Shared by TransactionHistory and MyRequests — both export the same shape
// of unified request row, so the CSV-building logic lives in one place
// instead of two copies that could format columns differently over time.
export const exportRequestsToCSV = (
  items: { reference: string; type: string; status: string; amount: number; date: string }[],
  filename: string
) => {
  if (items.length === 0) return;
  const csv = Papa.unparse(items.map(item => ({
    Reference: item.reference,
    Type: item.type,
    Status: item.status,
    Amount: item.amount,
    Date: item.date ? item.date.substring(0, 10) : ''
  })));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
