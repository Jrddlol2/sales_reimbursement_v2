import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import {
  CashAdvance, CashAdvanceStatus,
  Liquidation, LiquidationStatus, LiquidationVarianceType,
  LiquidationLineItem, Mom, User,
  Claim, ClaimStatus
} from '../types';
import { ClaimLineItems } from './ClaimLineItems';
import { ExpenseLineItemEditor } from './ExpenseLineItemEditor';
import { ClaimActivityTimeline } from './ClaimActivityTimeline';
import { formatPHP, getClaimNumber } from '../utils';
import { StatusBadge } from './StatusBadge';
import { WorkflowOwnerTag } from './WorkflowOwnerTag';
import {
  Plus, Trash, CloudArrowUp, WarningCircle, FileText, Check, ArrowLeft, PaperPlaneRight, Sparkle, MagnifyingGlass
} from '@phosphor-icons/react';

interface LocalLineItem {
  id: string;
  expense_date: string;
  vendor: string;
  category: string;
  amount: string; // string state to avoid currency display bug!
  payment_method: string;
  business_purpose: string;
  receiptName: string;
  receiptUrl?: string;
  attachment_type: string;
  or_number?: string;
  isDragOver?: boolean;
}

// Dashboard shows recent activity only; the full record lives on the
// Transaction History page (/history), not duplicated here in full.
const RECENT_LIMIT = 8;

