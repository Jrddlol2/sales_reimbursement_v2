import React from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';
import { UserRole } from '../types';
import { RequestList } from './RequestList';

/**
 * Thin wrapper over the shared RequestList. Custodian/Admin see a system-wide
 * transaction log ('all'); everyone else (Requestor, and an Approver's own
 * history) sees only their own submissions ('own'). Route kept as-is so
 * existing /history bookmarks and dashboard deep-links keep working.
 */
export const TransactionHistory: React.FC = () => {
  const { user } = useAuth();
  const scope = (user?.role === UserRole.CUSTODIAN || user?.role === UserRole.ADMIN) ? 'all' : 'own';

  return (
    <RequestList
      title="Transaction History"
      description="Review and audit your complete submission history for reimbursements, cash advances, and liquidations."
      icon={ClockCounterClockwise}
      scope={scope}
      listTitle="Transaction Log"
      showRecordCount
      exportFilename="transaction_history.csv"
    />
  );
};
