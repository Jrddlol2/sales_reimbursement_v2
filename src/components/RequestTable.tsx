import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretRight, ClockCounterClockwise } from '@phosphor-icons/react';
import { formatPHP } from '../utils';
import { StatusBadge } from './StatusBadge';
import { WorkflowOwnerTag } from './WorkflowOwnerTag';
import { EmptyState } from './EmptyState';
import { UnifiedRequestItem } from '../hooks/useUnifiedRequestList';

interface RequestTableProps {
  // Card header text — callers usually fold a record count into it, e.g.
  // `Transaction Log (12 records)`.
  title: string;
  items: UnifiedRequestItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  // Rendered inside the card, below the rows, only when there are items —
  // typically a <Pagination>. Kept a slot (rather than baked in) so pagination
  // state stays owned by the page.
  footer?: React.ReactNode;
  // Optional per-row actions. When provided, replaces the default chevron in
  // the last column; the cell stops click propagation so buttons don't also
  // trigger the row's navigate. Future callers (e.g. an approval queue) can
  // hang decision buttons here without the table owning any of that logic.
  renderActions?: (item: UnifiedRequestItem) => React.ReactNode;
}

/**
 * Shared reverse-chronological request list — the desktop table + mobile card
 * renderer extracted verbatim from TransactionHistory so the same rows can be
 * reused across pages that show UnifiedRequestItem lists, instead of each page
 * hand-rolling its own copy.
 */
export const RequestTable: React.FC<RequestTableProps> = ({
  title,
  items,
  emptyTitle = 'No transactions found',
  emptyDescription = 'No transactions matching the selected filters were found.',
  footer,
  renderActions,
}) => {
  const navigate = useNavigate();

  return (
    <div className="corp-card flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
      </div>
      <div className="overflow-x-auto rounded-b-xl">
        {items.length === 0 ? (
          <EmptyState icon={ClockCounterClockwise} title={emptyTitle} description={emptyDescription} />
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
                  {items.map(item => (
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
                      <td
                        className="text-right"
                        onClick={renderActions ? (e) => e.stopPropagation() : undefined}
                      >
                        {renderActions
                          ? renderActions(item)
                          : <CaretRight size={16} weight="bold" className="text-slate-400 inline-block" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="sm:hidden flex flex-col divide-y divide-slate-100">
              {items.map(item => (
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

            {footer}
          </>
        )}
      </div>
    </div>
  );
};
