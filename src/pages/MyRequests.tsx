import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, UserCircle, Wallet } from '@phosphor-icons/react';
import { RequestList } from './RequestList';

/**
 * Thin wrapper over the shared RequestList — the Approver's own submissions
 * (scope='own'), with the Requestor KPI strip and the submit/collect header
 * actions. Kept as its own route so /my-requests bookmarks and the KPI
 * deep-links keep working.
 */
export const MyRequests: React.FC = () => {
  return (
    <RequestList
      title="My Requests"
      description="Your own submitted reimbursements, cash advances, and liquidations — separate from your approval queue."
      icon={UserCircle}
      scope="own"
      showKpis
      kpiBasePath="/my-requests"
      listTitle="My Submission History"
      exportFilename="my_requests.csv"
      headerActions={
        <>
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
        </>
      }
    />
  );
};
