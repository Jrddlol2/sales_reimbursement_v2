import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Claim, ClaimStatus, ReviewMeetingStatus } from '../types';
import { ClaimDetail } from './ClaimDetail';
import { getStatusColor, formatPHP, getClaimNumber } from '../utils';
import { StatusBadge } from '../components/StatusBadge';
import { getAgingInfo } from '../statusConfig';
import { SourceLiquidationTag } from '../components/SourceLiquidationTag';
import { Tray, CheckSquare, Warning, Wallet, ArrowsClockwise } from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';
import { KPICard } from '../components/dashboard/KPICard';

import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { ClaimLineItems } from '../components/ClaimLineItems';
import { EmptyState } from '../components/EmptyState';
import { useNewDataAvailable } from '../hooks/useNewDataAvailable';

interface ApprovalQueueProps {
  // Set when rendered inline inside the Approver Dashboard (which already has
  // its own "Good Morning" header) instead of standalone, so the page's own
  // title block doesn't duplicate it.
  embedded?: boolean;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [inboxClaims, setInboxClaims] = useState<Claim[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'inbox' | 'meetings' | 'history'>((searchParams.get('tab') as any) === 'cadv' ? 'inbox' : (searchParams.get('tab') as any) || 'inbox');

  // Cash Advance / Liquidation states
  const [cashAdvances, setCashAdvances] = useState<any[]>([]);
  const [liquidations, setLiquidations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [approvalsComment, setApprovalsComment] = useState<Record<string, string>>({});

  // Review Meeting confirmation state
  const [reviewMeetings, setReviewMeetings] = useState<any[]>([]);
  const [meetingComment, setMeetingComment] = useState<Record<string, string>>({});
  const [isProcessingMeeting, setIsProcessingMeeting] = useState<string | null>(null);
  const [isProcessingAdvance, setIsProcessingAdvance] = useState<string | null>(null);
  const [isProcessingLiq, setIsProcessingLiq] = useState<string | null>(null);

  // Optimistic UI: ids of items already actioned locally but not yet
  // reflected in a fresh fetch — hidden from their pending lists immediately
  // on click instead of waiting for the round-trip, then reconciled (or
  // un-hidden on error) once the request settles.
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
  const hideOptimistically = (id: string) => setPendingRemovalIds(prev => new Set(prev).add(id));
  const unhideOptimistically = (id: string) => setPendingRemovalIds(prev => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });

  // Pending is a unified queue (Reimbursements + Cash Advances + Liquidations
  // together, not separate tabs — docs/hierarchy-sync-design.md doesn't cover
  // this, it's a UX simplification). A Cash Advance/Liquidation row expands
  // inline for its decision instead of navigating away, since those don't
  // have a full-page detail view the way claims do.
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [queueViewFilter, setQueueViewFilter] = useState<'all' | 'to_review' | 'my_returned'>('all');

  // Bulk actions
  const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'Approved' | 'Rejected' | null>(null);
  const [bulkComment, setBulkComment] = useState('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  useEffect(() => {
    fetchClaims();
    apiFetch('/api/activity/seen', {
      method: 'POST',
      body: JSON.stringify({ section: 'inbox' })
    }).catch(console.error);
  }, []);

