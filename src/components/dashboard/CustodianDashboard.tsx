import React, { useState, useEffect } from 'react';
import { User, Claim, CashAdvance, Liquidation, ClaimStatus, CashAdvanceStatus, LiquidationStatus, LiquidationVarianceType, UserRole } from '../../types';
import { apiFetch } from '../../lib/api';
import { KPICard } from './KPICard';
import { MetricCard } from './MetricCard';
import { DashboardPeriodFilter } from './DashboardPeriodFilter';
import { DashboardHeader } from './DashboardHeader';
import { QuickActionsCard } from './QuickActionsCard';
import { RecentActivityTable } from './RecentActivityTable';
import { AnalyticsCard } from './AnalyticsCard';
import { DonutChart, CHART_COLORS } from './AnalyticsCharts';
import { Bank, CurrencyDollar, ArrowDownLeft, Clock, ArrowsClockwise, Receipt, WarningCircle } from '@phosphor-icons/react';
import { formatPHP } from '../../utils';
import { metricsForRole, MetricContext } from '../../metrics/registry';
import { useDashboardPeriod } from '../../contexts/DashboardPeriodContext';

export const CustodianDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [cadvs, setCadvs] = useState<CashAdvance[]>([]);
  const [liqs, setLiqs] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolveMetricRange, effectiveScope } = useDashboardPeriod();

  useEffect(() => {
    Promise.all([
      apiFetch('/api/claims'),
      apiFetch('/api/cash-advances'),
      apiFetch('/api/liquidations')
    ]).then(([claimsData, cadvsData, liqsData]) => {
      setClaims(claimsData);
      setCadvs(cadvsData);
      setLiqs(liqsData);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div>
            <div className="h-7 w-56 bg-slate-200 rounded mb-2"></div>
            <div className="h-4 w-80 bg-slate-100 rounded"></div>
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-lg"></div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-28 flex flex-col justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
              <div className="h-8 w-16 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>

        {/* Dashboard Panels Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 h-64 flex flex-col justify-between">
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
            <div className="h-40 bg-slate-50 rounded-lg w-full"></div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 h-64 flex flex-col justify-between">
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
            <div className="h-40 bg-slate-50 rounded-lg w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // KPIs
  const pendingProcessing = claims.filter(c => c.status === ClaimStatus.PROCESSING);
  const pendingCadvReleases = cadvs.filter(c => c.status === CashAdvanceStatus.APPROVED);
  const pendingRefunds = liqs.filter(l => l.status === LiquidationStatus.REVIEWED && l.varianceType === LiquidationVarianceType.REFUND_DUE);
  const pendingShortfalls = claims.filter(c => c.status === ClaimStatus.PROCESSING && c.expense_category === 'Cash Advance Shortfall');
  
  const pendingTotal = pendingProcessing.length + pendingCadvReleases.length + pendingRefunds.length;

  const pendingProcessingAmt = pendingProcessing.reduce((sum, c) => sum + (c.total_amount || 0), 0);
  const pendingCadvReleasesAmt = pendingCadvReleases.reduce((sum, c) => sum + (c.amount || 0), 0);
  const pendingRefundsAmt = pendingRefunds.reduce((sum, l) => sum + Math.abs(l.varianceAmount || 0), 0);
  const pendingShortfallsAmt = pendingShortfalls.reduce((sum, c) => sum + (c.total_amount || 0), 0);

  const quickActions = [
    { label: 'Process Claims', icon: ArrowsClockwise, path: '/processing', colorClass: 'text-white', bgColorClass: 'bg-brand' },
    { label: 'Release Advances', icon: CurrencyDollar, path: '/processing', colorClass: 'text-white', bgColorClass: 'bg-emerald-600' },
    { label: 'Collect Refunds', icon: ArrowDownLeft, path: '/processing', colorClass: 'text-white', bgColorClass: 'bg-rose-500' }
  ];

  // Each row deep-links straight to its own item in the queue (?tab=...&focus=<id>)
  // instead of the generic /processing — this is the on-ramp into the specific
  // work, not just a restatement of the same counts the queue page also shows.
  const recentItems = [
    ...pendingProcessing.map(c => ({
      id: c.id,
      reference: `REIM-${c.id.substring(0, 6)}`,
      type: 'Process Reimbursement',
      status: c.status,
      amount: c.total_amount,
      date: c.created_at,
      path: `/processing?tab=queue&focus=${c.id}`
    })),
    ...pendingCadvReleases.map(c => ({
      id: c.id,
      reference: `CADV-${c.id.substring(0, 6)}`,
      type: 'Release Cash Advance',
      status: c.status,
      amount: c.amount,
      date: c.createdAt,
      path: `/processing?tab=cadv&focus=${c.id}`
    })),
    ...pendingRefunds.map(l => ({
      id: l.id,
      reference: `LIQ-${l.id.substring(0, 6)}`,
      type: 'Collect Refund',
      status: l.status,
      amount: Math.abs(l.varianceAmount || 0),
      date: l.createdAt,
      path: `/processing?tab=cadv&focus=${l.id}`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  const workloadData = [
    { name: 'Claims', value: pendingProcessing.length, color: CHART_COLORS[0] },
    { name: 'CADVs', value: pendingCadvReleases.length, color: CHART_COLORS[1] },
    { name: 'Refunds', value: pendingRefunds.length, color: CHART_COLORS[2] },
    { name: 'Shortfalls', value: pendingShortfalls.length, color: CHART_COLORS[3] }
  ].filter(w => w.value > 0);

  const ctx: MetricContext = { claims, cashAdvances: cadvs, liquidations: liqs, users: [], currentUser: user };
  const custodianMetricDefs = metricsForRole(UserRole.CUSTODIAN);
  const metricActionMap: Record<string, { actionLabel: string; actionPath: string }> = {
    custodian_payments_this_week: { actionLabel: 'Disbursement History', actionPath: '/processing?tab=history' },
    custodian_payments_this_month: { actionLabel: 'Disbursement History', actionPath: '/processing?tab=history' },
    custodian_monthly_reimbursement_total: { actionLabel: 'Disbursement History', actionPath: '/processing?tab=history' },
    custodian_avg_processing_time: { actionLabel: 'Disbursement History', actionPath: '/processing?tab=history' },
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <DashboardHeader
          user={user}
          summaryText={
            <>
              You have <strong className="font-bold text-slate-900">{pendingTotal} item{pendingTotal === 1 ? '' : 's'} pending</strong> finance operation actions.
            </>
          }
        />
        <div className="flex flex-col items-end gap-2.5">
          <QuickActionsCard actions={quickActions} layout="compact" />
          <DashboardPeriodFilter role={UserRole.CUSTODIAN} />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Operations Overview</h2>
        <p className="text-sm text-slate-500 mb-4">Monitor and process pending financial transactions — live, right now</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Pending Reimbursements"
            value={pendingProcessing.length}
            icon={Receipt}
            variant="warning"
            description="Approved claims to be processed"
            additionalContext={`${formatPHP(pendingProcessingAmt)} • Live`}
            actionLabel="Process Claims"
            actionPath="/processing"
          />
          <KPICard
            title="Approved Cash Advances"
            value={pendingCadvReleases.length}
            icon={CurrencyDollar}
            variant={pendingCadvReleases.length > 0 ? "action" : "success"}
            description="Approved cash advances to release"
            additionalContext={`${formatPHP(pendingCadvReleasesAmt)} • Live`}
            actionLabel="Release Advances"
            actionPath="/processing?tab=cadv"
          />
          <KPICard
            title="Pending Refunds"
            value={pendingRefunds.length}
            icon={ArrowDownLeft}
            variant={pendingRefunds.length > 0 ? "warning" : "success"}
            description="Refunds due from liquidations"
            additionalContext={`${formatPHP(pendingRefundsAmt)} • Live`}
            actionLabel="Collect Refunds"
            actionPath="/processing?tab=cadv"
          />
          <KPICard
            title="Active Shortfalls"
            value={pendingShortfalls.length}
            icon={WarningCircle}
            variant="danger"
            description="Shortfalls requiring claims"
            additionalContext={`${formatPHP(pendingShortfallsAmt)} • Live`}
            actionLabel="View Details"
            actionPath="/processing"
          />
        </div>
      </div>

      {/* Level 1: the actual disbursement/refund queue, right after the
          live Operations Overview KPIs — previously this sat below the
          analytics chart, behind the work it's summarizing. */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
        <RecentActivityTable title="Action Required" items={recentItems} emptyMessage="No finance operations are waiting — you're caught up." />
      </div>

      {/* Level 3: workflow-health metrics scoped to a period, below the
          live action queue. "Pending Payments" (count) and "Outstanding
          Amount" used to have their own "Right Now" row here, restating the
          exact same PROCESSING-claims set the Operations Overview "Pending
          Reimbursements" card above already shows — dropped as duplicates. */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Payment Performance</h2>
        <p className="text-sm text-slate-500 mb-4">Each card scoped to its own relevant period</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {custodianMetricDefs.filter(m => m.id !== 'custodian_pending_payments' && m.id !== 'custodian_outstanding_amount').map(metric => {
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

      {/* Level 4: analytics — last. */}
      <div className="mb-8">
        <AnalyticsCard title="Finance Operations Queue">
          {workloadData.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">Nothing pending right now — your queue is clear.</div>
          ) : (
            <DonutChart data={workloadData} centerCaption="Pending Items" />
          )}
        </AnalyticsCard>
      </div>
    </div>
  );
};