const LIQUIDATION_CATEGORIES = [
  { value: 'Client Meals', label: 'Client Meals' },
  { value: 'Travel / Flights', label: 'Travel / Flights' },
  { value: 'Transportation / Taxi', label: 'Transportation / Taxi' },
  { value: 'Accommodation', label: 'Accommodation' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Supplies / Materials', label: 'Supplies / Materials' },
  { value: 'Other Sales Expenses', label: 'Other Sales Expenses' }
];

interface CashAdvanceLiquidationSectionProps {
  /** Rendered between the "Needs Your Action" panel and this section's own
   *  KPI row/ledger — lets a parent (e.g. the Requestor Dashboard's "My
   *  Requests" KPIs) sit in that gap without a second mount of this
   *  component (which would double the data fetch and desync state). */
  afterActionPanel?: React.ReactNode;
}

export const CashAdvanceLiquidationSection: React.FC<CashAdvanceLiquidationSectionProps> = ({ afterActionPanel }) => {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('All');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'All' | 'Reimbursement' | 'Cash Advance'>('All');

  const [claims, setClaims] = useState<Claim[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [moms, setMoms] = useState<Mom[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allLineItems, setAllLineItems] = useState<LiquidationLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Ready for Claim state inside the unified ledger
  const [activeClaimPrompt, setActiveClaimPrompt] = useState<string | null>(null);
  const [claimCodeInput, setClaimCodeInput] = useState("");

  // Form states - Liquidation Report
  const [activeLiquidationCa, setActiveLiquidationCa] = useState<CashAdvance | null>(null);
  const [activeLiquidation, setActiveLiquidation] = useState<Liquidation | null>(null);
  const [liqLineItems, setLiqLineItems] = useState<LocalLineItem[]>([]);
  const [submittingLiquidation, setSubmittingLiquidation] = useState(false);

  // Detailed Modal states
  const [selectedCaId, setSelectedCaId] = useState<string | null>(null);
  const [selectedLiqId, setSelectedLiqId] = useState<string | null>(null);
  const [caDetails, setCaDetails] = useState<any | null>(null);
  const [liqDetails, setLiqDetails] = useState<any | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  const handleOpenCaDetails = (id: string) => {
    navigate(`/cash-advances/${id}`);
  };

  const handleOpenLiqDetails = (id: string) => {
    navigate(`/liquidations/${id}`);
  };

  const handleClaimPayment = async (claimId: string, claimNumber: string) => {
    if (!claimCodeInput.trim()) {
      return toast.error('Please enter the Claim Code');
    }

    try {
      await apiFetch(`/api/claims/${claimId}/claim`, { 
        method: 'POST',
        body: JSON.stringify({ code: claimCodeInput })
      });
      setActiveClaimPrompt(null);
      setClaimCodeInput('');
      toast.success(`Claim ${claimNumber} is now marked as Completed! Thank you.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim payment');
    }
  };

  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [caData, liqData, momData, userData, claimsData] = await Promise.all([
        apiFetch('/api/cash-advances'),
        apiFetch('/api/liquidations'),
        apiFetch('/api/moms'),
        apiFetch('/api/users'),
        apiFetch('/api/claims')
      ]);

      setCashAdvances(caData);
      setLiquidations(liqData);
      setMoms(momData);
      setUsers(userData);
      setClaims(claimsData);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load request records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartLiquidation = async (ca: CashAdvance) => {
    try {
      // Find or create liquidation
      let liq = liquidations.find(l => l.cashAdvanceId === ca.id);
      if (!liq) {
        liq = await apiFetch('/api/liquidations', {
          method: 'POST',
          body: JSON.stringify({ cashAdvanceId: ca.id })
        });
      }

      // Fetch line items of this liquidation to populate form
      const items = await apiFetch(`/api/liquidations/${liq.id}`);
      setActiveLiquidationCa(ca);
      setActiveLiquidation(liq);

      if (items.lineItems && items.lineItems.length > 0) {
        setLiqLineItems(items.lineItems.map((item: LiquidationLineItem) => ({
          id: item.id,
          expense_date: item.expense_date,
          vendor: item.vendor,
          category: item.category,
          amount: String(item.amount),
          payment_method: item.payment_method,
          business_purpose: item.business_purpose,
          receiptName: item.receipt_url && item.receipt_url !== 'No Official Receipt' ? item.receipt_url.split('/').pop() || '' : '',
          receiptUrl: item.receipt_url && item.receipt_url !== 'No Official Receipt' ? item.receipt_url : undefined,
          attachment_type: item.attachment_type || (item.receipt_url === 'No Official Receipt' ? 'No Official Receipt' : 'Official Receipt'),
          or_number: item.or_number || ''
        })));
      } else {
        setLiqLineItems([
          {
            id: Math.random().toString(),
            expense_date: new Date().toISOString().split('T')[0],
            vendor: '',
            category: '',
            amount: '',
            payment_method: 'Cash',
            business_purpose: '',
            receiptName: '',
            attachment_type: 'Official Receipt',
            or_number: ''
          }
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize Liquidation report.');
    }
  };

  const handleAddLiqLine = () => {
    setLiqLineItems([
      ...liqLineItems,
      {
        id: Math.random().toString(),
        expense_date: new Date().toISOString().split('T')[0],
        vendor: '',
        category: '',
        amount: '',
        payment_method: 'Cash',
        business_purpose: '',
        receiptName: '',
        attachment_type: 'Official Receipt',
        or_number: ''
      }
    ]);
  };

  const handleRemoveLiqLine = (id: string) => {
    if (liqLineItems.length > 1) {
      setLiqLineItems(liqLineItems.filter(item => item.id !== id));
    }
  };

  const handleUpdateLiqLine = (id: string, field: keyof LocalLineItem, value: any) => {
    setLiqLineItems(items => items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'attachment_type' && value === 'No Official Receipt') {
          updated.receiptName = '';
        }
        return updated;
      }
      return item;
    }));
  };

  const handleFileDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    handleUpdateLiqLine(id, 'isDragOver', false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpdateLiqLine(id, 'receiptName', e.dataTransfer.files[0].name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpdateLiqLine(id, 'receiptName', e.target.files[0].name);
    }
  };

  const handleSaveOrSubmitLiquidation = async (submit: boolean) => {
    if (!activeLiquidation || !activeLiquidationCa) return;

    // Validation
    for (const item of liqLineItems) {
      if (!item.vendor.trim()) return toast.error('Vendor is required for all line items.');
      if (!item.category) return toast.error('Category is required for all line items.');
      if (!item.business_purpose.trim()) return toast.error('Business purpose is required for all line items.');
      const parsedAmount = parseFloat(item.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return toast.error('Amount must be a valid number greater than zero for all line items.');
      }
      if (item.attachment_type !== 'No Official Receipt' && !item.receiptName) {
        return toast.error(`An attachment file is required for ${item.vendor} unless 'No Official Receipt' is selected.`);
      }
    }

    setSubmittingLiquidation(true);
    try {
      // 1. Fetch current server-side line items to wipe them
      const fullLiq = await apiFetch(`/api/liquidations/${activeLiquidation.id}`);
      const serverItems = fullLiq.lineItems || [];

      // 2. Wipe existing items on server sequentially to avoid race conditions
      for (const sItem of serverItems) {
        await apiFetch(`/api/liquidations/${activeLiquidation.id}/line-items/${sItem.id}`, {
          method: 'DELETE'
        });
      }

      // 3. Create new items from scratch
      for (const item of liqLineItems) {
        await apiFetch(`/api/liquidations/${activeLiquidation.id}/line-items`, {
          method: 'POST',
          body: JSON.stringify({
            expense_date: item.expense_date,
            vendor: item.vendor,
            category: item.category,
            amount: parseFloat(item.amount),
            payment_method: item.payment_method,
            business_purpose: item.business_purpose,
            receipt_url: item.attachment_type === 'No Official Receipt' ? 'No Official Receipt' : (item.receiptUrl || `/uploads/${item.receiptName}`),
            attachment_type: item.attachment_type,
            or_number: item.or_number || undefined
          })
        });
      }

      // 4. Submit if requested
      if (submit) {
        await apiFetch(`/api/liquidations/${activeLiquidation.id}/submit`, {
          method: 'POST'
        });
        toast.success('Liquidation report submitted successfully for review.');
      } else {
        toast.success('Liquidation report draft saved successfully.');
      }

      // Cleanup
      setActiveLiquidationCa(null);
      setActiveLiquidation(null);
      setLiqLineItems([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Liquidation.');
    } finally {
      setSubmittingLiquidation(false);
    }
  };

  const handleQuickFillLiquidation = () => {
    if (!activeLiquidationCa) return;
    setLiqLineItems([
      {
        id: Math.random().toString(),
        expense_date: new Date().toISOString().split('T')[0],
        vendor: 'Paseo de Roxas Restaurant',
        category: 'Client Meals',
        amount: String(Math.min(activeLiquidationCa.amount - 500, 3000)),
        payment_method: 'Cash',
        business_purpose: 'Sales dinner with Microgenesis directors.',
        receiptName: 'Lunch_Receipt.pdf',
        attachment_type: 'Official Receipt'
      },
      {
        id: Math.random().toString(),
        expense_date: new Date().toISOString().split('T')[0],
        vendor: 'Grab Taxi Inc.',
        category: 'Transportation / Taxi',
        amount: '450.00',
        payment_method: 'Cash',
        business_purpose: 'Grab ride home after the late meeting.',
        receiptName: 'Grab_Booking.png',
        attachment_type: 'Acknowledgement Receipt'
      }
    ]);
  };

  const handleActionOnAdvance = async (id: string, action: 'submit' | 'cancel') => {
    try {
      if (action === 'submit') {
        await apiFetch(`/api/cash-advances/${id}/submit`, { method: 'POST' });
        toast.success('Cash Advance submitted to your supervisor successfully.');
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update Cash Advance');
    }
  };

  // Calculations for active form
  const totalSpent = liqLineItems.reduce((sum, item) => {
    const parsed = parseFloat(item.amount);
    return sum + (isNaN(parsed) ? 0 : parsed);
  }, 0);

  const variance = activeLiquidationCa ? totalSpent - activeLiquidationCa.amount : 0;
  const varianceText = () => {
    if (variance === 0) return 'Settled (discrepancy: ₱0.00)';
    if (variance < 0) return `Refund Due to Company: ${formatPHP(Math.abs(variance))}`;
    return `Reimbursement Due to Requestor: ${formatPHP(variance)}`;
  };

  // Filter lists for Requestor
  const userClaims = claims.filter(c => c.requestor_id === user?.id);
  const userAdvances = cashAdvances.filter(ca => ca.requestorId === user?.id);

  // Stats Calculations. These three are all cash-advance-specific on purpose —
  // the "My Requests" registry row directly above already covers claim counts
  // and reimbursed totals, so this row only surfaces what that one can't:
  // the requestor's outstanding cash-advance liability and liquidation duties.
  const unliquidatedFloat = userAdvances
    .filter(ca => ca.status !== CashAdvanceStatus.LIQUIDATED && ca.status !== CashAdvanceStatus.REJECTED)
    .reduce((sum, ca) => sum + ca.amount, 0);

  // Released advances still needing a liquidation report — same set the "Needs
  // Your Action" panel lists (no liquidation yet, or one still in Draft /
  // Returned), just counted here.
  const advancesToLiquidate = userAdvances.filter(ca => {
    if (ca.status !== CashAdvanceStatus.RELEASED) return false;
    const liq = liquidations.find(l => l.cashAdvanceId === ca.id);
    return !liq || liq.status === LiquidationStatus.DRAFT || liq.status === LiquidationStatus.RETURNED_FOR_REVISION;
  });

  // Of those, the ones past the 7-day liquidation deadline (from releaseDate) —
  // same deadline rule used by the "Request Disabled / overdue" notice below.
  const LIQUIDATION_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;
  const overdueLiquidations = advancesToLiquidate.filter(ca =>
    ca.releaseDate && Date.now() > new Date(ca.releaseDate).getTime() + LIQUIDATION_DEADLINE_MS
  );

  // Prepare unified list of ALL requests
  const unifiedList = [
    ...userClaims.map(c => ({
      uniqueId: `claim-${c.id}`,
      id: c.id,
      date: c.created_at,
      type: 'Reimbursement' as const,
      purpose: c.expense_category ? `${c.expense_category}: ${c.remarks || 'Sales Reimbursement'}` : (c.remarks || 'Sales Reimbursement'),
      amount: c.total_amount,
      status: c.status,
      rawItem: c
    })),
    ...userAdvances.map(ca => ({
      uniqueId: `ca-${ca.id}`,
      id: ca.id,
      date: ca.releaseDate || ca.createdAt, // Sort by release date if released, else creation date
      type: 'Cash Advance' as const,
      purpose: ca.purpose,
      amount: ca.amount,
      status: ca.status,
      rawItem: ca
    }))
  ];

  // Sort chronologically descending
  const sortedUnifiedList = unifiedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter unified list
  const filteredUnifiedList = sortedUnifiedList.filter(item => {
    // 1. Type Filter
    if (ledgerTypeFilter !== 'All' && item.type !== ledgerTypeFilter) {
      return false;
    }

    // 2. Status Filter
    if (ledgerStatusFilter !== 'All') {
      if (item.type === 'Reimbursement') {
        const claim = item.rawItem;
        switch (ledgerStatusFilter) {
          case 'Pending':
            return claim.status === ClaimStatus.PENDING_APPROVAL;
          case 'Approved':
            return [ClaimStatus.APPROVED, ClaimStatus.PROCESSING, ClaimStatus.READY_FOR_CLAIM].includes(claim.status);
          case 'Completed':
            return claim.status === ClaimStatus.COMPLETED;
          case 'Draft':
            return [ClaimStatus.DRAFT, ClaimStatus.RETURNED].includes(claim.status);
          case 'Rejected':
            return claim.status === ClaimStatus.REJECTED;
          default:
            return true;
        }
      } else {
        const ca = item.rawItem;
        switch (ledgerStatusFilter) {
          case 'Pending':
            return ca.status === CashAdvanceStatus.SUBMITTED;
          case 'Approved':
            return [CashAdvanceStatus.APPROVED, CashAdvanceStatus.RELEASED].includes(ca.status);
          case 'Completed':
            return ca.status === CashAdvanceStatus.LIQUIDATED;
          case 'Draft':
            return ca.status === CashAdvanceStatus.DRAFT;
          case 'Rejected':
            return ca.status === CashAdvanceStatus.REJECTED;
          default:
            return true;
        }
      }
    }

    // 3. MagnifyingGlass Query
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      const idStr = item.type === 'Reimbursement' 
        ? getClaimNumber(item.rawItem).toLowerCase() 
        : `CADV-${item.id.substring(0, 6)}`.toLowerCase();
      const purpose = item.purpose.toLowerCase();
      const amount = String(item.amount);
      
      let momClient = '';
      if (item.type === 'Reimbursement' && item.rawItem.mom_id) {
        momClient = (moms.find(m => m.id === item.rawItem.mom_id)?.client || '').toLowerCase();
      } else if (item.type === 'Cash Advance' && item.rawItem.momId) {
        momClient = (moms.find(m => m.id === item.rawItem.momId)?.client || '').toLowerCase();
      }

      return idStr.includes(q) || purpose.includes(q) || amount.includes(q) || momClient.includes(q);
    }

    return true;
  });

  if (loading) {
    return <div className="text-sm text-gray-500 italic">Synchronizing ledger records...</div>;
  }

  // Active Liquidation form view
  if (activeLiquidationCa && activeLiquidation) {
    return (
      <div className="bg-white rounded border border-slate-200 p-6 shadow-sm space-y-6" id="liquidation_form_container">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <button 
              onClick={() => { setActiveLiquidationCa(null); setActiveLiquidation(null); }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h3 className="text-lg font-extrabold text-slate-900 font-display">
              File Liquidation: CADV-{activeLiquidationCa.id.substring(0,6)}
            </h3>
            <p className="text-xs text-slate-500">
              Document your actual expenses to liquidate the cash advance of {formatPHP(activeLiquidationCa.amount)}.
            </p>
          </div>
          <button
            onClick={handleQuickFillLiquidation}
            className="inline-flex items-center text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-200 uppercase font-display tracking-wider"
          >
            <Sparkle className="w-3.5 h-3.5 mr-1" /> Quick Fill Draft
          </button>
        </div>

        <div className="bg-slate-50 rounded border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div>
            <span className="text-slate-400 block">Cash Advance Amount</span>
            <span className="text-slate-800 text-sm font-bold">{formatPHP(activeLiquidationCa.amount)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Total Spent Listed</span>
            <span className="text-slate-800 text-sm font-bold">{formatPHP(totalSpent)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Liquidation Variance</span>
            <span className={`text-sm font-bold block ${variance === 0 ? 'text-green-600' : variance < 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {varianceText()}
            </span>
          </div>
        </div>

        {/* Form Line Items */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <h4 className="text-xs font-extrabold uppercase text-slate-700 tracking-wider font-display">Expense Receipts Rows</h4>
            <button
              onClick={handleAddLiqLine}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover"
            >
              <Plus className="w-4 h-4" /> Add Item Row
            </button>
          </div>

          {liqLineItems.map((item, index) => (
            <ExpenseLineItemEditor
              key={item.id}
              item={item}
              index={index}
              mode="liquidation"
              categories={LIQUIDATION_CATEGORIES}
              showRemove={liqLineItems.length > 1}
              onRemove={() => handleRemoveLiqLine(item.id)}
              onChange={(field, value) => handleUpdateLiqLine(item.id, field as any, value)}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <button
            onClick={() => { setActiveLiquidationCa(null); setActiveLiquidation(null); }}
            className="bg-white border border-slate-300 text-slate-700 text-xs px-4 py-2 rounded font-bold hover:bg-slate-50 uppercase tracking-wider font-display"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveOrSubmitLiquidation(false)}
              disabled={submittingLiquidation}
              className="bg-slate-100 text-slate-700 text-xs px-4 py-2 rounded font-bold hover:bg-slate-200 uppercase tracking-wider font-display"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSaveOrSubmitLiquidation(true)}
              disabled={submittingLiquidation}
              className="corp-btn-primary"
            >
              <PaperPlaneRight className="w-3.5 h-3.5" /> Submit Liquidation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Needs Your Action - every item that requires a click from this user, always
          shown in full regardless of the history table's recency cap below. This is
          the fix for "filing a liquidation is hard to find": the action lives here,
          not buried as a small button in a long table. Rendered before the KPI
          section below so it's the first thing a Requestor sees, ahead of summary
          numbers. */}
      {(() => {
        const draftAdvances = userAdvances.filter(ca => ca.status === CashAdvanceStatus.DRAFT);
        const releasedAdvances = userAdvances.filter(ca => {
          if (ca.status !== CashAdvanceStatus.RELEASED) return false;
          const liq = liquidations.find(l => l.cashAdvanceId === ca.id);
          return !liq || liq.status === LiquidationStatus.DRAFT || liq.status === LiquidationStatus.RETURNED_FOR_REVISION;
        });
        const readyToClaim = userClaims.filter(c => c.status === ClaimStatus.READY_FOR_CLAIM);
        const returnedClaims = userClaims.filter(c => c.status === ClaimStatus.RETURNED);

        const actionCount = draftAdvances.length + releasedAdvances.length + readyToClaim.length + returnedClaims.length;
        if (actionCount === 0) return null;

        return (
          <div className="bg-amber-50 border border-amber-200 rounded shadow-sm animate-fade-in overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
              <WarningCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wider">Needs Your Action ({actionCount})</h3>
            </div>
            <div className="divide-y divide-amber-100">
              {draftAdvances.map(ca => (
                <div key={ca.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-mono font-bold text-slate-800">CADV-{ca.id.substring(0, 6).toUpperCase()}</span>
                    <span className="text-slate-500 ml-2">Draft — submit for approval ({formatPHP(ca.amount)})</span>
                  </div>
                  <button onClick={() => handleActionOnAdvance(ca.id, 'submit')} className="corp-btn-primary text-[10px] px-3 py-1.5 shrink-0">Submit</button>
                </div>
              ))}
              {releasedAdvances.map(ca => {
                const liq = liquidations.find(l => l.cashAdvanceId === ca.id);
                return (
                  <div key={ca.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-mono font-bold text-slate-800">CADV-{ca.id.substring(0, 6).toUpperCase()}</span>
                      <span className="text-slate-500 ml-2">Released — file your Liquidation report ({formatPHP(ca.amount)})</span>
                    </div>
                    <button onClick={() => handleStartLiquidation(ca)} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-3 py-1.5 rounded shrink-0 uppercase font-display shadow-sm">
                      {liq ? 'Resume' : 'File'} Liquidation
                    </button>
                  </div>
                );
              })}
              {readyToClaim.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-mono font-bold text-slate-800">{getClaimNumber(c)}</span>
                    <span className="text-slate-500 ml-2">Ready to Claim — present your Claim Code ({formatPHP(c.total_amount)})</span>
                  </div>
                  {activeClaimPrompt === c.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Claim Code"
                        value={claimCodeInput}
                        onChange={(e) => setClaimCodeInput(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-[10px] w-24 focus:border-brand focus:outline-none uppercase font-semibold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => { setActiveClaimPrompt(null); setClaimCodeInput(''); }}
                        className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded text-[10px] font-bold font-display"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClaimPayment(c.id, getClaimNumber(c))}
                        className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-3 py-1.5 rounded shadow-sm font-bold font-display"
                      >
                        Submit
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setActiveClaimPrompt(c.id)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-3 py-1.5 rounded shrink-0 uppercase font-display shadow-sm">Collect Fund</button>
                  )}
                </div>
              ))}
              {returnedClaims.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-mono font-bold text-slate-800">{getClaimNumber(c)}</span>
                    <span className="text-slate-500 ml-2">Returned for revision ({formatPHP(c.total_amount)})</span>
                  </div>
                  <Link to={`/claims/${c.id}/resubmit`} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-3 py-1.5 rounded shrink-0 uppercase font-display shadow-sm">Revise</Link>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {afterActionPanel}

      {/* KPI Section — cash-advance-specific stats only, so this row doesn't
          restate the "My Requests" claim counts/reimbursed totals above it. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold font-display font-bold">Unliquidated Float</span>
          <div className="text-2xl font-extrabold text-brand font-display">
            {formatPHP(unliquidatedFloat)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">Cash advances still to account for</span>
        </div>
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold font-display font-bold">Advances to Liquidate</span>
          <div className={`text-2xl font-extrabold font-display ${advancesToLiquidate.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {advancesToLiquidate.length}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">Released advances awaiting a report</span>
        </div>
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold font-display font-bold">Overdue Liquidations</span>
          <div className={`text-2xl font-extrabold font-display ${overdueLiquidations.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {overdueLiquidations.length}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">Past the 7-day filing deadline</span>
        </div>
      </div>

      {/* Both actions route to the one canonical request form (SubmitClaim.tsx)
          instead of this section keeping its own second Cash Advance form —
          that used to mean two separate validation paths and two "active
          advance" guards to keep in sync for the same POST /api/cash-advances. */}
      <div className="flex justify-end gap-3">
        <Link
          to="/claims/new"
          className="corp-btn-primary px-4 py-2 rounded text-xs font-bold shadow-sm transition-all uppercase tracking-wider font-display flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New Reimbursement
        </Link>
        <Link
          to="/claims/new?type=cash_advance"
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-xs font-bold shadow-sm transition-all uppercase tracking-wider font-display flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Request Cash Advance
        </Link>
      </div>

      {/* Recent request history - capped; full history lives on the Transaction
          History page, not duplicated here in full on the dashboard. */}
      <div className="corp-card flex flex-col overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-display flex items-center gap-2"><div className="w-1 h-3 bg-brand rounded-full"></div>Recent Requests</h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-grow max-w-xl justify-end">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search requests..."
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded text-xs px-2.5 py-1.5 pl-8 focus:border-brand focus:outline-none"
              />
              <MagnifyingGlass className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <select
              value={ledgerTypeFilter}
              onChange={e => setLedgerTypeFilter(e.target.value as any)}
              className="bg-white border border-slate-300 rounded text-xs px-2.5 py-1.5 focus:border-brand focus:outline-none font-semibold text-slate-700"
            >
              <option value="All">All Types</option>
              <option value="Reimbursement">Reimbursements</option>
              <option value="Cash Advance">Cash Advances</option>
            </select>

            <select
              value={ledgerStatusFilter}
              onChange={e => setLedgerStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded text-xs px-2.5 py-1.5 focus:border-brand focus:outline-none font-semibold text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Approved">Approved / Released</option>
              <option value="Completed">Completed / Liquidated</option>
              <option value="Draft">Drafts & Returned</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left font-extrabold text-slate-500 uppercase tracking-wider font-display">ID / Date</th>
                <th className="px-3 py-3 text-left font-extrabold text-slate-500 uppercase tracking-wider font-display">Type</th>
                <th className="px-3 py-3 text-left font-extrabold text-slate-500 uppercase tracking-wider font-display">Purpose / Details</th>
                <th className="px-3 py-3 text-right font-extrabold text-slate-500 uppercase tracking-wider font-display">Amount</th>
                <th className="px-3 py-3 text-center font-extrabold text-slate-500 uppercase tracking-wider font-display">Liquidation</th>
                <th className="px-3 py-3 text-center font-extrabold text-slate-500 uppercase tracking-wider font-display">Status</th>
                <th className="px-3 py-3 text-right font-extrabold text-slate-500 uppercase tracking-wider font-display">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUnifiedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    {unifiedList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-3 py-6 max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                          <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-extrabold text-slate-800 font-display">No requests filed yet</p>
                        <p className="text-xs text-slate-400 font-semibold leading-normal">
                          You haven't submitted any reimbursement claims or cash advances. Click one of the buttons above to create your very first request!
                        </p>
                        <div className="flex gap-2 pt-2">
                          <Link
                            to="/claims/new"
                            className="corp-btn-primary text-[10px] px-3 py-1.5"
                          >
                            New Reimbursement
                          </Link>
                          <Link
                            to="/claims/new?type=cash_advance"
                            className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase font-display"
                          >
                            Request Cash Advance
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-slate-400 italic font-semibold">
                        No requests in history match your search or filter selections.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUnifiedList.slice(0, RECENT_LIMIT).map(item => {
                  const isClaim = item.type === 'Reimbursement';
                  const claim = isClaim ? (item.rawItem as Claim) : null;
                  const ca = !isClaim ? (item.rawItem as CashAdvance) : null;
                  const liq = ca ? liquidations.find(l => l.cashAdvanceId === ca.id) : null;

                  return (
                    <tr key={item.uniqueId} className="hover:bg-brand/5 transition-colors">
                      {/* ID / Date */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {isClaim && claim ? (
                          <Link 
                            to={`/claims/${claim.id}`}
                            className="font-mono text-xs font-bold text-brand hover:underline block"
                          >
                            {getClaimNumber(claim)}
                          </Link>
                        ) : ca ? (
                          <Link 
                            to={`/cash-advances/${ca.id}`}
                            className="font-mono text-xs font-bold text-brand hover:underline block"
                          >
                            CADV-{ca.id.substring(0, 6).toUpperCase()}
                          </Link>
                        ) : null}
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                          {new Date(item.date).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-100 text-slate-700 border-slate-200">
                          {item.type}
                        </span>
                      </td>

                      {/* Purpose / Details */}
                      <td className="px-3 py-3.5 max-w-[9rem] md:max-w-xs">
                        <div className="font-semibold text-slate-700 truncate" title={item.purpose}>
                          {item.purpose}
                        </div>
                        {isClaim && claim?.mom_id && (
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Meeting: <strong className="text-slate-600">{moms.find(m => m.id === claim.mom_id)?.client || 'Linked MOM'}</strong>
                          </div>
                        )}
                        {!isClaim && ca?.momId && (
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Meeting: <strong className="text-slate-600">{moms.find(m => m.id === ca.momId)?.client || 'Linked MOM'}</strong>
                          </div>
                        )}
                      </td>

                      {/* Request Amount */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-right font-bold text-slate-900">
                        {formatPHP(item.amount)}
                      </td>

                      {/* Liquidation Column */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {isClaim && claim?.sourceLiquidationId ? (
                          <Link 
                            to={`/liquidations/${claim.sourceLiquidationId}`}
                            className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline font-bold"
                          >
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              Shortfall Claim
                            </span>
                          </Link>
                        ) : !isClaim && ca ? (
                          liq ? (
                            <Link
                              to={`/liquidations/${liq.id}`}
                              className="flex flex-col gap-0.5 items-center hover:opacity-85"
                            >
                              <StatusBadge status={liq.status} size="sm" />
                              <span className="text-[10px] text-slate-400 font-bold hover:underline">
                                {formatPHP(liq.totalSpent)} spent
                              </span>
                            </Link>
                          ) : (
                            <span className="text-slate-400 italic font-semibold">
                              Not Liquidated
                            </span>
                          )
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* Status Badge — plus a compact "waiting on whom" tag, so a
                          requestor scanning several rows can see where each one is
                          stuck without opening every drawer. */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {isClaim && claim ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <StatusBadge status={claim.status} size="sm" />
                            <WorkflowOwnerTag
                              status={claim.status}
                              requestorName={user?.name}
                              approverName={users.find(u => u.id === claim.current_approver_id)?.name}
                            />
                          </div>
                        ) : ca ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <StatusBadge status={ca.status} size="sm" />
                            <WorkflowOwnerTag
                              status={ca.status}
                              requestorName={user?.name}
                              approverName={users.find(u => u.id === ca.approverId)?.name}
                            />
                          </div>
                        ) : null}
                      </td>

                      {/* Row Action — read/track only. Collecting a fund, submitting a
                          draft advance, revising a returned claim, and filing a
                          liquidation all happen from the "Needs Your Action" panel
                          above (the one actionable surface for these); this row
                          just links into the full record instead of re-offering
                          the same buttons a second time with a second code-entry
                          state. */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-right font-bold">
                        <Link
                          to={isClaim ? `/claims/${item.id}` : `/cash-advances/${item.id}`}
                          className="text-slate-500 hover:text-slate-800 text-[10px] uppercase font-display hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredUnifiedList.length > RECENT_LIMIT && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-right">
            <Link to="/history" className="text-xs font-bold text-brand hover:underline">
              View all {filteredUnifiedList.length} requests in Transaction History →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
