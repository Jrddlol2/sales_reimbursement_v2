import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { ClaimStatus, UserRole, ReviewMeetingStatus } from '../types';
import {
  FileText, CheckCircle, Question, Warning,
  MapPin, Calendar, Clock, CurrencyDollar, Shield, Check, Info, ArrowRight,
  PencilSimple, Download, ArrowCounterClockwise, Lifebuoy, Printer
} from '@phosphor-icons/react';
import { formatPHP, formatDate, getClaimNumber, getUploadUrl } from '../utils';
import { CLAIM_WORKFLOW_STAGES, getWorkflowStageIndex, getStatusConfig } from '../statusConfig';
import { MomEditForm } from '../components/MomEditForm';
import { ClaimMomSummary } from '../components/ClaimMomSummary';
import { ClaimLineItems } from '../components/ClaimLineItems';
import { ClaimApprovalInfo } from '../components/ClaimApprovalInfo';
import { ClaimActivityTimeline } from '../components/ClaimActivityTimeline';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { WorkflowOwnerTag } from '../components/WorkflowOwnerTag';
import { WorkflowTimeline } from '../components/WorkflowTimeline';
import { DetailHeader } from '../components/DetailHeader';
import { SummaryCard } from '../components/SummaryCard';
import { Attachments } from '../components/Attachments';
import { Comments, CommentEntry } from '../components/Comments';
import { EmptyState } from '../components/EmptyState';

const workflowStepIndex = (status: ClaimStatus) => {
  if (status === ClaimStatus.REJECTED || status === ClaimStatus.RETURNED) return 1;
  return getWorkflowStageIndex(CLAIM_WORKFLOW_STAGES, status);
};

interface ClaimDetailProps {
  claimId?: string;
  onClose?: () => void;
  onUpdate?: () => void;
}

