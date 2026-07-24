import React, { useState, useEffect, useRef } from 'react';
import { FileText, PaperPlaneRight, CaretDown, CaretRight } from '@phosphor-icons/react';
import { apiFetch } from '../lib/api';
import { Mom, MomStatus, MinutesSource, Company } from '../types';
import { useToast } from './Toast';
import { Modal, ModalHeader } from './Modal';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { useDynamicFields, getMissingRequiredFieldLabel } from '../hooks/useDynamicFields';
import { generateMomSampleData, generateSampleCustomFieldValues } from '../utils';

interface MomQuickCreateModalProps {
  onClose: () => void;
  onCreated: (mom: Mom) => void;
}

// Same template fields and create-then-finalize flow as the "Create Minutes in
// System" form in Moms.tsx (see handleFormSubmitAndSend), packaged as a modal
// so the claim wizard never has to leave claim context to unblock itself.
export const MomQuickCreateModal: React.FC<MomQuickCreateModalProps> = ({ onClose, onCreated }) => {
  const toast = useToast();
  const [client, setClient] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('14:00');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [agreements, setAgreements] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [companyDirectory, setCompanyDirectory] = useState<Company[]>([]);
  const [clientMode, setClientMode] = useState<'select' | 'custom'>('select');

  const { definitions: fieldDefs, masterData } = useDynamicFields('mom');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  // Collapsed by default to keep this popup modal compact — this is the
  // full set of admin-configured fields, which can grow over time, so
  // keeping them behind a disclosure (rather than always-open) is what keeps
  // the modal short enough to need little/no scrolling on a typical laptop
  // window. Auto-expands if Sample Data fills them or if submit is blocked
  // on a required one the user can't currently see.
  const [showExtraFields, setShowExtraFields] = useState(false);

  // A static screenshot can't distinguish "scrollable" from "cropped and
  // stuck" — they look pixel-identical. This makes the difference visible:
  // a fading "Scroll for more" hint that only shows while there's content
  // below the fold, and disappears once you've actually reached the bottom.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);

  useEffect(() => {
    apiFetch('/api/companies').then(setCompanyDirectory).catch(console.error);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const check = () => setCanScrollMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    check();
    el.addEventListener('scroll', check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
    // Re-check whenever content height could have changed (expanding the
    // dynamic-fields disclosure, or field definitions arriving async).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExtraFields, fieldDefs.length]);

  // Phase 3 MDM: Company Auto-Fill + cascading defaults. Selecting a known
  // company pre-fills Location from its stored address and the
  // Department/Cost Center dynamic fields from its stored defaults — only
  // when those fields are still empty, so it never clobbers something the
  // user already typed. Everything filled this way stays editable.
  const applyCompanyDefaults = (companyName: string) => {
    const company = companyDirectory.find(c => c.name === companyName);
    if (!company) return;
    if (!location && company.address) setLocation(company.address);
    if (masterData && company.default_department_id) {
      const dept = masterData.departments.find(d => d.id === company.default_department_id);
      if (dept) setCustomFieldValues(prev => (prev.department ? prev : { ...prev, department: dept.name }));
    }
    if (masterData && company.cost_center_id) {
      const cc = masterData.costCenters.find(c2 => c2.id === company.cost_center_id);
      if (cc) setCustomFieldValues(prev => (prev.cost_center ? prev : { ...prev, cost_center: cc.name }));
    }
  };

  // Mirrors Moms.tsx's "Fill with Sample Data" — same shared generator
  // (src/utils.ts) so both MOM-creation entry points produce equally
  // realistic demo content, including a random value for whatever dynamic
  // fields are currently configured (not just the three seeded ones).
  const handleFillSample = () => {
    const sample = generateMomSampleData();
    const isKnownCompany = companyDirectory.some(c => c.name.toLowerCase() === sample.client.toLowerCase());
    setClientMode(isKnownCompany ? 'select' : 'custom');
    setClient(sample.client);
    setContactPerson(sample.contactPerson);
    setContactPersonEmail(sample.contactPersonEmail);
    setMeetingDate(sample.meetingDate);
    setMeetingTime(sample.meetingTime);
    setLocation(sample.location);
    setPurpose(sample.purpose);
    setDiscussion(sample.discussion);
    setAgreements(sample.agreements);
    setActionItems(sample.actionItems);
    setCustomFieldValues(generateSampleCustomFieldValues(fieldDefs, masterData as any));
    if (isKnownCompany) applyCompanyDefaults(sample.client);
    if (fieldDefs.length > 0) setShowExtraFields(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !contactPerson || !contactPersonEmail || !meetingDate || !purpose || !discussion) {
      toast.error('Please fill out all required fields to complete the MOM.');
      return;
    }
    const missingDynamicField = getMissingRequiredFieldLabel(fieldDefs, customFieldValues);
    if (missingDynamicField) {
      setShowExtraFields(true);
      toast.error(`${missingDynamicField} is required.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client,
        contact_person: contactPerson,
        contact_person_email: contactPersonEmail,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        location,
        purpose,
        discussion,
        agreements,
        action_items: actionItems,
        status: MomStatus.DRAFT,
        minutes_source: MinutesSource.TEMPLATE,
        custom_fields: customFieldValues
      };

      const savedMom = await apiFetch('/api/moms', { method: 'POST', body: JSON.stringify(payload) });
      const completedMom = await apiFetch(`/api/moms/${savedMom.id}/send`, { method: 'POST' });
      toast.success('Minutes of Meeting created and finalized — it\'s attached below.');
      onCreated(completedMom);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create Minutes of Meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidthClass="max-w-xl" ariaLabel="Create Minutes of Meeting">
      <ModalHeader title="Create Minutes of Meeting" icon={<FileText className="w-5 h-5 text-brand" />} onClose={onClose} />
      <div className="overflow-y-auto flex-1 min-h-0">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 -mt-1">
            <p className="text-xs text-gray-500">
              This finalizes and sends the MOM immediately so it's ready to attach to your claim.
            </p>
            <button
              type="button"
              onClick={handleFillSample}
              className="shrink-0 text-xs text-brand hover:text-brand-hover border border-brand hover:bg-brand/5 px-2 py-1 rounded transition-colors whitespace-nowrap"
            >
              Fill with Sample Data
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Client (Company Name) *</label>
              <select
                required={clientMode === 'select'}
                value={clientMode === 'custom' ? '__custom__' : client}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setClientMode('custom');
                    setClient('');
                  } else {
                    setClientMode('select');
                    setClient(e.target.value);
                    applyCompanyDefaults(e.target.value);
                  }
                }}
                className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none bg-white"
              >
                <option value="">-- Select Company --</option>
                {companyDirectory.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="__custom__">+ Specify your own...</option>
              </select>
              {clientMode === 'custom' && (
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter new company name"
                  value={client}
                  onChange={e => setClient(e.target.value)}
                  className="block w-full text-sm border border-gray-300 rounded px-3 py-2 mt-2 focus:border-brand focus:outline-none"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Contact Person Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Maria Santos"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {(() => {
            const selectedCompany = clientMode === 'select' ? companyDirectory.find(c => c.name === client) : undefined;
            const bu = selectedCompany?.business_unit_id && masterData?.businessUnits.find(b => b.id === selectedCompany.business_unit_id)?.name;
            const chips = [bu && `BU: ${bu}`, selectedCompany?.currency && `Currency: ${selectedCompany.currency}`, selectedCompany?.tax_id && `Tax ID: ${selectedCompany.tax_id}`].filter(Boolean);
            if (chips.length === 0) return null;
            return (
              <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2 -mt-2">
                <span className="font-semibold text-slate-600">From company record:</span> {chips.join(' · ')}
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Contact Person Email *</label>
            <input
              type="email"
              required
              placeholder="e.g. msantos@smprime.com"
              value={contactPersonEmail}
              onChange={e => setContactPersonEmail(e.target.value)}
              className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
            />
          </div>

          {fieldDefs.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowExtraFields(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                {showExtraFields ? <CaretDown className="w-3.5 h-3.5" /> : <CaretRight className="w-3.5 h-3.5" />}
                Additional Details ({fieldDefs.length})
              </button>
              {showExtraFields && (
                <div className="mt-3">
                  <DynamicFieldRenderer
                    definitions={fieldDefs}
                    values={customFieldValues}
                    onChange={(key, value) => setCustomFieldValues(prev => ({ ...prev, [key]: value }))}
                    masterData={masterData}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Meeting Date *</label>
              <input
                type="date"
                required
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Meeting Time</label>
              <input
                type="time"
                value={meetingTime}
                onChange={e => setMeetingTime(e.target.value)}
                className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Location / Platform</label>
            <input
              type="text"
              placeholder="e.g. Quezon City Office / MS Teams"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Purpose *</label>
            <input
              type="text"
              required
              placeholder="e.g. Partnership kickoff"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Discussion Details *</label>
            <textarea
              required
              rows={3}
              placeholder="Summarize what was discussed with the client..."
              value={discussion}
              onChange={e => setDiscussion(e.target.value)}
              className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Agreements Made</label>
            <textarea
              rows={2}
              placeholder="Any agreements reached..."
              value={agreements}
              onChange={e => setAgreements(e.target.value)}
              className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Action Items</label>
            <textarea
              rows={2}
              placeholder="Next steps and owners..."
              value={actionItems}
              onChange={e => setActionItems(e.target.value)}
              className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="corp-btn-primary"
            >
              <PaperPlaneRight className="w-4 h-4" /> {submitting ? 'Finalizing...' : 'Finalize & Attach'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
