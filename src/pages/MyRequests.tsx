import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { Claim, CashAdvance, Liquidation, User, UserRole } from '../types';
import { RecentActivityTable } from '../components/dashboard/RecentActivityTable';
import { MetricCard } from '../components/dashboard/MetricCard';
import { metricsForRole, MetricContext } from '../metrics/registry';
import { DashboardPeriodProvider, useDashboardPeriod } from '../contexts/DashboardPeriodContext';
import { PlusCircle, UserCircle, Wallet, X, DownloadSimple } from '@phosphor-icons/react';
import { Pagination, usePagination } from '../components/Pagination';
import { exportRequestsToCSV } from '../utils';
import { useUnifiedRequestList } from '../hooks/useUnifiedRequestList';

const PAGE_SIZE = 10;

// Mirrors the Requestor Dashboard's own "My Requests" panel exactly (same
// registry metrics, same MetricCard, same colors/icons/period-scoped
// labels) — this page is the one place both Requestors and Approvers land
// on to see their own submissions, so it shouldn't show a different KPI set
// than the Requestor dashboard homepage already does. Needs its own period
// provider since this page lives outside the Dashboard route's.
const MyRequestsKPIs: React.FC<{ user: User; claims: Claim[]; cadvs: CashAdvance[]; liqs: Liquidation[] }> = ({ user, claims, cadvs, liqs }) => {
  const { resolveMetricRange, effectiveScope } = useDashboardPeriod();
  const ctx: MetricContext = { claims, cashAdvances: cadvs, liquidations: liqs, users: [], currentUser: user };
  const metricDefs = metricsForRole(UserRole.REQUESTOR);
  const metricActionMap: Record<string, { actionLabel: string; actionPath: string }> = {
    requestor_my_claims: { actionLabel: 'View All', actionPath: '/my-requests' },
    requestor_awaiting_approval: { actionLabel: 'View Pending', actionPath: '/my-requests?status=Pending Approval' },
    requestor_needs_revision: { actionLabel: 'View Returned', actionPath: '/my-requests?status=Returned' },
    requestor_approved_this_month: { actionLabel: 'View Processing', actionPath: '/my-requests?status=Processing' },
    requestor_rejected_this_month: { actionLabel: 'View Rejected', actionPath: '/my-requests?status=Rejected' },
    requestor_amount_reimbursed_ytd: { actionLabel: 'View Completed', actionPath: '/my-requests?status=Completed' },
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-1">My Requests</h2>
      <p className="text-sm text-slate-500 mb-4">Track the status of your submitted requests, each scoped to its own relevant period</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricDefs.map(metric => {
          const scope = effectiveScope(metric);
          const range = resolveMetricRange(metric);
          const value = metric.compute(ctx, range);
          const action = metricActionMap[metric.id];
          return (
            <MetricCard
              key={metric.id}
              metric={metric}
              ctx={ctx}
              scope={scope}
              value={value}
              actionLabel={action?.actionLabel}
              actionPath={action?.actionPath}
            />
          );
        })}
      </div>
    </div>
  );
};

export const MyRequests: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const typeFilter = searchParams.get('type');
  // Date-range filter + CSV export — merged in from the standalone
  // Transaction History page, which showed this same self-scoped data under
  // a second nav item with its own separate feature set. Approvers now have
  // one page instead of two for "my own submissions".
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { items: myItems, loading, claims, cashAdvances, liquidations } = useUnifiedRequestList(user?.id);

  const availableStatuses = Array.from(new Set(myItems.map(i => i.status))).sort();

  const filteredItems = myItems
    .filter(i => !statusFilter || i.status === statusFilter)
    .filter(i => !typeFilter || i.type === typeFilter)
    .filter(i => !startDate || (i.date && i.date.substring(0, 10) >= startDate))
    .filter(i => !endDate || (i.date && i.date.substring(0, 10) <= endDate));

  // The submission history has no natural cap (a long-tenured requestor can
  // have hundreds of rows), so it needs pagination rather than rendering
  // everything into one indefinitely-scrolling table.
  const { currentPage, setPage, totalPages, paginatedItems, totalItems } = usePagination(filteredItems, PAGE_SIZE);

  const handleExport = () => exportRequestsToCSV(filteredItems, 'my_requests.csv');

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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-brand" /> My Requests
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your own submitted reimbursements, cash advances, and liquidations — separate from your approval queue.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/ready-to-claim"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Wallet className="w-4 h-4" /> Ready to Claim
          </Link>
          <Link
            to="/claims/new"
            className="corp-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" /> New Reimbursement
          </Link>
        </div>
      </div>

      <DashboardPeriodProvider>
        <MyRequestsKPIs user={user} claims={claims} cadvs={cashAdvances} liqs={liquidations} />
      </DashboardPeriodProvider>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter || 'All'}
          onChange={e => {
            if (e.target.value === 'All') searchParams.delete('status');
            else searchParams.set('status', e.target.value);
            setSearchParams(searchParams);
            setPage(1);
          }}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:border-brand focus:outline-none font-semibold text-slate-700"
        >
          <option value="All">All Statuses</option>
          {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={typeFilter || 'All'}
          onChange={e => {
            if (e.target.value === 'All') searchParams.delete('type');
            else searchParams.set('type', e.target.value);
            setSearchParams(searchParams);
            setPage(1);
          }}
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
        {(statusFilter || typeFilter || startDate || endDate) && (
          <button
            onClick={() => {
              searchParams.delete('status');
              searchParams.delete('type');
              setSearchParams(searchParams);
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
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

      <RecentActivityTable
        title="My Submission History"
        items={paginatedItems}
        showOwner
        emptyMessage={statusFilter || typeFilter ? "No requests match the selected filters." : "No requests submitted yet — new reimbursements, cash advances, and liquidations you file will show up here."}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalItems}
        itemsPerPage={PAGE_SIZE}
        className="border-t-0 px-0 py-0 -mt-4"
      />
    </div>
  );
};