export const ClaimDetail: React.FC<ClaimDetailProps> = ({ claimId: propClaimId, onClose: propOnClose, onUpdate: propOnUpdate }) => {
  const { id: routeClaimId } = useParams<{ id: string }>();
  const claimId = propClaimId || routeClaimId || '';
  const navigate = useNavigate();
  const onClose = propOnClose || (() => navigate(-1));
  const onUpdate = propOnUpdate || (() => {});

  const { user } = useAuth();
  const toast = useToast();
  const confirmAction = useConfirm();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showClaimPrompt, setShowClaimPrompt] = useState(false);
  const [claimCodeInput, setClaimCodeInput] = useState("");

  const [comment, setComment] = useState('');
  const [editingMom, setEditingMom] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Admin re-assignment state
  const [users, setUsers] = useState<any[]>([]);
  const [newApproverId, setNewApproverId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  const [previewFile, setPreviewFile] = useState<{ type: 'mom' | 'receipt', url: string, name: string } | null>(null);

  // Review Meeting reschedule state (Requestor, only usable after a decline)
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const fetchClaimDetails = () => {
    setLoading(true);
    apiFetch(`/api/claims/${claimId}`)
      .then((data) => {
        setClaim(data);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load claim details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClaimDetails();
    // Needed for both the Admin reassignment dropdown and to resolve the
    // approver's display name in the Approval summary for any viewer.
    apiFetch('/api/users').then(setUsers).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId, user]);


  const handleApproveReject = async (decision: string) => {
    const action = decision === 'Approved' ? 'approve' : decision === 'Rejected' ? 'reject' : 'return';
    if ((action === 'reject' || action === 'return') && !comment) {
      return toast.error('A brief comment is required to return or reject this claim.');
    }
    if (isSubmittingDecision) return;
    const ok = await confirmAction({
      title: decision === 'Approved' ? 'Approve this claim?' : decision === 'Rejected' ? 'Reject this claim?' : 'Return this claim for revision?',
      message: decision === 'Approved'
        ? 'This will approve the claim and route it to Finance for processing.'
        : decision === 'Rejected'
          ? 'This will reject the claim. The Requestor will be notified and this decision cannot be undone.'
          : 'This will send the claim back to the Requestor for revision.',
      confirmLabel: `Yes, ${decision}`,
      cancelLabel: 'Cancel',
      tone: decision === 'Rejected' ? 'danger' : 'default',
    });
    if (!ok) return;
    setIsSubmittingDecision(true);
    // Close immediately once the user has confirmed — the request continues
    // in the background instead of leaving the panel open (and its buttons
    // clickable) for the whole round-trip. The toast still fires from the
    // global Toast context if this ends up failing after the panel is gone.
    onClose();
    try {
      await apiFetch(`/api/claims/${claimId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment })
      });
      toast.success(`Claim has been successfully ${decision.toLowerCase()}!`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update approval decision.');
      onUpdate();
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleReassign = async () => {
    if (!newApproverId || !reassignReason) {
      return toast.error('Please select a new approver and provide a brief justification.');
    }
    try {
      await apiFetch(`/api/claims/${claimId}/reassign`, {
        method: 'PUT',
        body: JSON.stringify({ new_approver_id: newApproverId, reason: reassignReason })
      });
      toast.success('Claim successfully reassigned to the new approver!');
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign');
    }
  };

  const handleClaimPayment = async () => {
    if (!claimCodeInput.trim()) {
      return toast.error('Please enter the Claim Code');
    }
    try {
      await apiFetch(`/api/claims/${claimId}/claim`, { 
        method: 'POST',
        body: JSON.stringify({ code: claimCodeInput })
      });
      toast.success('Claim marked as Completed! Your receipt confirmation has been logged.');
      setShowClaimPrompt(false);
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize claim');
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      return toast.error('Please pick a new date and time.');
    }
    try {
      await apiFetch(`/api/review-meetings/${claim.reviewMeeting.id}/reschedule`, {
        method: 'PUT',
        body: JSON.stringify({ meeting_date: rescheduleDate, meeting_time: rescheduleTime })
      });
      toast.success('New Review Meeting time proposed. Your Approver has been notified.');
      setShowReschedule(false);
      setRescheduleDate('');
      setRescheduleTime('');
      fetchClaimDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to propose a new time.');
    }
  };

  const claimNumber = claim ? getClaimNumber(claim) : `REIM-${claimId.substring(0, 6)}`;

  // Set only when the claim was routed via an active delegation - lets the
  // Requestor see it's actually with a delegate, not their real manager.
  const isDelegated = !!(claim?.original_approver_id && claim.original_approver_id !== claim.current_approver_id);
  const delegateApproverName = isDelegated ? users.find(u => u.id === claim!.current_approver_id)?.name : undefined;
  const originalApproverName = isDelegated ? users.find(u => u.id === claim!.original_approver_id)?.name : undefined;
  // Non-delegated case — resolve "Currently with Approver" to the actual
  // current approver's name wherever the id is known.
  const currentApproverName = claim ? users.find(u => u.id === claim.current_approver_id)?.name : undefined;

  const drawerContent = (
    <Drawer onClose={onClose}>
      
      {/* Preview Section (Left Side) */}
      {previewFile && (
        <div className="flex-1 hidden lg:flex flex-col relative bg-slate-900/90 border-r border-slate-800">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="bg-slate-800 rounded-lg shadow-2xl overflow-hidden w-full flex flex-col" style={{ height: '85vh', maxWidth: '850px' }}>
              <div className="bg-slate-950 px-4 py-3 flex justify-between items-center border-b border-slate-800">
                <span className="text-slate-300 font-mono text-xs">{previewFile.name}</span>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{previewFile.type}</span>
              </div>
              <div className="flex-1 bg-slate-900 flex items-center justify-center p-0 relative">
                {previewFile.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={previewFile.url} className="w-full h-full border-0" title={previewFile.name} />
                ) : (
                  <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain drop-shadow-xl" onError={(e) => {
                    (e.target as any).style.display = 'none';
                    if ((e.target as any).nextElementSibling) {
                      (e.target as any).nextElementSibling.style.display = 'flex';
                    }
                  }} />
                )}
                <div className="hidden flex-col items-center justify-center text-slate-500 w-full h-full absolute inset-0 bg-slate-900">
                  <FileText className="w-12 h-12 mb-3 opacity-50" />
                  <span className="text-sm">Document not found</span>
                  <span className="text-xs text-slate-600 mt-2">{previewFile.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slider / Panel (Right Side) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${claimNumber} details`}
        className={`bg-white shadow-2xl h-full flex flex-col relative z-10 animate-fade-in ${previewFile ? 'w-full lg:w-[600px] xl:w-[700px] shrink-0' : 'w-full'}`}
      >
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
          <DetailHeader
            eyebrow="Reimbursement Request"
            title={claimNumber}
            status={claim && (
              <>
                <StatusBadge status={claim.status} />
                {isDelegated && delegateApproverName ? (
                  <span className="text-[10px] font-semibold text-slate-400 ml-1.5">
                    Currently with <span className="text-slate-600 font-bold">{delegateApproverName}</span>
                    {originalApproverName && <> (on behalf of <span className="text-slate-600 font-bold">{originalApproverName}</span>)</>}
                  </span>
                ) : (
                  <WorkflowOwnerTag
                    status={claim.status}
                    className="ml-1.5"
                    requestorName={claim.requestor?.name}
                    approverName={currentApproverName}
                  />
                )}
              </>
            )}
            onClose={onClose}
            actions={
              <>
                
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 print:hidden"
                >
                  <Printer className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                  Print Summary
                </button>
                <Link to={`/support?new=true&entityType=Claim&entityId=${claim?.id}`} className="px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 print:hidden">

                  <Lifebuoy className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                  Request Help
                </Link>
                {claim && claim.receipt_url && (
                  <button
                    onClick={() => setPreviewFile(previewFile?.type === 'receipt' ? null : { type: 'receipt', url: getUploadUrl(claim.receipt_url), name: claim.receipt_url.split('/').pop() || 'Receipt' })}
                    className={`px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors ${previewFile?.type === 'receipt' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <FileText className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    Receipt
                  </button>
                )}
                {claim && claim.mom?.file_url && (
                  <button
                    onClick={() => setPreviewFile(previewFile?.type === 'mom' ? null : { type: 'mom', url: getUploadUrl(claim.mom.file_url), name: claim.mom.file_name || 'MOM Document' })}
                    className={`px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors ${previewFile?.type === 'mom' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <FileText className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    Minutes
                  </button>
                )}
              </>
            }
          />
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50">
          {loading ? (
            <EmptyState icon={Clock} title="Loading claim" description="Reading claim database..." />
          ) : !claim ? (
            <EmptyState icon={Warning} title="Not found" description="Reimbursement claim details not found." />
          ) : (
            <>
              {/* STATUS BADGE + WORKFLOW TIMELINE */}
              <WorkflowTimeline
                steps={CLAIM_WORKFLOW_STAGES}
                currentIndex={workflowStepIndex(claim.status)}
                variant={claim.status === ClaimStatus.REJECTED ? 'error' : claim.status === ClaimStatus.RETURNED ? 'warning' : 'default'}
                variantLabel={claim.status === ClaimStatus.REJECTED ? 'REJECTED' : claim.status === ClaimStatus.RETURNED ? 'RETURNED TO REQUESTOR' : undefined}
              />

              {/* SUMMARY */}
              <SummaryCard title="Summary">
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-50 p-3.5 border border-slate-200 rounded flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                    <div>
                      <span className="text-slate-400 font-bold mr-1.5 font-display">Claimant:</span>
                      <span className="font-extrabold text-slate-900">{claim.requestor?.name || 'Claimant'}</span>
                      <span className="text-slate-500 font-mono ml-1.5">({claim.requestor?.email || ''})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold mr-1.5 font-display">Department:</span>
                      <span className="font-bold text-slate-800">
                        {claim.requestor?.job_title ? `${claim.requestor.job_title} · ${claim.requestor.department}` : claim.requestor?.department || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5 font-display">Expense Category</span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 inline-block mt-0.5 uppercase tracking-wide font-mono">{claim.expense_category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5 font-display">Business Remarks & Justification</span>
                    <p className="text-slate-700 bg-slate-50 p-3 border border-brand/10 rounded leading-relaxed italic">
                      {claim.remarks || 'No descriptive comments provided.'}
                    </p>
                  </div>
                </div>
              </SummaryCard>

              {/* FINANCIAL INFORMATION */}
              <SummaryCard title="Financial Information">
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5 font-display">Amount in PHP (₱)</span>
                    <span className="font-extrabold text-brand text-sm font-display">{formatPHP(claim.total_amount)}</span>
                  </div>
                  {(claim.release_code || claim.payment_method) && (
                    <div className="pt-3 border-t border-brand/10 bg-brand-active/30 -mx-4 -mb-4 px-4 pb-4 space-y-2">
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div>
                          <span className="text-gray-500 font-semibold block">Payment Method</span>
                          <span className="font-bold text-gray-900">{claim.payment_method || 'Cash Release'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 font-semibold block">Claim Code</span>
                          <span className="font-mono font-bold text-brand tracking-wider text-sm">{claim.release_code || '—'}</span>
                        </div>
                      </div>
                      {claim.status === ClaimStatus.READY_FOR_CLAIM && user?.id === claim.requestor_id && (
                        <div className="pt-3 border-t border-brand/10 space-y-2">
                          <p className="text-[10px] text-gray-600 leading-normal font-medium">
                            The Custodian has marked your funds as ready! Present your unique Claim Code to claim cash. Click below once you have collected the money.
                          </p>
                          {showClaimPrompt ? (
                            <div className="space-y-2 pt-2">
                              <input
                                type="text"
                                placeholder="Enter Claim Code"
                                value={claimCodeInput}
                                onChange={(e) => setClaimCodeInput(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none uppercase"
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => setShowClaimPrompt(false)}
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleClaimPayment}
                                  variant="success"
                                  size="sm"
                                  className="flex-1"
                                  icon={<Check className="w-3 h-3" />}
                                >
                                  Submit
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              onClick={() => setShowClaimPrompt(true)}
                              variant="success"
                              className="w-full"
                              icon={<Check className="w-4 h-4" />}
                            >
                              Claim Reimbursement
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SummaryCard>

              {/* ATTACHMENTS */}
              <SummaryCard title="Attachments" bodyClassName="p-0">
                <ClaimLineItems expenses={claim.expenses} totalAmount={claim.total_amount} fallbackReceiptUrl={claim.receipt_url} onPreviewReceipt={(url) => setPreviewFile({ type: 'receipt', url: getUploadUrl(url), name: url.split('/').pop() || 'Receipt' })} />
                {claim.supporting_documents && (
                  <Attachments
                    items={[{ id: 'supporting-doc', name: 'Supporting Document', meta: claim.supporting_documents }]}
                  />
                )}
              </SummaryCard>

              {/* REVIEW MEETING STATUS */}
              {claim.reviewMeeting && (
                <SummaryCard title="Review Meeting">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {formatDate(claim.reviewMeeting.meeting_date)} at {claim.reviewMeeting.meeting_time}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Internal review call with your Approver — separate from the client meeting.</div>
                      </div>
                    </div>
                    <StatusBadge status={claim.reviewMeeting.status} />
                  </div>

                  {claim.reviewMeeting.status === ReviewMeetingStatus.DECLINE_REQUESTED && claim.reviewMeeting.decline_reason && (
                    <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2.5">
                      <span className="font-bold block mb-0.5">Approver's reason:</span> "{claim.reviewMeeting.decline_reason}"
                    </div>
                  )}

                  {claim.reviewMeeting.status === ReviewMeetingStatus.DECLINE_REQUESTED && user?.id === claim.requestor_id && (
                    <div className="mt-3">
                      {!showReschedule ? (
                        <button
                          type="button"
                          onClick={() => setShowReschedule(true)}
                          className="text-xs font-bold text-brand hover:text-brand-hover"
                        >
                          Propose a New Time
                        </button>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end mt-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Date</label>
                            <input
                              type="date"
                              value={rescheduleDate}
                              onChange={e => setRescheduleDate(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Time</label>
                            <input
                              type="time"
                              value={rescheduleTime}
                              onChange={e => setRescheduleTime(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowReschedule(false)}
                              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-bold text-gray-600 bg-white"
                            >
                              Cancel
                            </button>
                            <button type="button" onClick={handleReschedule} className="corp-btn-primary text-xs">
                              Propose Time
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SummaryCard>
              )}

              {/* LINKED MINUTES OF MEETING */}
              {claim.mom && (
                <SummaryCard
                  title="Linked Minutes of Meeting"
                  actions={user?.role === UserRole.APPROVER && claim.status === ClaimStatus.PENDING_APPROVAL && !editingMom && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMom(true)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-brand-hover normal-case"
                      >
                        <PencilSimple className="w-3 h-3" /> Edit / Replace
                      </button>
                      {claim.mom.file_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ type: 'mom', url: getUploadUrl(claim.mom.file_url), name: claim.mom.file_name || 'MOM Document' })}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800 normal-case"
                        >
                          <FileText className="w-3 h-3" /> View Minutes
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toast.info(`Downloading MOM document: ${claim.mom.file_name || `${(claim.mom.client || 'meeting').replace(/\s+/g, '_')}_MOM.pdf`}`)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800 normal-case"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      )}
                    </div>
                  )}
                >
                  {editingMom ? (
                    <MomEditForm
                      mom={claim.mom}
                      onSaved={(updatedMom) => {
                        setClaim({ ...claim, mom: updatedMom });
                        setEditingMom(false);
                      }}
                      onCancel={() => setEditingMom(false)}
                    />
                  ) : (
                    <ClaimMomSummary mom={claim.mom} />
                  )}
                </SummaryCard>
              )}

              {/* APPROVAL SUMMARY */}
              {(claim.approvals || []).some((a: any) => a.decision === 'Approved') && (
                <SummaryCard title="Approval Information">
                  <ClaimApprovalInfo claim={claim} users={users} />
                </SummaryCard>
              )}

              {/* COMMENTS */}
              <SummaryCard title="Comments">
                <Comments
                  comments={(claim.approvals || []).map((a: any): CommentEntry => ({
                    id: a.id,
                    author: users.find(u => u.id === a.approver_id)?.name || 'Approver',
                    role: 'Approver',
                    body: a.comment,
                    timestamp: a.timestamp,
                    decision: a.decision,
                  }))}
                  emptyText="No approver remarks have been recorded on this claim yet."
                />
              </SummaryCard>

              {/* AUDIT HISTORY */}
              {claim.history && claim.history.length > 0 && (
                <SummaryCard title="Audit History">
                  <ClaimActivityTimeline history={claim.history} />
                </SummaryCard>
              )}

              {/* REQUESTOR: REVISE & RESUBMIT A RETURNED CLAIM */}
              {claim.status === ClaimStatus.RETURNED && user?.id === claim.requestor_id && (
                <div className="border border-amber-300 rounded p-5 space-y-3 bg-amber-50 shadow-sm">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block border-b border-amber-100 pb-1.5">
                    {getStatusConfig(ClaimStatus.RETURNED).label}
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    Your Approver returned this claim - see their comment above. Update the details and resubmit; it will go back to Pending Approval and your Approver will be notified.
                  </p>
                  <button
                    onClick={() => { onClose(); navigate(`/claims/${claim.id}/resubmit`); }}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ArrowCounterClockwise className="w-4 h-4" /> Revise & Resubmit
                  </button>
                </div>
              )}

              {/* ADMIN ACTION REASSIGNMENT */}
              {user?.role === UserRole.ADMIN && [ClaimStatus.PENDING_APPROVAL, ClaimStatus.PROCESSING, ClaimStatus.RETURNED].includes(claim.status) && (
                <div className="border border-purple-500 border-opacity-30 bg-purple-50 bg-opacity-20 rounded p-5 space-y-3 shadow-sm">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block border-b border-purple-100 pb-1">
                    Administrative Reassignment (Segregation Audit Override)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Assigned Approver</label>
                      <select
                        value={newApproverId}
                        onChange={e => setNewApproverId(e.target.value)}
                        className="block w-full border border-gray-300 rounded p-1.5 text-xs focus:outline-none focus:border-purple-500"
                      >
                        <option value="">-- Choose Approver --</option>
                        {users.filter(u => u.role === UserRole.APPROVER && u.id !== claim.requestor_id).map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Reason for Change</label>
                      <input
                        type="text"
                        value={reassignReason}
                        onChange={e => setReassignReason(e.target.value)}
                        placeholder="e.g. Leave of absence"
                        className="block w-full border border-gray-300 rounded p-1.5 text-xs focus:outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReassign}
                    className="w-full bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold py-1.5 rounded transition-colors shadow-sm"
                  >
                    Override Assigned Approver
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Action Footer */}
        {user?.role === UserRole.APPROVER && claim?.status === ClaimStatus.PENDING_APPROVAL && claim?.current_approver_id === user?.id && claim?.requestor_id !== user?.id && (
           <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 p-4 md:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
               <div className="flex flex-col sm:flex-row gap-4 items-end">
                   <div className="flex-1 w-full">
                       <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Remarks / Comments (Required for Return or Reject)</label>
                       <textarea 
                           rows={2} 
                           value={comment}
                           onChange={e => setComment(e.target.value)}
                           placeholder="e.g. Approved for processing. / Please re-verify SOW file name. / Rejected due to wrong client."
                           className="corp-input w-full text-xs"
                       />
                   </div>
                   <div className="flex gap-2 w-full sm:w-auto shrink-0">
                       <button onClick={() => handleApproveReject('Returned')} disabled={isSubmittingDecision} className="corp-btn-secondary border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50">Return</button>
                       <Button onClick={() => handleApproveReject('Rejected')} disabled={isSubmittingDecision} variant="danger">Reject</Button>
                       <Button onClick={() => handleApproveReject('Approved')} disabled={isSubmittingDecision} variant="success" className="flex-1 sm:flex-none" icon={<Check className="w-4 h-4" />}>Approve</Button>
                   </div>
               </div>
           </div>
        )}
      </div>
    </Drawer>
  );

  return createPortal(drawerContent, document.body);
};
