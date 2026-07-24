import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Icon } from '@phosphor-icons/react';
import { X, DownloadSimple } from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';
import { UserRole, Claim, CashAdvance, Liquidation, User } from '../types';
import { RequestTable } from '../components/RequestTable';
import { MetricRow } from '../components/dashboard/MetricRow';
import { Pagination, usePagination } from '../components/Pagination';
import { DashboardPeriodProvider } from '../contexts/DashboardPeriodContext';
import { metricsForRole, MetricContext } from '../metrics/registry';
import { useUnifiedRequestList } from '../hooks/useUnifiedRequestList';
import { exportRequestsToCSV } from '../utils';

const PAGE_SIZE = 10;

// The Requestor "My Requests" KPI strip — only shown for own-scoped views.
// Action links point back at whatever base path the caller lives on
// (/my-requests today) so a card's "View Pending" filters this same page.
const RequestListKPIs: React.FC<{
  user: User;
  claims: Claim[];
  cadvs: CashAdvance[];
  liqs: Liquidation[];
  basePath: string;
}> = ({ user, claims, cadvs, liqs, basePath }) => {
  const ctx: MetricContext = { claims, cashAdvances: cadvs, liquidations: liqs, users: [], currentUser: user };
  const metricDefs = metricsForRole(UserRole.REQUESTOR);
  const metricActionMap: Record<string, { actionLabel: string; actionPath: string }> = {
    requestor_my_claims: { actionLabel: 'View All', actionPath: basePath },
    requestor_awaiting_approval: { actionLabel: 'View Pending', actionPath: `${basePath}?status=Pending Approval` },
    requestor_needs_revision: { actionLabel: 'View Returned', actionPath: `${basePath}?status=Returned` },
    requestor_approved_this_month: { actionLabel: 'View Processing', actionPath: `${basePath}?status=Processing` },
    requestor_rejected_this_month: { actionLabel: 'View Rejected', actionPath: `${basePath}?status=Rejected` },
    requestor_amount_reimbursed_ytd: { actionLabel: 'View Completed', actionPath: `${basePath}?status=Completed` },
  };

  return (
    <div className="mb-8">
      <MetricRow
        metrics={metricDefs}
        ctx={ctx}
        actionMap={metricActionMap}
        heading="My Requests"
        subheading="Track the status of your submitted requests, each scoped to its own relevant period"
      />
    </div>
  );
};

interface RequestListProps {
  title: string;
  description: string;
  icon: Icon;
  // 'own' → only the current user's submissions (My Requests, and an Approver's
  // own history); 'all' → everything the caller's role can see (Custodian/Admin
  // system-wide transaction log).
  scope: 'own' | 'all';
  // Requestor KPI strip above the table. Only meaningful with scope='own'.
  showKpis?: boolean;
  // Base path the KPI cards link to (so "View Pending" filters this page).
  kpiBasePath?: string;
  headerActions?: React.ReactNode;
  listTitle: string;
  // Fold "(N records)" into the list header (Transaction History does this).
  showRecordCount?: boolean;
  exportFilename: string;
}

/**
 * One list of requests, shared by /history and /my-requests. The only real
 * differences between those two pages were scope (own vs all) and whether the
 * Requestor KPI strip shows — both props here — so the fetch/filter/paginate/
 * export machinery lives in exactly one place instead of two near-identical
 * copies. Status/type filters read from the URL so dashboard deep-links
 * (?status=…) land pre-filtered and stay shareable.
 */
export const RequestList: React.FC<RequestListProps> = ({
  title,
  description,
  icon: Icon,
  scope,
  showKpis = false,
  kpiBasePath = '',
  headerActions,
  listTitle,
  showRecordCount = false,
  exportFilename,
}) => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const typeFilter = searchParams.get('type');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const scopeId = scope === 'own' ? user?.id : undefined;
  const { items, loading, claims, cashAdvances, liquidations } = useUnifiedRequestList(scopeId);

  const availableStatuses = Array.from(new Set(items.map(i => i.status))).sort();

  const filteredItems = items
    .filter(i => !statusFilter || i.status === statusFilter)
    .filter(i => !typeFilter || i.type === typeFilter)
    .filter(i => !startDate || (i.date && i.date.substring(0, 10) >= startDate))
    .filter(i => !endDate || (i.date && i.date.substring(0, 10) <= endDate));

  const { currentPage, setPage, totalPages, paginatedItems, totalItems } = usePagination(filteredItems, PAGE_SIZE);

  const hasActiveFilters = !!(statusFilter || typeFilter || startDate || endDate);

  const setParam = (key: string, value: string) => {
    if (value === 'All') searchParams.delete(key);
    else searchParams.set(key, value);
    setSearchParams(searchParams);
    setPage(1);
  };

  const clearFilters = () => {
    searchParams.delete('status');
    searchParams.delete('type');
    setSearchParams(searchParams);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExport = () => exportRequestsToCSV(filteredItems, exportFilename);

  if (loading || !user) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-7 w-56 bg-slate-200 rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-28"></div>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl h-64"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display flex items-center gap-2">
            <Icon className="w-5 h-5 text-brand" /> {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
      </div>

      {showKpis && (
        <DashboardPeriodProvider>
          <RequestListKPIs user={user} claims={claims} cadvs={cashAdvances} liqs={liquidations} basePath={kpiBasePath} />
        </DashboardPeriodProvider>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter || 'All'}
          onChange={e => setParam('status', e.target.value)}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:border-brand focus:outline-none font-semibold text-slate-700"
        >
          <option value="All">All Statuses</option>
          {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={typeFilter || 'All'}
          onChange={e => setParam('type', e.target.value)}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:border-brand focus:outline-none font-semibold text-slate-700"
        >
          <option value="All">All Types</option>
          <option value="Reimbursement">Reimbursement</option>
          <option value="Cash Advance">Cash Advance</option>
          <option value="Liquidation">Liquidation</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:border-brand focus:outline-none text-slate-700"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:border-brand focus:outline-none text-slate-700"
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleExport}
          disabled={filteredItems.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <DownloadSimple className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <RequestTable
        title={showRecordCount ? `${listTitle} (${filteredItems.length} records)` : listTitle}
        items={paginatedItems}
        emptyTitle="No requests found"
        emptyDescription={hasActiveFilters
          ? 'No requests match the selected filters.'
          : 'Requests you file — reimbursements, cash advances, and liquidations — will show up here.'}
        footer={
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            itemsPerPage={PAGE_SIZE}
          />
        }
      />
    </div>
  );
};
