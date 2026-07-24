import React, { useState } from 'react';
import { UserRole } from '../types';
import { formatPHP, exportRequestsToCSV } from '../utils';
import { useAuth } from '../components/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { WorkflowOwnerTag } from '../components/WorkflowOwnerTag';
import { ClockCounterClockwise, CaretRight, Funnel } from '@phosphor-icons/react';
import { EmptyState } from '../components/EmptyState';
import { Pagination, usePagination } from '../components/Pagination';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DownloadSimple } from '@phosphor-icons/react';
import { useUnifiedRequestList } from '../hooks/useUnifiedRequestList';

export const TransactionHistory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // /api/claims etc. return everything the caller's role can see — for an
  // Approver that includes their direct reports' claims too (needed for the
  // approval queue), not just their own submissions. This page is
  // specifically the Approver's own history, so scope it down the same way
  // MyRequests.tsx does. Requestor/Custodian keep their existing
  // (already-correct) unfiltered behavior — for Custodian in particular this
  // is a system-wide transaction log, not a personal one.
  const isOwn = user?.role === UserRole.APPROVER;
  const { items, loading } = useUnifiedRequestList(isOwn ? user!.id : undefined);

  // Filters state
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<'All' | 'Reimbursement' | 'Cash Advance' | 'Liquidation'>((searchParams.get('type') as any) || 'All');
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || 'All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const ITEMS_PER_PAGE = 10;

  // Derived filters — computed unconditionally (before the loading return
  // below) so usePagination, itself a hook, is never called conditionally.
  const uniqueStatuses = Array.from(new Set(items.map(item => item.status))).sort();

  const filteredItems = items.filter(item => {
    const matchesType = selectedType === 'All' || item.type === selectedType;
    const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;

    let matchesDate = true;
    if (startDate) {
      const itemDateStr = item.date ? item.date.substring(0, 10) : '';
      matchesDate = matchesDate && itemDateStr >= startDate;
    }
    if (endDate) {
      const itemDateStr = item.date ? item.date.substring(0, 10) : '';
      matchesDate = matchesDate && itemDateStr <= endDate;
    }

    return matchesType && matchesStatus && matchesDate;
  });

  const { currentPage, setPage, totalPages, paginatedItems, totalItems } = usePagination(filteredItems, ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Header */}
        <div className="animate-pulse">
          <div className="h-7 w-48 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-md"></div>
        </div>

        {/* Skeleton Filter controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 h-16 animate-pulse flex items-center justify-between">
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-slate-100 rounded"></div>
            <div className="h-8 w-32 bg-slate-100 rounded"></div>
            <div className="h-8 w-28 bg-slate-100 rounded"></div>
          </div>
          <div className="h-8 w-44 bg-slate-100 rounded"></div>
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
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  const handleExport = () => exportRequestsToCSV(filteredItems, 'transaction_history.csv');

  const types: Array<'All' | 'Reimbursement' | 'Cash Advance' | 'Liquidation'> = [
    'All',
    'Reimbursement',
    'Cash Advance',
    'Liquidation'
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display flex items-center gap-2">
          <ClockCounterClockwise className="w-5 h-5 text-brand" /> Transaction History
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Review and audit your complete submission history for reimbursements, cash advances, and liquidations.
        </p>
      </div>

      {/* Filter controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Type Filter Tabs */}
          <div className="flex flex-wrap gap-1 border-b md:border-b-0 border-gray-200 w-full md:w-auto">
            {types.map(t => (
              <button
                key={t}
                onClick={() => {
                  setSelectedType(t);
                  setPage(1);
                }}
                className={`px-4 py-2 text-xs font-bold border-b-2 md:border-b-0 md:rounded-md -mb-px md:mb-0 transition-all ${
                  selectedType === t
                    ? 'border-brand text-brand md:bg-brand md:text-white md:border-transparent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 md:hover:bg-slate-50'
                }`}
              >
                {t === 'All' ? 'All Types' : t}
              </button>
            ))}
          </div>

          {/* Status Filter Select */}
          <div className="flex items-center gap-2 min-w-[220px] w-full md:w-auto">
            <Funnel className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              Status:
            </span>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                searchParams.set('status', e.target.value);
                setSearchParams(searchParams);
                setPage(1);
              }}
              className="block w-full md:w-48 border border-gray-300 rounded px-3 py-1.5 text-xs focus:border-brand focus:ring-brand focus:outline-none bg-white text-slate-700"
            >
              <option value="All">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              From Date:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="block w-full sm:w-40 border border-gray-300 rounded px-3 py-1.5 text-xs focus:border-brand focus:ring-brand focus:outline-none bg-white text-slate-700"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              To Date:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="block w-full sm:w-40 border border-gray-300 rounded px-3 py-1.5 text-xs focus:border-brand focus:ring-brand focus:outline-none bg-white text-slate-700"
            />
          </div>

          
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="text-xs font-semibold text-brand hover:underline self-end sm:self-auto"
            >
              Clear Dates
            </button>
          )}
          
          <div className="flex-1"></div>
          <button
            onClick={handleExport}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <DownloadSimple className="w-4 h-4" />
            Export CSV
          </button>

        </div>
      </div>

      {/* Main Table view */}
      <div className="corp-card flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Transaction Log ({filteredItems.length} records)
          </h3>
        </div>
        <div className="overflow-x-auto rounded-b-xl">
          {paginatedItems.length === 0 ? (
            <EmptyState icon={ClockCounterClockwise} title="No transactions found" description="No transactions matching the selected filters were found." />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="corp-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr
                        key={`${item.type}-${item.id}`}
                        className="cursor-pointer"
                        onClick={() => navigate(item.path)}
                      >
                        <td>
                          <span className="font-mono font-medium">{item.reference}</span>
                        </td>
                        <td>
                          <span className="font-medium text-slate-800">{item.type}</span>
                        </td>
                        <td>
                          <span className="font-semibold text-slate-900">{formatPHP(item.amount)}</span>
                        </td>
                        <td>
                          <span className="text-slate-500 text-xs">
                            {item.date ? new Date(item.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : '—'}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={item.status} size="sm" />
                            <WorkflowOwnerTag status={item.status} requestorName={item.requestorName} approverName={item.approverName} />
                          </div>
                        </td>
                        <td className="text-right">
                          <CaretRight size={16} weight="bold" className="text-slate-400 inline-block" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                {paginatedItems.map(item => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-4 hover:bg-slate-50 cursor-pointer flex flex-col gap-2.5 transition-colors"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand">{item.reference}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <StatusBadge status={item.status} size="sm" />
                        <WorkflowOwnerTag status={item.status} requestorName={item.requestorName} approverName={item.approverName} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Type:</span>
                        <span className="font-semibold text-slate-800">{item.type}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 font-medium mr-1">Amount:</span>
                        <span className="font-extrabold text-slate-900">{formatPHP(item.amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Date:</span>
                        <span className="text-slate-700">
                          {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="text-right flex items-center justify-end gap-0.5 text-brand font-bold">
                        <span>View details</span>
                        <CaretRight size={12} weight="bold" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
