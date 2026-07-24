import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useToast } from '../components/Toast';
import { MinutesSource } from '../types';
import { ArrowLeft, FileText, User as UserIcon, Lifebuoy } from '@phosphor-icons/react';
import { StatusBadge } from '../components/StatusBadge';
import { DetailHeader } from '../components/DetailHeader';
import { PageSkeleton } from '../components/PageSkeleton';
import { SummaryCard } from '../components/SummaryCard';
import { Attachments } from '../components/Attachments';
import { Comments } from '../components/Comments';
import { getClaimNumber, getUploadUrl } from '../utils';
import { Button } from '../components/ui/Button';
import { FieldDefinition } from '../types';

interface MomDetailProps {
  id?: string;
  onClose?: () => void;
}

export const MomDetail: React.FC<MomDetailProps> = ({ id: propId, onClose }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = propId || routeId || '';
  const navigate = useNavigate();
  const toast = useToast();

  const [mom, setMom] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);

  const handleClose = onClose || (() => navigate(-1));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/moms/${id}`)
      .then(setMom)
      .catch(err => {
        console.error(err);
        toast.error('Failed to load Minutes of Meeting details');
      })
      .finally(() => setLoading(false));
    // Fetches every field def (not just active ones) so a field an Admin
    // later deactivates still shows its label on historical MOMs instead of
    // falling back to a raw key.
    apiFetch('/api/field-definitions?entity=mom').then(setFieldDefs).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <PageSkeleton onBack={handleClose} />;

  if (!mom) {
    return (
      <div className="p-8 text-center text-red-500 font-medium italic">
        Minutes of Meeting not found or unauthorized access.
      </div>
    );
  }

  const isUploaded = mom.minutes_source === MinutesSource.UPLOADED;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back navigation */}
      <button
        onClick={handleClose}
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider font-display transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to list
      </button>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <DetailHeader
          eyebrow={isUploaded ? 'Uploaded Minutes of Meeting' : 'Minutes of Meeting'}
          title={mom.client || 'Untitled Client'}
          status={<StatusBadge status={mom.status} />}
          actions={
             <Link to={`/support?new=true&entityType=MOM&entityId=${mom.id}`} className="px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                <Lifebuoy className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                Request Help
             </Link>
          }
        />

        <div className="p-6 space-y-6">
          {/* SUMMARY */}
          <SummaryCard title="Summary">
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">Prepared By</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-slate-800">{mom.prepared_by || 'Unknown'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">Meeting Date</span>
                  <span className="font-bold text-slate-800 block mt-1">{mom.meeting_date}{mom.meeting_time ? ` · ${mom.meeting_time}` : ''}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">
                    {isUploaded ? 'Meeting Type' : 'Representative'}
                  </span>
                  <span className="font-bold text-slate-800 block mt-1">{isUploaded ? (mom.meeting_type || 'N/A') : (mom.contact_person || 'N/A')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">
                    {isUploaded ? 'Internal Participants' : 'Platform / Venue'}
                  </span>
                  <span className="font-bold text-slate-800 block mt-1">{isUploaded ? (mom.participants_internal || 'N/A') : (mom.location || 'N/A')}</span>
                </div>
                {isUploaded && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">External Participants</span>
                    <span className="font-bold text-slate-800 block mt-1">{mom.participants_external || 'N/A'}</span>
                  </div>
                )}
                {!isUploaded && mom.contact_person_email && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">Contact Email</span>
                    <span className="font-bold text-slate-800 block mt-1">{mom.contact_person_email}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5 font-display uppercase tracking-wider text-[10px]">Purpose</span>
                  <p className="text-slate-700 leading-relaxed">{mom.purpose || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5 font-display uppercase tracking-wider text-[10px]">
                    {isUploaded ? 'Summary' : 'Discussion Details'}
                  </span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 border border-slate-100 rounded">{mom.discussion || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5 font-display uppercase tracking-wider text-[10px]">
                    {isUploaded ? 'Key Decisions' : 'Key Agreements Reached'}
                  </span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{mom.agreements || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5 font-display uppercase tracking-wider text-[10px]">Action Items</span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{mom.action_items || 'N/A'}</p>
                </div>
              </div>
            </div>
          </SummaryCard>

          {/* DYNAMIC FIELDS (Phase 2 MDM) — only rendered when at least one
              admin-configured field on this MOM actually has a value. */}
          {(() => {
            const entries = fieldDefs
              .map(f => ({ label: f.label, value: mom.custom_fields?.[f.key] }))
              .filter(e => e.value);
            if (entries.length === 0) return null;
            return (
              <SummaryCard title="Additional Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {entries.map(e => (
                    <div key={e.label}>
                      <span className="text-slate-400 block uppercase text-[10px] tracking-wider font-extrabold font-display">{e.label}</span>
                      <span className="font-bold text-slate-800 block mt-1">{e.value}</span>
                    </div>
                  ))}
                </div>
              </SummaryCard>
            );
          })()}

          {/* ATTACHMENTS */}
          <SummaryCard title="Attachments" bodyClassName="p-0">
            <Attachments
              items={mom.file_name ? [{
                id: 'mom-file',
                name: isUploaded ? 'Uploaded Minutes Document' : 'Signed Supporting Document',
                meta: mom.file_name,
                onView: () => mom.file_url ? window.open(getUploadUrl(mom.file_url), '_blank') : toast.info(`Downloading file: ${mom.file_name}`),
                actionLabel: 'Download',
              }] : []}
              emptyText="No signed or uploaded document attached to this MOM."
            />
          </SummaryCard>

          {/* Cross Navigation Link */}
          {mom.claim_id && (
            <SummaryCard title="Linked Claim">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-700 font-bold">
                  {mom.linkedClaim
                    ? `Linked to reimbursement claim ${getClaimNumber(mom.linkedClaim)} (${mom.linkedClaim.status}).`
                    : 'Linked to a reimbursement claim.'}
                </p>
                <Link
                  to={`/claims/${mom.claim_id}`}
                  className="bg-brand text-white text-[10px] font-bold px-4 py-2 rounded uppercase tracking-wider font-display hover:bg-brand-hover shadow-sm transition-all text-center inline-block shrink-0"
                >
                  View Claim
                </Link>
              </div>
            </SummaryCard>
          )}

          {/* COMMENTS */}
          <SummaryCard title="Comments">
            <Comments
              comments={[]}
              emptyText="Minutes of Meeting records don't have a review/comment thread of their own."
            />
          </SummaryCard>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
