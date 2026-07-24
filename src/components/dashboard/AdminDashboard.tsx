import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Claim, CashAdvance, Liquidation, ClaimStatus, CashAdvanceStatus, LiquidationStatus, UserRole, SupportRequest, SupportRequestStatus, SupportRequestPriority } from '../../types';
import { apiFetch } from '../../lib/api';
import { KPICard } from './KPICard';
import { MetricCard } from './MetricCard';
import { DashboardPeriodFilter } from './DashboardPeriodFilter';
import { DashboardHeader } from './DashboardHeader';
import { QuickActionsCard } from './QuickActionsCard';
import { AnalyticsCard } from './AnalyticsCard';
import { DonutChart } from './AnalyticsCharts';
import { Users, FileText, Envelope, ShieldCheck, ChartBar, HardDrives, Archive, ArrowRight, Lifebuoy, Warning, Clock as ClockIcon } from '@phosphor-icons/react';
import { formatPHP, formatDateTime, getClaimNumber } from '../../utils';
import { metricsForRole, MetricContext } from '../../metrics/registry';
import { formatMetricValue } from './MetricCard';
import { useDashboardPeriod } from '../../contexts/DashboardPeriodContext';
import { resolveScope, scopeLabel } from '../../metrics/timeScope';
import { StatusBadge } from '../StatusBadge';

// Shared by both the Executive and System Admin views — the "who moved what"
// feed used to live only in Executive, leaving Admin's own view with nothing
// but static totals to answer "is anything stuck?".
const RecentActivityFeed: React.FC<{ items: any[] }> = ({ items }) => (
  <div className="corp-card divide-y divide-slate-100">
    {items.length === 0 ? (
      <div className="p-8 text-center text-sm text-slate-500">
        No system activity recorded yet. Activity will appear here as claims move through the workflow.
      </div>
    ) : (
      items.map((log: any, idx: number) => {
        const actorName = log.user?.name || log.changedBy?.name || log.changed_by || 'System';
        const reference = log.claim ? getClaimNumber(log.claim)
          : log.claim_id ? `REIM-${log.claim_id.substring(0, 6)}`
          : log.cash_advance_id ? `CADV-${log.cash_advance_id.substring(0, 6)}`
          : log.liquidation_id ? `LIQ-${log.liquidation_id.substring(0, 6)}`
          : log.delegation_id ? `DEL-${log.delegation_id.substring(0, 6)}`
          : log.targetUser ? log.targetUser.name
          : 'record';
        return (
          <div key={log.id || idx} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ClockIcon className="w-4 h-4 text-slate-300 shrink-0" />
              <p className="text-xs text-slate-700 truncate">
                <span className="font-bold text-slate-900">{actorName}</span> moved <span className="font-mono font-semibold text-slate-800">{reference}</span> to
              </p>
              <StatusBadge status={log.new_status} size="sm" />
            </div>
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">{formatDateTime(log.timestamp)}</span>
          </div>
        );
      })
    )}
  </div>
);