  // Embedded in the Dashboard, this component stays mounted across
  // same-route navigations (e.g. a "Decision History" link setting
  // ?tab=history) — the initial useState read above only fires once, so this
  // keeps the active tab in sync with the URL on every change, not just mount.
  useEffect(() => {
    const requested = searchParams.get('tab');
    if (!requested) return;
    const normalized = requested === 'cadv' ? 'inbox' : (requested as 'inbox' | 'meetings' | 'history');
    if (normalized !== tab) {
      setTab(normalized);
      // This panel sits well below the Dashboard's KPI cards, so a Dashboard
      // KPI's "?tab=..." link only changed the URL — nothing scrolled the
      // switched tab into view, making the click look like it did nothing.
      if (embedded) {
        document.getElementById('approval-queue-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [searchParams]);

  const fetchClaims = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      apiFetch('/api/claims'),
      apiFetch('/api/cash-advances'),
      apiFetch('/api/liquidations'),
      apiFetch('/api/users'),
      apiFetch('/api/review-meetings')
    ]).then(([claimsData, caData, liqData, usersData, meetingsData]) => {
      setAllClaims(claimsData);
      const pendingApprovals = claimsData.filter((c: Claim) => c.status === ClaimStatus.PENDING_APPROVAL && c.current_approver_id === user?.id);
      const returnedClaims = claimsData.filter((c: Claim) => c.status === ClaimStatus.RETURNED && c.requestor_id === user?.id);
      setInboxClaims([...pendingApprovals, ...returnedClaims].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      setSelectedForBulk([]);

      // Filter pending items
      const pendingAdvances = caData.filter((ca: any) => ca.status === 'Submitted' && ca.approverId === user?.id);
      const pendingLiqs = liqData.filter((l: any) => l.status === 'Submitted' && caData.find((ca: any) => ca.id === l.cashAdvanceId)?.approverId === user?.id);

      setCashAdvances(caData);
      setLiquidations(liqData);
      setUsers(usersData);
      setReviewMeetings(meetingsData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
      setLoadError(true);
      toast.error('Failed to load your approval queue. Please try again.');
    });
  };

  // Background check for new/changed inbox items from other users' actions
  // (e.g. a new claim routed to this approver) — never replaces the list on
  // its own, just surfaces a banner the user can act on when ready.
  const { hasNewData: hasNewInboxData, dismiss: dismissNewInboxData } = useNewDataAvailable({
    intervalMs: 60000,
    currentIds: inboxClaims.map(c => c.id),
    fetchIds: async () => {
      const claimsData = await apiFetch('/api/claims');
      const pending = claimsData.filter((c: Claim) => c.status === ClaimStatus.PENDING_APPROVAL && c.current_approver_id === user?.id);
      const returned = claimsData.filter((c: Claim) => c.status === ClaimStatus.RETURNED && c.requestor_id === user?.id);
      return [...pending, ...returned].map((c: Claim) => c.id);
    },
  });

  const handleConfirmMeeting = async (id: string) => {
    setIsProcessingMeeting(id);
    hideOptimistically(id);
    try {
      await apiFetch(`/api/review-meetings/${id}/confirm`, { method: 'POST' });
      toast.success('Review Meeting confirmed. The requestor has been notified.');
      fetchClaims();
    } catch (err: any) {
      unhideOptimistically(id);
      toast.error(err.message || 'Failed to confirm the Review Meeting.');
    } finally {
      setIsProcessingMeeting(null);
    }
  };

  const handleDeclineMeeting = async (id: string) => {
    setIsProcessingMeeting(id);
    hideOptimistically(id);
    try {
      await apiFetch(`/api/review-meetings/${id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: meetingComment[id] || '' })
      });
      toast.success('Review Meeting declined. The requestor has been asked to propose a new time.');
      setMeetingComment(p => ({ ...p, [id]: '' }));
      fetchClaims();
    } catch (err: any) {
      unhideOptimistically(id);
      toast.error(err.message || 'Failed to decline the Review Meeting.');
    } finally {
      setIsProcessingMeeting(null);
    }
  };

  const handleApproveAdvance = async (id: string, decision: 'Approved' | 'Rejected') => {
    const comment = approvalsComment[id] || '';
    if (decision === 'Rejected' && !comment.trim()) {
      return toast.error('A comment is required when rejecting a Cash Advance.');
    }
    setIsProcessingAdvance(id);
    hideOptimistically(id);
    try {
      await apiFetch(`/api/cash-advances/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment })
      });
      toast.success(`Cash Advance successfully ${decision.toLowerCase()}.`);
      fetchClaims();
    } catch (err: any) {
      unhideOptimistically(id);
      toast.error(err.message || 'Failed to submit decision.');
    } finally {
      setIsProcessingAdvance(null);
    }
  };

  const handleReviewLiquidation = async (id: string, decision: 'Approved' | 'Returned') => {
    const comment = approvalsComment[id] || '';
    if (decision === 'Returned' && !comment.trim()) {
      return toast.error('A comment is required when returning a Liquidation for revision.');
    }
    setIsProcessingLiq(id);
    hideOptimistically(id);
    try {
      await apiFetch(`/api/liquidations/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment })
      });
      toast.success(`Liquidation successfully ${decision === 'Approved' ? 'approved' : 'returned for revision'}.`);
      fetchClaims();
    } catch (err: any) {
      unhideOptimistically(id);
      toast.error(err.message || 'Failed to submit decision.');
    } finally {
      setIsProcessingLiq(null);
    }
  };

  const pendingAdvances = cashAdvances.filter(ca => ca.status === 'Submitted' && ca.approverId === user?.id && !pendingRemovalIds.has(ca.id));
  const pendingLiqs = liquidations.filter(l => l.status === 'Submitted' && cashAdvances.find(ca => ca.id === l.cashAdvanceId)?.approverId === user?.id && !pendingRemovalIds.has(l.id));
  const pendingMeetingConfirmations = reviewMeetings.filter(rm => rm.approver_id === user?.id && rm.status === ReviewMeetingStatus.PENDING_CONFIRMATION && !pendingRemovalIds.has(rm.id));
  const visibleInboxClaims = inboxClaims.filter(c => !pendingRemovalIds.has(c.id));

  // One unified queue — Reimbursements, Cash Advances, and Liquidations
  // together, sorted by how long they've been waiting, instead of split
  // across separate tabs.
  const unifiedPendingItems = [
    ...visibleInboxClaims.map(claim => ({ kind: 'claim' as const, id: claim.id, date: claim.updated_at, claim })),
    ...pendingAdvances.map(ca => ({ kind: 'cadv' as const, id: ca.id, date: ca.createdAt, ca })),
    ...pendingLiqs.map(liq => ({ kind: 'liq' as const, id: liq.id, date: liq.createdAt, liq })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // "Approve someone else's claim" and "fix my own returned claim" are
  // different tasks sharing one list — this filter chip lets an approver
  // separate them without splitting the queue into separate tabs/lists.
  const isMyReturnedItem = (item: typeof unifiedPendingItems[number]) =>
    item.kind === 'claim' && item.claim.status === ClaimStatus.RETURNED;
  const displayedPendingItems = unifiedPendingItems.filter(item => {
    if (queueViewFilter === 'all') return true;
    return queueViewFilter === 'my_returned' ? isMyReturnedItem(item) : !isMyReturnedItem(item);
  });

  const toggleBulkSelection = (id: string) => {
    setSelectedForBulk(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllBulk = () => {
    const pendings = visibleInboxClaims.filter(c => c.status === ClaimStatus.PENDING_APPROVAL);
    if (selectedForBulk.length === pendings.length) {
      setSelectedForBulk([]); // deselect all
    } else {
      setSelectedForBulk(pendings.map(c => c.id));
    }
  };

  // docs/hierarchy-sync-design.md §5: claims whose requestor no longer
  // reports to this approver (an org-chart change) stay put by default, but
  // offer a transfer to the suggested new approver.
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [dismissedStaleIds, setDismissedStaleIds] = useState<Set<string>>(new Set());

  const handleTransferApprover = async (claim: Claim) => {
    setTransferringId(claim.id);
    try {
      await apiFetch(`/api/claims/${claim.id}/transfer-approver`, { method: 'POST' });
      toast.success('Claim transferred to the new approver.');
      fetchClaims();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer the claim.');
    } finally {
      setTransferringId(null);
    }
  };

  const handleKeepReviewing = (claimId: string) => {
    // No server action needed — the claim already stays with this approver
    // by default. This just clears the local reminder banner for the claim.
    setDismissedStaleIds(prev => new Set(prev).add(claimId));
  };

  const handleBulkSubmit = async (action: 'Approved' | 'Rejected') => {
    const ok = await confirm({
      title: `Bulk ${action}`,
      message: `Are you sure you want to ${action.toLowerCase()} ${selectedForBulk.length} claims?`,
      confirmLabel: `Yes, ${action}`,
      cancelLabel: 'Cancel',
      tone: action === 'Rejected' ? 'danger' : 'default',
    });
    
    if (!ok) return;

    const idsBeingActioned = selectedForBulk;
    idsBeingActioned.forEach(hideOptimistically);
    setIsProcessingBulk(true);
    try {
      await Promise.all(idsBeingActioned.map(id =>
        apiFetch(`/api/claims/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ decision: action, comment: bulkComment || `Bulk ${action}` })
        })
      ));
      toast.success(`Successfully ${action.toLowerCase()} ${idsBeingActioned.length} claims.`);
      setBulkAction(null);
      setBulkComment('');
      setSelectedForBulk([]);
      fetchClaims();
    } catch (err: any) {
      idsBeingActioned.forEach(unhideOptimistically);
      toast.error(err.message || `Failed to process bulk action`);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Header */}
        <div className="animate-pulse">
          <div className="h-7 w-48 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-md"></div>
        </div>

        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-28 flex flex-col justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
              <div className="h-8 w-16 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>

        {/* Skeleton Table */}
        <div className="corp-card flex flex-col overflow-hidden animate-pulse">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
          </div>
          <div className="p-4 space-y-4">
            <div className="h-8 bg-slate-100 rounded-md w-full"></div>
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="corp-card flex flex-col items-center justify-center text-center py-16 px-6">
        <Warning className="w-10 h-10 text-red-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Couldn't load your approval queue</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
          Something went wrong while fetching your pending approvals. Your queue may not be empty — please try again.
        </p>
        <button onClick={fetchClaims} className="corp-btn-primary text-xs font-semibold px-4 py-2 rounded">
          Retry
        </button>
      </div>
    );
  }

  // Derive stats
  const pendingApprovals = visibleInboxClaims.filter(c => c.status === ClaimStatus.PENDING_APPROVAL);
  const returnedClaims = visibleInboxClaims.filter(c => c.status === ClaimStatus.RETURNED);
  
  const totalAmountPending = pendingApprovals.reduce((sum, c) => sum + (c.total_amount || 0), 0);

  const decisionHistoryItems = allClaims
    .filter(c => c.approvals && c.approvals.some((a: any) => a.approver_id === user?.id))
    .map(c => {
      const userApprovals = [...c.approvals].filter((a: any) => a.approver_id === user?.id);
      userApprovals.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latestApproval = userApprovals[0];
      return {
        claim: c,
        decision: latestApproval.decision,
        date: latestApproval.timestamp,
        comment: latestApproval.comment
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display">Approver Inbox</h2>
          <p className="mt-1 text-xs text-slate-500">Unified action list: Reimbursement claims, Cash Advances, and Liquidations awaiting your decision, plus your own claims returned for revision.</p>
        </div>
      )}

      {hasNewInboxData && (
        <div className="bg-brand/10 border border-brand/30 text-brand text-xs font-semibold rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
          <span>New items are available in your inbox.</span>
          <button
            onClick={() => { dismissNewInboxData(); fetchClaims(); }}
            className="flex items-center gap-1.5 font-bold underline decoration-2 underline-offset-2 hover:text-brand-hover shrink-0"
          >
            <ArrowsClockwise className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      {/* Org-change notices — docs/hierarchy-sync-design.md §5. Claims whose
          requestor no longer reports to this approver stay assigned by
          default; this offers a one-click transfer to the suggested new
          approver, or "keep reviewing" to just dismiss the reminder. */}
      {visibleInboxClaims.filter(c => c.approver_stale_since && !dismissedStaleIds.has(c.id)).map(claim => {
        const suggested = claim.pending_transfer_to ? users.find(u => u.id === claim.pending_transfer_to) : null;
        const claimNumber = getClaimNumber(claim);
        return (
          <div key={`stale-${claim.id}`} className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-900">
              <span className="font-bold">{claimNumber}:</span> {claim.approver_stale_reason || 'The requestor no longer reports to you.'}
              {suggested && <> Transfer to <strong>{suggested.name}</strong>, or keep reviewing it yourself.</>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleKeepReviewing(claim.id)}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 px-3 py-1.5 rounded border border-amber-300 bg-white"
              >
                Keep Reviewing
              </button>
              {suggested && (
                <button
                  onClick={() => handleTransferApprover(claim)}
                  disabled={transferringId === claim.id}
                  className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded disabled:opacity-50"
                >
                  {transferringId === claim.id ? 'Transferring...' : `Transfer to ${suggested.name}`}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Stats Cards - same KPICard component/sizing as the Dashboard, for visual consistency.
          Oldest Pending now lives in the Approval Center row above (registry-driven) —
          it was redundant here once the two dashboards merged. */}
      <div id="approval-queue-panel" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 scroll-mt-6">
        <KPICard
          title="Pending Approvals"
          value={pendingApprovals.length}
          description="Claims from direct reports awaiting your decision."
          icon={CheckSquare}
          variant={pendingApprovals.length > 0 ? "action" : "success"}
        />
        <KPICard
          title="Returned to You"
          value={returnedClaims.length}
          description="Your own claims needing revision."
          icon={Warning}
          variant={returnedClaims.length > 0 ? "warning" : "success"}
        />
        <KPICard
          title="Advances & Liquidations"
          value={pendingAdvances.length + pendingLiqs.length}
          description="Included in the Pending list below, alongside reimbursements."
          icon={Wallet}
          variant={pendingAdvances.length + pendingLiqs.length > 0 ? "action" : "success"}
        />
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => { setTab('inbox'); searchParams.set('tab', 'inbox'); setSearchParams(searchParams); }}
          className={`px-4 py-2 text-xs font-extrabold border-b-2 -mb-px transition-colors font-display ${
            tab === 'inbox' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Pending ({unifiedPendingItems.length})
        </button>
        <button
          onClick={() => { setTab('meetings'); searchParams.set('tab', 'meetings'); setSearchParams(searchParams); }}
          className={`px-4 py-2 text-xs font-extrabold border-b-2 -mb-px transition-colors font-display ${
            tab === 'meetings' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Review Meetings ({pendingMeetingConfirmations.length})
        </button>
        <button
          onClick={() => { setTab('history'); searchParams.set('tab', 'history'); setSearchParams(searchParams); }}
          className={`px-4 py-2 text-xs font-extrabold border-b-2 -mb-px transition-colors font-display ${
            tab === 'history' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Decision History ({decisionHistoryItems.length})
        </button>
      </div>

      {tab === 'meetings' ? (
        <div className="corp-card flex flex-col overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-display flex items-center gap-2"><div className="w-1 h-3 bg-brand rounded-full"></div>Review Meetings Awaiting Your Confirmation</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingMeetingConfirmations.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 italic">No Review Meetings currently awaiting your confirmation.</div>
            ) : (
              pendingMeetingConfirmations.map(rm => (
                <div key={rm.id} className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Link
                        to={`/claims/${rm.claim_id}`}
                        className="font-bold text-brand hover:underline text-sm block"
                      >
                        {rm.claim_number || `REIM-${rm.claim_id.substring(0, 6).toUpperCase()}`}
                      </Link>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">
                        Requestor: <strong className="text-slate-800">{rm.requestor_name}</strong>
                      </div>
                      <div className="text-xs text-slate-600 mt-2">
                        Proposed: <strong>{new Date(rm.meeting_date).toLocaleDateString()}</strong> at <strong>{rm.meeting_time}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Optional reason if declining..."
                      value={meetingComment[rm.id] || ''}
                      onChange={e => setMeetingComment(p => ({ ...p, [rm.id]: e.target.value }))}
                      className="flex-1 border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
                    />
                    <div className="flex gap-1.5 w-full sm:w-auto">
                      <button
                        onClick={() => handleDeclineMeeting(rm.id)}
                        disabled={isProcessingMeeting === rm.id}
                        className="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleConfirmMeeting(rm.id)}
                        disabled={isProcessingMeeting === rm.id}
                        className="corp-btn-primary"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : tab === 'inbox' ? (
        <div className="corp-card flex flex-col overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-display flex items-center gap-2"><div className="w-1 h-3 bg-brand rounded-full"></div>Action Items</h3>
        </div>
        <div>
          {/* Filter chip — "judge someone else's claim" and "fix my own
              returned claim" are different tasks sharing one list; this lets
              an approver view them separately without a second tab. Only
              shown when there's actually a mix to separate. */}
          {returnedClaims.length > 0 && unifiedPendingItems.length > returnedClaims.length && (
            <div className="px-4 pt-3 flex flex-wrap gap-1.5">
              {([
                { key: 'all' as const, label: `All (${unifiedPendingItems.length})` },
                { key: 'to_review' as const, label: `To Review (${unifiedPendingItems.length - returnedClaims.length})` },
                { key: 'my_returned' as const, label: `My Returned Claims (${returnedClaims.length})` },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setQueueViewFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    queueViewFilter === f.key ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {/* Card list — replaces the old table, which kept overflowing the
              viewport no matter how the columns were trimmed. Cards reflow
              (1 column narrow, 2 columns wide) instead of forcing a fixed
              set of columns into whatever width is available. */}
          {unifiedPendingItems.length > 0 && (
            <div className="px-4 pt-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-brand focus:ring-brand"
                  checked={pendingApprovals.length > 0 && selectedForBulk.length === pendingApprovals.length}
                  onChange={selectAllBulk}
                  disabled={pendingApprovals.length === 0}
                />
                Select all reimbursements
              </label>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
            {unifiedPendingItems.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState icon={Tray} title="Inbox Zero!" description="You have no pending approvals or returned claims." />
              </div>
            ) : displayedPendingItems.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState icon={Tray} title="Nothing in this view" description="No items match the selected filter." />
              </div>
            ) : displayedPendingItems.map(item => {
              // The queue is sorted oldest-first and "Oldest Pending" is a
              // headline KPI, but until now nothing on the card itself showed
              // which one that was — the approver had to infer age from list
              // order. Same getAgingInfo helper Custodian's ProcessingQueue
              // already uses, applied to each item's own "waiting since" date.
              const aging = getAgingInfo(item.date);
              if (item.kind === 'claim') {
                const claim = item.claim;
                const claimNumber = getClaimNumber(claim);
                const isReturned = claim.status === ClaimStatus.RETURNED;
                return (
                  <div key={item.id} className={`border rounded-lg p-4 flex flex-col gap-2.5 transition-colors ${selectedForBulk.includes(claim.id) ? 'border-brand bg-brand/5' : isReturned ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {!isReturned && (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-brand focus:ring-brand"
                            checked={selectedForBulk.includes(claim.id)}
                            onChange={() => toggleBulkSelection(claim.id)}
                          />
                        )}
                        <span className="font-mono font-bold text-brand text-xs cursor-pointer hover:underline" onClick={() => setSelectedClaimId(claim.id)}>
                          {claimNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full border ${aging.badgeClass}`}>
                          {aging.label}
                        </span>
                        <StatusBadge status={claim.status} size="sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-600">
                      <div className="col-span-2">
                        <span className="text-slate-400 font-medium mr-1">Requestor:</span>
                        <span className="font-bold text-slate-900">{isReturned ? 'You (Self)' : claim.requestor?.name}</span>
                        {!isReturned && claim.requestor?.department && (
                          <span className="text-slate-400"> · {claim.requestor.job_title ? `${claim.requestor.job_title} · ${claim.requestor.department}` : claim.requestor.department}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Category:</span>
                        <span className="font-semibold text-slate-800">{claim.expense_category || 'Meals'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 font-medium mr-1">Amount:</span>
                        <span className="font-extrabold text-slate-900">{formatPHP(claim.total_amount)}</span>
                      </div>
                      {claim.sourceLiquidationId && (
                        <div className="col-span-2"><SourceLiquidationTag /></div>
                      )}
                      {claim.flagged_high_value && (
                        <div className="col-span-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <Warning className="w-2.5 h-2.5 mr-0.5 inline" /> High Value — Review Closely
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end mt-1">
                      <button onClick={() => setSelectedClaimId(claim.id)} className="text-xs font-bold text-brand hover:text-brand-hover">
                        {isReturned ? 'Fix & Resubmit' : 'Review'}
                      </button>
                    </div>
                  </div>
                );
              }

              if (item.kind === 'cadv') {
                const ca = item.ca;
                const reqUser = users.find(u => u.id === ca.requestorId);
                const isExpanded = expandedItemId === item.id;
                return (
                  <div key={item.id} className="border border-slate-200 rounded-lg p-4 flex flex-col gap-2.5 hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <Link to={`/cash-advances/${ca.id}`} className="font-mono font-bold text-brand text-xs hover:underline">
                        CADV-{ca.id.substring(0, 6).toUpperCase()}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full border ${aging.badgeClass}`}>
                          {aging.label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">Cash Advance</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-600">
                      <div className="col-span-2">
                        <span className="text-slate-400 font-medium mr-1">Requestor:</span>
                        <span className="font-bold text-slate-900">{reqUser?.name || 'Unknown'}</span>
                        <span className="text-slate-400"> · {reqUser?.department || 'No Dept'}</span>
                      </div>
                      <div className="col-span-2 italic">"{ca.purpose}"</div>
                      <div className="text-right col-span-2">
                        <span className="text-slate-400 font-medium mr-1">Amount:</span>
                        <span className="font-extrabold text-slate-900">{formatPHP(ca.amount)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end mt-1">
                      <button onClick={() => setExpandedItemId(isExpanded ? null : item.id)} className="text-xs font-bold text-brand hover:text-brand-hover">
                        {isExpanded ? 'Close' : 'Review'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Provide decision comment or rejection reason..."
                          value={approvalsComment[ca.id] || ''}
                          onChange={e => setApprovalsComment(p => ({ ...p, [ca.id]: e.target.value }))}
                          className="border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleApproveAdvance(ca.id, 'Rejected')}
                            disabled={isProcessingAdvance === ca.id}
                            className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveAdvance(ca.id, 'Approved')}
                            disabled={isProcessingAdvance === ca.id}
                            className="flex-1 corp-btn-primary disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              const liq = item.liq;
              const ca = cashAdvances.find(c => c.id === liq.cashAdvanceId);
              const reqUser = users.find(u => u.id === liq.requestorId);
              const isExpanded = expandedItemId === item.id;
              return (
                <div key={item.id} className="border border-slate-200 rounded-lg p-4 flex flex-col gap-2.5 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <Link to={`/liquidations/${liq.id}`} className="font-mono font-bold text-brand text-xs hover:underline">
                      LIQ-{liq.id.substring(0, 6).toUpperCase()}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full border ${aging.badgeClass}`}>
                        {aging.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">Liquidation</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-600">
                    <div className="col-span-2">
                      <span className="text-slate-400 font-medium mr-1">Requestor:</span>
                      <span className="font-bold text-slate-900">{reqUser?.name || 'Unknown'}</span>
                      <span className="text-slate-400"> · {reqUser?.department || 'No Dept'}</span>
                    </div>
                    <div>Advance: {formatPHP(ca?.amount || 0)}</div>
                    <div className="text-right font-extrabold text-slate-900">Spent: {formatPHP(liq.totalSpent)}</div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button onClick={() => setExpandedItemId(isExpanded ? null : item.id)} className="text-xs font-bold text-brand hover:text-brand-hover">
                      {isExpanded ? 'Close' : 'Review'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 font-bold">
                        <span className={liq.varianceAmount === 0 ? 'text-green-600' : liq.varianceAmount < 0 ? 'text-amber-600' : 'text-slate-700'}>
                          Discrepancy: {liq.varianceAmount === 0 ? '₱0.00 (Settled)' : liq.varianceAmount < 0 ? `${formatPHP(Math.abs(liq.varianceAmount))} Refund Due` : `${formatPHP(liq.varianceAmount)} Reimbursement Due`}
                        </span>
                        <button
                          onClick={async () => {
                            const details = await apiFetch(`/api/liquidations/${liq.id}`);
                            confirm({
                              title: `Review Line Items - LIQ-${liq.id.substring(0,6).toUpperCase()}`,
                              message: (
                                <div className="space-y-4 max-w-2xl text-xs">
                                  <p>Liquidating Cash Advance: <strong>{formatPHP(ca?.amount || 0)}</strong>. Actual Spent Listed below:</p>
                                  <div className="border border-slate-200 rounded overflow-hidden">
                                    <ClaimLineItems expenses={details.lineItems} totalAmount={liq.totalSpent} />
                                  </div>
                                </div>
                              ),
                              confirmLabel: 'Close Preview',
                              cancelLabel: ''
                            });
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-bold border border-slate-200 uppercase tracking-wider shrink-0"
                        >
                          Review Line Items
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Provide decision comment or return reason..."
                        value={approvalsComment[liq.id] || ''}
                        onChange={e => setApprovalsComment(p => ({ ...p, [liq.id]: e.target.value }))}
                        className="border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleReviewLiquidation(liq.id, 'Returned')}
                          disabled={isProcessingLiq === liq.id}
                          className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                        >
                          Return for Revision
                        </button>
                        <button
                          onClick={() => handleReviewLiquidation(liq.id, 'Approved')}
                          disabled={isProcessingLiq === liq.id}
                          className="flex-1 corp-btn-primary disabled:opacity-50"
                        >
                          Approve & Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {displayedPendingItems.length > 0 && (
          <div className="bg-white px-4 py-2 border-t border-gray-200 sm:px-6">
            <p className="text-[10px] text-gray-500">
              Showing <span className="font-medium text-gray-900">{displayedPendingItems.length}</span> of {unifiedPendingItems.length} result{unifiedPendingItems.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>
      ) : (
        <div className="corp-card flex flex-col overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-display flex items-center gap-2"><div className="w-1 h-3 bg-brand rounded-full"></div>Decision History</h3>
          </div>
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Requestor</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Date</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Amount</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Decision</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Comment</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {decisionHistoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4">
                        <EmptyState icon={CheckSquare} title="No decisions made yet" />
                      </td>
                    </tr>
                  ) : (
                    decisionHistoryItems.map((item, idx) => {
                      const claimNumber = getClaimNumber(item.claim);
                      return (
                        <tr key={`${item.claim.id}-${idx}`} className="hover:bg-brand/5 transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-950">{item.claim.requestor?.name}</div>
                            <div className="text-[10px] text-gray-500">{claimNumber}</div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">
                            {new Date(item.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                            {formatPHP(item.claim.total_amount)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${getStatusColor(item.decision)}`}>
                              {item.decision}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600 italic truncate max-w-[200px]">
                            {item.comment ? `"${item.comment}"` : "-"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => setSelectedClaimId(item.claim.id)} className="text-brand hover:text-brand-hover">View Claim</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="sm:hidden flex flex-col divide-y divide-slate-100">
              {decisionHistoryItems.length === 0 ? (
                <EmptyState icon={CheckSquare} title="No decisions made yet" />
              ) : (
                decisionHistoryItems.map((item, idx) => {
                  const claimNumber = getClaimNumber(item.claim);
                  return (
                    <div key={`${item.claim.id}-${idx}`} className="p-4 hover:bg-slate-50 flex flex-col gap-2 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-brand text-xs">{claimNumber}</span>
                        <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${getStatusColor(item.decision)}`}>
                          {item.decision}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400 font-medium mr-1">Requestor:</span>
                          <span className="font-bold text-slate-900">{item.claim.requestor?.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 font-medium mr-1">Amount:</span>
                          <span className="font-extrabold text-slate-900">{formatPHP(item.claim.total_amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium mr-1">Date:</span>
                          <span className="text-slate-700">{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {item.comment && (
                        <div className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded">
                          "{item.comment}"
                        </div>
                      )}
                      <div className="flex justify-end mt-1">
                        <button onClick={() => setSelectedClaimId(item.claim.id)} className="text-xs font-bold text-brand hover:text-brand-hover">
                          View Claim
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {selectedClaimId && (
        <ClaimDetail 
          claimId={selectedClaimId} 
          onClose={() => setSelectedClaimId(null)}
          onUpdate={fetchClaims}
        />
      )}

      {/* Bulk Action Bar */}
      {selectedForBulk.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 p-4 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-40">
          <div className="text-xs sm:text-sm font-bold text-gray-700 text-center sm:text-left">
            {selectedForBulk.length} claim{selectedForBulk.length > 1 ? 's' : ''} selected
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="text" 
              placeholder="Optional comment..." 
              value={bulkComment}
              onChange={e => setBulkComment(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-xs w-full sm:w-64 focus:border-brand focus:outline-none"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => handleBulkSubmit('Rejected')}
                className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-1.5 rounded text-xs font-bold"
                disabled={isProcessingBulk}
              >
                Reject All
              </button>
              <button 
                onClick={() => handleBulkSubmit('Approved')}
                className="flex-1 corp-btn-primary text-xs"
                disabled={isProcessingBulk}
              >
                Approve All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
