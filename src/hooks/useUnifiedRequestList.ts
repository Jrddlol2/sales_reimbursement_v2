import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Claim, CashAdvance, Liquidation, User } from '../types';

export interface UnifiedRequestItem {
  id: string;
  reference: string;
  type: 'Reimbursement' | 'Cash Advance' | 'Liquidation';
  status: string;
  amount: number;
  date: string;
  path: string;
  requestorName?: string;
  approverName?: string;
}

/**
 * Fetches claims/cash advances/liquidations + users and builds one unified,
 * reverse-chronological request list — the same shape TransactionHistory and
 * MyRequests both need, so the fetch/scope/build logic lives in exactly one
 * place instead of two near-identical copies that could drift apart.
 *
 * @param scopeToUserId - when set, filters every list down to items where
 *   requestor_id/requestorId matches this id (the "my own submissions" case,
 *   used by MyRequests and by TransactionHistory for an Approver). Omit to
 *   keep whatever the /api/* endpoints already return for the caller's role
 *   (e.g. Custodian's system-wide transaction log).
 */
export interface UseUnifiedRequestListResult {
  items: UnifiedRequestItem[];
  loading: boolean;
  // Raw, scoped entities behind `items` — needed by callers that also
  // render registry-driven KPI cards (which compute off typed Claim[] /
  // CashAdvance[] / Liquidation[] shapes, not the flattened display row),
  // so they don't have to run a second, duplicate fetch of the same data.
  claims: Claim[];
  cashAdvances: CashAdvance[];
  liquidations: Liquidation[];
}

export function useUnifiedRequestList(scopeToUserId?: string): UseUnifiedRequestListResult {
  const [items, setItems] = useState<UnifiedRequestItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/claims'),
      apiFetch('/api/cash-advances'),
      apiFetch('/api/liquidations'),
      apiFetch('/api/users')
    ])
      .then(([claimsData, cadvsData, liqsData, usersData]: [Claim[], CashAdvance[], Liquidation[], User[]]) => {
        const ownClaims = scopeToUserId ? claimsData.filter(c => c.requestor_id === scopeToUserId) : claimsData;
        const ownCadvs = scopeToUserId ? cadvsData.filter((c: any) => c.requestorId === scopeToUserId) : cadvsData;
        const ownLiqs = scopeToUserId ? liqsData.filter((l: any) => l.requestorId === scopeToUserId) : liqsData;
        setClaims(ownClaims);
        setCashAdvances(ownCadvs);
        setLiquidations(ownLiqs);

        // The "waiting on whom" tag needs a person's name, not just the raw
        // *_id the list endpoints return — resolve both ends (requestor and
        // current approver) through one lookup map built from /api/users.
        const usersById = new Map(usersData.map(u => [u.id, u]));

        const unified: UnifiedRequestItem[] = [
          ...ownClaims.map(c => ({
            id: c.id,
            reference: c.claim_number || `REIM-${c.id.substring(0, 6)}`,
            type: 'Reimbursement' as const,
            status: c.status,
            amount: c.total_amount,
            date: c.created_at,
            path: `/claims/${c.id}`,
            requestorName: usersById.get(c.requestor_id)?.name,
            approverName: usersById.get(c.current_approver_id)?.name,
          })),
          ...ownCadvs.map((c: any) => ({
            id: c.id,
            reference: `CADV-${c.id.substring(0, 6)}`,
            type: 'Cash Advance' as const,
            status: c.status,
            amount: c.amount || 0,
            date: c.createdAt || c.releaseDate || '',
            path: `/cash-advances/${c.id}`,
            requestorName: usersById.get(c.requestorId)?.name,
            approverName: usersById.get(c.approverId)?.name,
          })),
          ...ownLiqs.map((l: any) => ({
            id: l.id,
            reference: `LIQ-${l.id.substring(0, 6)}`,
            type: 'Liquidation' as const,
            status: l.status,
            amount: l.totalExpenses ?? l.totalSpent ?? 0,
            date: l.createdAt || '',
            path: `/liquidations/${l.id}`,
            requestorName: usersById.get(l.requestorId)?.name,
            approverName: usersById.get(l.cashAdvance?.approverId)?.name,
          }))
        ];

        unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setItems(unified);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching request list:', err);
        setLoading(false);
      });
  }, [scopeToUserId]);

  return { items, loading, claims, cashAdvances, liquidations };
}