export const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [view, setView] = useState<'admin' | 'executive'>('executive');
  
  const [users, setUsers] = useState<User[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [cadvs, setCadvs] = useState<CashAdvance[]>([]);
  const [liqs, setLiqs] = useState<Liquidation[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const { resolveMetricRange, effectiveScope } = useDashboardPeriod();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/claims'),
      apiFetch('/api/cash-advances'),
      apiFetch('/api/liquidations'),
      apiFetch('/api/history'),
      apiFetch('/api/support')
    ]).then(([u, cl, ca, lq, hist, sr]) => {
      setUsers(u);
      setClaims(cl);
      setCadvs(ca);
      setLiqs(lq);
      setHistory(hist);
      setSupportRequests(sr);
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

  // --- ADMIN KPIs & DATA ---
  const todayHistory = history.filter(h => {
    const d = new Date(h.timestamp);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });
  
  // Open support tickets, colored by the highest-priority one waiting —
  // High -> danger red, Medium -> warning amber, Low -> neutral slate, so
  // the icon itself communicates urgency without opening the inbox.
  const openTickets = supportRequests.filter(sr => sr.status !== SupportRequestStatus.RESOLVED);
  const highestOpenPriority = openTickets.some(sr => sr.priority === SupportRequestPriority.HIGH) ? SupportRequestPriority.HIGH
    : openTickets.some(sr => sr.priority === SupportRequestPriority.MEDIUM) ? SupportRequestPriority.MEDIUM
    : openTickets.length > 0 ? SupportRequestPriority.LOW
    : undefined;
  const supportBgColorClass = highestOpenPriority === SupportRequestPriority.HIGH ? 'bg-red-500'
    : highestOpenPriority === SupportRequestPriority.MEDIUM ? 'bg-amber-500'
    : 'bg-slate-400';

  const quickActions = [
    { label: 'Manage Users', icon: Users, path: '/settings', colorClass: 'text-white', bgColorClass: 'bg-brand' },
    { label: 'Audit Log', icon: ShieldCheck, path: '/audit', colorClass: 'text-white', bgColorClass: 'bg-indigo-500' },
    { label: 'System Emails', icon: Envelope, path: '/emails', colorClass: 'text-white', bgColorClass: 'bg-amber-500' },
    {
      label: `Support Requests${openTickets.length > 0 ? ` (${openTickets.length} open, highest: ${highestOpenPriority})` : ''}`,
      icon: Lifebuoy,
      path: '/support',
      colorClass: 'text-white',
      bgColorClass: supportBgColorClass,
      badgeCount: openTickets.length,
      badgeColorClass: supportBgColorClass,
    }
  ];

  const adminStatusDistribution = [
    { name: 'Claims', value: claims.length, color: '#2563eb' },
    { name: 'CADVs', value: cadvs.length, color: '#10b981' },
    { name: 'Liquidations', value: liqs.length, color: '#f59e0b' }
  ];

  const ctx: MetricContext = { claims, cashAdvances: cadvs, liquidations: liqs, users, currentUser: user };
  const adminOperationalMetrics = metricsForRole(UserRole.ADMIN).filter(m => m.section !== 'all_time');
  const adminAllTimeMetrics = metricsForRole(UserRole.ADMIN).filter(m => m.section === 'all_time');
  // Read-only oversight only — Admin never gets actionLabel/actionPath here,
  // since Admin can't process payments (segregation of duties, not an
  // oversight).
  const adminPaymentRightNow = metricsForRole(UserRole.CUSTODIAN).filter(m => m.id === 'custodian_pending_payments' || m.id === 'custodian_outstanding_amount');
  const adminPaymentThisPeriod = metricsForRole(UserRole.CUSTODIAN).filter(m => m.id !== 'custodian_pending_payments' && m.id !== 'custodian_outstanding_amount');
  const metricActionMap: Record<string, { actionLabel: string; actionPath: string }> = {
    admin_pending_approvals_systemwide: { actionLabel: 'View Audit Log', actionPath: '/audit' },
    admin_monthly_claims: { actionLabel: 'View Audit Log', actionPath: '/audit' },
    admin_yearly_spending: { actionLabel: 'View Audit Log', actionPath: '/audit' },
    admin_active_users: { actionLabel: 'Manage Users', actionPath: '/users' },
    admin_approval_performance: { actionLabel: 'View Audit Log', actionPath: '/audit' },
  };

  // Recent System Activity — reuses the same history feed already fetched for
  // the "audit events today" count, just surfaced as a readable who/what/status
  // feed instead of only a number. No new data source.
  const recentSystemActivity = [...history]
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  // System-wide backlog/anomaly line for the Admin view — replaces the
  // hardcoded "System Status: Operational" tile (which carried no real
  // signal) with the same "is anything stuck?" question the Executive view's
  // admin_pending_approvals_systemwide metric answers, plus how long the
  // oldest one has been waiting.
  const systemWidePending = claims.filter(c => c.status === ClaimStatus.PENDING_APPROVAL);
  const oldestSystemWidePendingDays = systemWidePending.length > 0
    ? Math.max(...systemWidePending.map(c => Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24))))
    : 0;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-8">
        <DashboardHeader
           user={user}
           summaryText={view === 'executive'
             ? <>Enterprise Overview: <strong className="font-bold text-slate-900">{claims.length + cadvs.length + liqs.length} total lifetime requests</strong>.</>
             : <>System Health: <strong className="font-bold text-slate-900">{users.length} active users</strong>, <strong className="font-bold text-slate-900">{todayHistory.length} audit events</strong> today.</>}
        />
        <div className="flex flex-col items-end gap-2.5">
          <QuickActionsCard actions={quickActions} layout="compact" />
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === 'executive' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setView('executive')}
            >
              Executive Overview
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === 'admin' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setView('admin')}
            >
              System Admin
            </button>
          </div>
          {view === 'executive' && <DashboardPeriodFilter role={UserRole.ADMIN} />}
        </div>
      </div>

      {view === 'executive' ? (
        <>
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <ChartBar className="w-4 h-4 text-brand" /> Executive Overview
            </h2>
            <p className="text-sm text-slate-500">Enterprise performance, financial summaries, and claim analytics — each figure scoped to its own period</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {adminOperationalMetrics.map(metric => {
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

          <div className="mb-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-800">Recent System Activity</h2>
              <Link to="/audit" className="text-xs font-bold text-brand hover:text-brand-hover inline-flex items-center gap-1">
                View Full Audit Log <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
            <p className="text-sm text-slate-500 mb-4">Latest status changes across every claim, cash advance, and liquidation</p>
            <RecentActivityFeed items={recentSystemActivity} />
          </div>

          {/* No trend chart on this dashboard — /reporting owns every trend,
              category, and department view (including its own monthly spend
              trend, scoped to whatever date window the admin picks there),
              so this stays a single on-ramp card instead of a second,
              fixed-12-month copy of the same analysis. */}
          <Link
            to="/reporting"
            className="corp-card p-6 flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow-md transition-all group mb-8"
          >
            <div className="flex items-center gap-4">
              <ChartBar className="w-8 h-8 text-brand shrink-0" weight="duotone" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Full Analytics Report</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Spend trends, category breakdowns, department comparisons, and claim volume — the deep-dive view.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand group-hover:gap-1.5 transition-all shrink-0">
              View Full Report <ArrowRight size={14} weight="bold" />
            </span>
          </Link>

          {/* All-Time stats — visually separated (grey, no period filter applies) so
              they're never confused with the operational metrics above. */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">All-Time System Stats</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {adminAllTimeMetrics.map(metric => (
                <MetricCard key={metric.id} metric={metric} ctx={ctx} scope="all_time" value={metric.compute(ctx, resolveScope('all_time'))} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <HardDrives className="w-4 h-4 text-slate-500" /> System Administration
            </h2>
            <p className="text-sm text-slate-500">Operational health, system management, and access controls</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard title="Total Users" value={users.length} icon={Users} colorClass="text-slate-600 bg-white" />
            <KPICard title="Total Requests" value={claims.length + cadvs.length} icon={FileText} colorClass="text-slate-600 bg-white" />
            <KPICard title="System Audit (Today)" value={todayHistory.length} icon={ShieldCheck} colorClass="text-slate-600 bg-white" />
            <KPICard
              title="System-wide Backlog"
              value={systemWidePending.length}
              icon={Warning}
              variant={systemWidePending.length === 0 ? 'success' : oldestSystemWidePendingDays >= 5 ? 'danger' : oldestSystemWidePendingDays >= 3 ? 'warning' : 'action'}
              description="Claims awaiting an Approver decision, across every department"
              additionalContext={systemWidePending.length > 0 ? `Oldest: ${oldestSystemWidePendingDays}d` : 'Nothing pending'}
              actionLabel="View Audit Log"
              actionPath="/audit"
            />
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-800">Recent System Activity</h2>
              <Link to="/audit" className="text-xs font-bold text-brand hover:text-brand-hover inline-flex items-center gap-1">
                View Full Audit Log <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
            <p className="text-sm text-slate-500 mb-4">Latest status changes across every claim, cash advance, and liquidation</p>
            <RecentActivityFeed items={recentSystemActivity} />
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-800">Payment Performance</h2>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Read-only</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">Custodian disbursement oversight — Admin cannot process payments</p>

            {/* Compact read-only strip, not a second operational console —
                same numbers Custodian's own dashboard shows, at a glance
                rather than as a full second set of KPI cards. */}
            <div className="corp-card px-5 py-4 flex flex-wrap gap-x-8 gap-y-4">
              {[...adminPaymentRightNow, ...adminPaymentThisPeriod].map(metric => (
                <div key={metric.id} className="min-w-[110px]">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{metric.label}</div>
                  <div className="text-base font-extrabold text-slate-800 mt-0.5 tabular-nums">
                    {formatMetricValue(metric.compute(ctx, resolveMetricRange(metric)), metric.format)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{metric.realtime ? 'Live' : scopeLabel(effectiveScope(metric))}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <AnalyticsCard title="System Data Distribution">
              <DonutChart data={adminStatusDistribution} />
            </AnalyticsCard>
          </div>
        </>
      )}
    </div>
  );
};
