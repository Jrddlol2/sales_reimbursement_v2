import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Mom, MomStatus, MinutesSource, UserRole, Company } from '../types';
import { useAuth } from '../components/AuthContext';
import { uploadFile, getUploadUrl, formatDate } from '../utils';
import { StatusBadge } from '../components/StatusBadge';
import { 
  FileText, Plus, PaperPlaneRight, CheckCircle, Calendar, Clock, MapPin, 
  User, Envelope, ArrowRight, BookOpen, CheckSquare, Pencil, Eye, 
  CloudArrowUp, X, ArrowLeft, Download, CaretDown, CaretRight, MagnifyingGlass
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';

export const Moms: React.FC = () => {
  const { user } = useAuth();
  const locationState = useLocation();
  const toast = useToast();
  const confirmAction = useConfirm();
  const [moms, setMoms] = useState<Mom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [creationStep, setCreationStep] = useState<'none' | 'choice' | 'template' | 'upload'>('none');
  const [editingMom, setEditingMom] = useState<Mom | null>(null);
  const [client, setClient] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [agreements, setAgreements] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [meetingType, setMeetingType] = useState('');
  const [participantsInternal, setParticipantsInternal] = useState('');
  const [participantsExternal, setParticipantsExternal] = useState('');

  // Company Directory - Client (Company Name) picker
  const [companyDirectory, setCompanyDirectory] = useState<Company[]>([]);
  const [clientMode, setClientMode] = useState<'select' | 'custom'>('select');

  // Preview State
  const [previewMom, setPreviewMom] = useState<Mom | null>(null);

  useEffect(() => {
    if (!previewMom) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewMom(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [previewMom]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MomStatus>('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | MinutesSource>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchMoms = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/moms');
      setMoms(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch MOMs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoms();
    apiFetch('/api/companies').then(setCompanyDirectory).catch(console.error);
  }, []);

  const handleCreateNew = () => {
    setEditingMom(null);
    setClientMode('select');
    setClient('');
    setContactPerson('');
    setContactPersonEmail('');
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setMeetingTime('14:00');
    setLocation('');
    setPurpose('');
    setDiscussion('');
    setAgreements('');
    setActionItems('');
    setFileName('');
    setFileUrl('');
    setMeetingType('');
    setParticipantsInternal('');
    setParticipantsExternal('');
    setCreationStep('choice');
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(locationState.search);
    if (searchParams.get('create') === 'true') {
      handleCreateNew();
    }
  }, [locationState.search]);

  const handleChooseTemplate = () => {
    setCreationStep('template');
  };

  const handleChooseUpload = () => {
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setCreationStep('upload');
  };

  const handleEdit = (mom: Mom) => {
    setEditingMom(mom);
    setClient(mom.client || '');
    const isKnownCompany = !mom.client || companyDirectory.some(c => c.name.toLowerCase() === mom.client!.toLowerCase());
    setClientMode(isKnownCompany ? 'select' : 'custom');
    setContactPerson(mom.contact_person || '');
    setContactPersonEmail(mom.contact_person_email || '');
    setMeetingDate(mom.meeting_date || '');
    setMeetingTime(mom.meeting_time || '');
    setLocation(mom.location || '');
    setPurpose(mom.purpose || '');
    setDiscussion(mom.discussion || '');
    setAgreements(mom.agreements || '');
    setActionItems(mom.action_items || '');
    setFileName(mom.file_name || '');
    setFileUrl(mom.file_url || '');
    setMeetingType(mom.meeting_type || '');
    setParticipantsInternal(mom.participants_internal || '');
    setParticipantsExternal(mom.participants_external || '');
    setCreationStep('template');
  };

  const handleGenerateSampleData = () => {
    const companies = [
      'SM Prime Holdings', 'Ayala Land Inc', 'BDO Unibank', 'Jollibee Foods Corp', 'San Miguel Corporation', 'PLDT Inc', 'Globe Telecom',
      'Google Philippines', 'Microsoft Asia', 'AWS Tech', 'Shopee Regional', 'Lazada eCommerce', 'Maya Bank', 'GCash Mobile',
      'Makati Medical Center', 'St. Lukes Healthcare', 'Robinsons Retail', 'Cebu Pacific Air'
    ];
    const contacts = [
      'Maria Santos', 'Carlos Dela Cruz', 'Angela Reyes', 'Ramon Villanueva', 'Patricia Lim',
      'Kevin Ngo', 'Bianca Ocampo', 'Justin Chua', 'Samantha Go', 'Luis Torres'
    ];
    const platforms = ['MS Teams', 'Zoom', 'Quezon City HQ', 'Makati Diamond Residences', 'BGC Office', 'Ortigas Center Room A', 'Google Meet'];
    const purposes = [
      'Quarterly Business Review', 'Renewal Negotiation', 'Pilot Scope Definition', 
      'Service Level Agreement Sync', 'Q4 Partnership Planning', 'Vendor Security Assessment',
      'Product Demo & Onboarding', 'Contract Renegotiation', 'Go-To-Market Strategy Alignment'
    ];
    const discussions = [
      'Reviewed previous quarter metrics and discussed the roadmap for the upcoming renewal. Client raised concerns about SLA response times which we addressed by proposing a dedicated support tier.',
      'Presented the new product catalog. Client is interested in the enterprise bundle but needs a custom pricing model to fit their Q3 budget.',
      'Walked through the pilot implementation plan. Clarified the integration requirements with their existing on-premise infrastructure.',
      'Discussed co-marketing opportunities for the upcoming product launch. Client requested a detailed breakdown of the proposed budget allocation.',
      'Follow-up meeting to finalize the terms of the service agreement. Addressed legal redlines and agreed on the liability clauses.',
      'Conducted a thorough security assessment for vendor onboarding. Clarified data residency policies and encryption protocols.',
      'Showcased the new analytics dashboard. The executive team was highly engaged and requested a 14-day proof of concept for their marketing department.',
      'Negotiated pricing tiers for the upcoming fiscal year. Client asked for volume discounts on license renewals which we will review internally.'
    ];
    const items = [
      '1. Send revised pricing proposal by Friday\n2. Schedule technical deep-dive next week',
      '1. Provide SLA documentation\n2. Draft pilot contract',
      '1. Confirm marketing budget\n2. Share creative assets',
      '1. Review legal redlines with internal counsel\n2. Send finalized contract for signature',
      '1. Setup demo environment for client engineering team\n2. Share API documentation',
      '1. Provide SOC2 compliance report\n2. Answer remaining security questionnaire items',
      '1. Provision POC accounts for 5 users\n2. Share onboarding guides',
      '1. Calculate volume discount models\n2. Schedule follow-up with finance directors'
    ];

    const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    
    const clientName = rand(companies);
    const contactName = rand(contacts);
    const [first, ...rest] = contactName.split(' ');
    const last = rest[rest.length - 1] || first;
    
    // Random date within last 30 days
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 30));

    const isKnownCompany = companyDirectory.some(c => c.name.toLowerCase() === clientName.toLowerCase());
    setClientMode(isKnownCompany ? 'select' : 'custom');
    setClient(clientName);
    setContactPerson(contactName);
    setContactPersonEmail(`${first.toLowerCase()}.${last.toLowerCase()}@${clientName.replace(/[^a-zA-Z]/g, '').toLowerCase()}.com`);
    setMeetingDate(d.toISOString().split('T')[0]);
    setMeetingTime(`${String(Math.floor(Math.random() * 7) + 9).padStart(2, '0')}:00`);
    setLocation(rand(platforms));
    setPurpose(rand(purposes));
    setDiscussion(rand(discussions));
    setAgreements('Agreed to proceed with the next steps as discussed. Client will review proposals internally and revert by end of week.');
    setActionItems(rand(items));
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
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
        file_name: fileName,
        file_url: fileUrl || undefined,
        status: MomStatus.DRAFT,
        minutes_source: MinutesSource.TEMPLATE
      };

      if (editingMom) {
        await apiFetch(`/api/moms/${editingMom.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/moms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setCreationStep('none');
      fetchMoms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save MOM draft');
    }
  };

  const handleSendAndComplete = async (momId: string) => {
    const ok = await confirmAction({
      title: 'Finalize this MOM?',
      message: 'This will send the meeting summary to the client contact, CC your supervisor, and complete the MOM so you can attach it to a reimbursement.',
      confirmLabel: 'Finalize & Send'
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/moms/${momId}/send`, { method: 'POST' });
      fetchMoms();
      toast.success('Minutes of Meeting finalized! An official summary email has been sent to the client and your Approver.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete MOM');
    }
  };

  const handleFormSubmitAndSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !contactPerson || !contactPersonEmail || !meetingDate || !purpose || !discussion) {
      toast.error('Please fill out all required fields to complete the MOM.');
      return;
    }

    try {
      // Save first
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
        file_name: fileName,
        file_url: fileUrl || undefined,
        status: MomStatus.DRAFT,
        minutes_source: MinutesSource.TEMPLATE
      };

      let savedMom;
      if (editingMom) {
        savedMom = await apiFetch(`/api/moms/${editingMom.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        savedMom = await apiFetch('/api/moms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      // Then send/complete
      await apiFetch(`/api/moms/${savedMom.id}/send`, { method: 'POST' });
      setCreationStep('none');
      fetchMoms();
      toast.success('Minutes of Meeting finalized and client email dispatched!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize MOM');
    }
  };

  const buildUploadPayload = (status: MomStatus) => ({
    client,
    meeting_date: meetingDate,
    meeting_time: meetingTime,
    meeting_type: meetingType,
    participants_internal: participantsInternal,
    participants_external: participantsExternal,
    purpose,
    discussion,
    agreements,
    action_items: actionItems,
    file_name: fileName,
    file_url: fileUrl || undefined,
    status,
    minutes_source: MinutesSource.UPLOADED
  });

  const validateUploadForm = () => {
    if (!client || !meetingDate || !meetingType || !participantsInternal || !participantsExternal || !purpose || !discussion) {
      toast.error('Please fill out all required fields.');
      return false;
    }
    if (!fileName) {
      toast.error('Please attach the meeting minutes file.');
      return false;
    }
    return true;
  };

  const handleSaveUploadDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUploadForm()) return;
    try {
      await apiFetch('/api/moms', {
        method: 'POST',
        body: JSON.stringify(buildUploadPayload(MomStatus.DRAFT))
      });
      setCreationStep('none');
      fetchMoms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save uploaded MOM');
    }
  };

  const handleUploadSubmitAndSend = async () => {
    if (!validateUploadForm()) return;
    try {
      const savedMom = await apiFetch('/api/moms', {
        method: 'POST',
        body: JSON.stringify(buildUploadPayload(MomStatus.DRAFT))
      });
      await apiFetch(`/api/moms/${savedMom.id}/send`, { method: 'POST' });
      setCreationStep('none');
      fetchMoms();
      toast.success('Uploaded Minutes of Meeting finalized and client email dispatched!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize uploaded MOM');
    }
  };

  // Mock file upload
  const handleUploadFile = async (file: File) => {
    try {
      toast.info('Uploading file...');
      const uploadedUrl = await uploadFile(file);
      setFileName(file.name);
      setFileUrl(uploadedUrl);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFile(e.target.files[0]);
    }
  };

  // Master-detail Layout selection state
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Filter meetings matching status/source/date filters (company list search is handled on the company list itself)
  const filteredMoms = useMemo(() => {
    return moms.filter(mom => {
      // 1. Filter by status
      const matchesStatus = statusFilter === 'All' || mom.status === statusFilter;

      // 2. Filter by source
      const matchesSource = sourceFilter === 'All' || mom.minutes_source === sourceFilter;

      // 3. Filter by date range
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && mom.meeting_date >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && mom.meeting_date <= endDate;
      }

      return matchesStatus && matchesSource && matchesDate;
    });
  }, [moms, statusFilter, sourceFilter, startDate, endDate]);

  // Companies list computation
  const companiesList = useMemo(() => {
    const companyGroups: Record<string, { company: string; latestDate: string; totalCount: number; filteredCount: number; months: Record<string, Mom[]> }> = {};

    // Group all MOMs (unfiltered) to determine the full list of distinct companies and their latest activity dates
    moms.forEach(mom => {
      const comp = mom.client || 'Untitled Client';
      const dateStr = mom.meeting_date || '';

      if (!companyGroups[comp]) {
        companyGroups[comp] = { company: comp, latestDate: dateStr, totalCount: 0, filteredCount: 0, months: {} };
      }

      if (dateStr > companyGroups[comp].latestDate) {
        companyGroups[comp].latestDate = dateStr;
      }

      companyGroups[comp].totalCount++;
    });

    // Count and group filtered MOMs under each company
    filteredMoms.forEach(mom => {
      const comp = mom.client || 'Untitled Client';
      if (companyGroups[comp]) {
        companyGroups[comp].filteredCount++;
        
        const dateStr = mom.meeting_date || '';
        const month = dateStr ? dateStr.substring(0, 7) : 'Unknown Month';
        if (!companyGroups[comp].months[month]) {
          companyGroups[comp].months[month] = [];
        }
        companyGroups[comp].months[month].push(mom);
      }
    });

    // Convert to array and sort by latest date (most recent first)
    const sorted = Object.values(companyGroups).sort((a, b) => b.latestDate.localeCompare(a.latestDate));

    // Filter companies list based on left pane search term (matches company name or any of its meetings' contact person)
    const filtered = sorted.filter(c => {
      if (!searchTerm) return true;
      const matchesCompany = c.company.toLowerCase().includes(searchTerm.toLowerCase());
      const companyMoms = moms.filter(m => (m.client || 'Untitled Client') === c.company);
      const matchesContact = companyMoms.some(m => m.contact_person && m.contact_person.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCompany || matchesContact;
    });

    // Sort meetings within months most-recent first
    filtered.forEach(comp => {
      Object.values(comp.months).forEach(monthList => {
        monthList.sort((a, b) => (b.meeting_date || '').localeCompare(a.meeting_date || ''));
      });
    });

    return filtered;
  }, [moms, filteredMoms, searchTerm]);

  // Synchronize selectedCompany with companiesList updates
  useEffect(() => {
    if (companiesList.length > 0) {
      const isSelectedInList = companiesList.some(c => c.company === selectedCompany);
      if (!selectedCompany || selectedCompany === 'All' || !isSelectedInList) {
        setSelectedCompany(companiesList[0].company);
      }
    } else {
      setSelectedCompany('');
    }
  }, [companiesList, selectedCompany]);

  const formatMonth = (monthString: string) => {
    if (monthString === 'Unknown Month') return monthString;
    const date = new Date(monthString + '-01');
    if (isNaN(date.getTime())) return monthString;
    return formatDate(date, { month: 'long', year: 'numeric' });
  };

  const renderMomCard = (mom: Mom) => (
    <div key={mom.id} className="bg-white border border-gray-200 rounded p-5 flex flex-col justify-between hover:border-gray-300 shadow-sm transition-all space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={mom.status} size="sm" />
            {mom.minutes_source === MinutesSource.UPLOADED && (
              <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                <CloudArrowUp className="w-3 h-3" /> Uploaded
              </span>
            )}
          </div>
          {mom.claim_id && (
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
              <CheckSquare className="w-3 h-3" /> Linked to Claim
            </span>
          )}
        </div>

        <div>
          <h3 className="font-bold text-gray-900 text-base leading-snug">{mom.client || 'Untitled Client'}</h3>
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{mom.purpose || 'No purpose listed'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{mom.meeting_date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate">{mom.contact_person || 'No Contact'}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMom(mom)}
            className="p-1.5 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-50 border border-gray-200 flex items-center gap-1 text-xs font-semibold"
            title="Preview Transcript"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <Link
            to={`/moms/${mom.id}`}
            className="p-1.5 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-50 border border-gray-200 flex items-center gap-1 text-xs font-semibold"
            title="View Full Details"
          >
            <ArrowRight className="w-3.5 h-3.5" /> Details
          </Link>
          {mom.status === MomStatus.DRAFT && user?.id === mom.requestor_id && mom.minutes_source !== MinutesSource.UPLOADED && (
            <button
              onClick={() => handleEdit(mom)}
              className="p-1.5 text-gray-500 hover:text-brand rounded hover:bg-gray-50 border border-gray-200 flex items-center gap-1 text-xs font-semibold"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>

        {mom.status === MomStatus.DRAFT && user?.id === mom.requestor_id && (
          <button
            onClick={() => handleSendAndComplete(mom.id)}
            className="corp-btn-primary text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 shadow-sm"
          >
            <PaperPlaneRight className="w-3 h-3" /> Finalize & Send
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full px-4 py-6 space-y-6" id="moms_root_container">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5 shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 font-display">Minutes of Meeting Manager</h1>
          <p className="text-xs text-slate-500">
            Document client meetings to satisfy regulatory reimbursement policies. Draft, preview, send, and complete meetings.
          </p>
        </div>
        {!!user?.reports_to && creationStep === 'none' && (
          <button
            onClick={handleCreateNew}
            className="corp-btn-primary"
            id="btn_create_new_mom"
          >
            <Plus className="w-4 h-4" /> Create Minutes of Meeting
          </button>
        )}
      </div>

      {/* Previously this fetch error only surfaced inside the upload modal,
          so a failed initial load of the MOM list looked like an empty list
          rather than a broken page. Surface it here too, on the page the
          user is actually looking at. */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded text-sm shrink-0">{error}</div>
      )}

      {creationStep === 'choice' ? (
          /* Source Choice Step */
          <motion.div
            key="mom_source_choice"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded border border-gray-200 shadow-sm p-8"
            id="mom_source_choice"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-800">How would you like to create this MOM?</h2>
              <button
                type="button"
                onClick={() => setCreationStep('none')}
                aria-label="Close"
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleChooseTemplate}
                id="btn_choose_template_mom"
                className="text-left border-2 border-gray-200 hover:border-brand rounded-lg p-6 space-y-2 transition-colors"
              >
                <FileText className="w-8 h-8 text-brand" />
                <h3 className="font-semibold text-gray-900 text-sm">Create Minutes in System</h3>
                <p className="text-xs text-gray-500">Build the MOM using the guided template with a live corporate memo preview.</p>
              </button>
              <button
                type="button"
                onClick={handleChooseUpload}
                id="btn_choose_upload_mom"
                className="text-left border-2 border-gray-200 hover:border-brand rounded-lg p-6 space-y-2 transition-colors"
              >
                <CloudArrowUp className="w-8 h-8 text-brand" />
                <h3 className="font-semibold text-gray-900 text-sm">Upload Existing Minutes</h3>
                <p className="text-xs text-gray-500">Already have a document (Word, exported from Teams/Zoom, etc.)? Upload it and fill in key details.</p>
              </button>
            </div>
          </motion.div>
      ) : creationStep === 'upload' ? (
          /* Upload Existing Minutes Form */
          <motion.div
            key="mom_upload_form_view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded border border-gray-200 shadow-sm"
            id="mom_upload_form_view"
          >
            <form onSubmit={handleSaveUploadDraft} className="p-6 space-y-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <CloudArrowUp className="w-5 h-5 text-brand" />
                  Upload Existing Minutes
                </h2>
                <button
                  type="button"
                  onClick={() => setCreationStep('none')}
                  aria-label="Close"
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Meeting Title / Client *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SM Prime Holdings"
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Meeting Time</label>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={e => setMeetingTime(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Meeting Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Client Servicing, QBR, Contract Negotiation"
                    value={meetingType}
                    onChange={e => setMeetingType(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Internal Participants *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan Dela Cruz, Maria Reyes"
                    value={participantsInternal}
                    onChange={e => setParticipantsInternal(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">External Participants *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Santos (SM Prime)"
                    value={participantsExternal}
                    onChange={e => setParticipantsExternal(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Partnership Kickoff"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Short Summary *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Brief summary of what the uploaded minutes cover..."
                  value={discussion}
                  onChange={e => setDiscussion(e.target.value)}
                  className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Key Decisions (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Any key decisions reached..."
                    value={agreements}
                    onChange={e => setAgreements(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Action Items (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="What are the next actions and who is responsible?"
                    value={actionItems}
                    onChange={e => setActionItems(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Minutes Document (PDF/DOC/DOCX) *</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                    isDragOver ? 'border-brand bg-brand-active' : 'border-gray-300 hover:border-brand'
                  }`}
                >
                  <input
                    type="file"
                    id="mom_upload_doc_file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="mom_upload_doc_file" className="cursor-pointer space-y-1 block">
                    <CloudArrowUp className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-xs text-gray-600">Drag & Drop the existing MOM PDF/Word doc here, or <span className="text-brand font-semibold">Browse</span></p>
                    <p className="text-[10px] text-gray-400">Supports PDF, DOC, DOCX up to 10MB. File contents are not parsed — the fields above are stored as searchable metadata.</p>
                  </label>
                </div>
                {fileName && (
                  <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded px-3 py-2">
                    <span className="text-gray-700 font-medium truncate max-w-[250px]">{fileName}</span>
                    <button type="button" onClick={() => setFileName('')} aria-label="Remove attached file" className="text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreationStep('none')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 bg-white"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleUploadSubmitAndSend}
                  className="corp-btn-primary"
                >
                  <PaperPlaneRight className="w-4 h-4" /> Finalize & Send
                </button>
              </div>
            </form>
          </motion.div>
      ) : creationStep === 'template' ? (
          /* Create / Edit MOM Form */
          <motion.div
            key="mom_form_view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded border border-gray-200 shadow-sm grid grid-cols-1 lg:grid-cols-2"
            id="mom_form_view"
          >
            {/* Form Left Column */}
            <form onSubmit={handleSaveDraft} className="p-6 space-y-6 border-r border-gray-100">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand" />
                    {editingMom ? 'Edit Meeting Minutes' : 'New Meeting Minutes'}
                  </h2>
                  <button
                    type="button"
                    onClick={handleGenerateSampleData}
                    className="text-xs text-brand hover:text-brand-hover border border-brand hover:bg-brand/5 px-2 py-1 rounded transition-colors"
                  >
                    Fill with Sample Data
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setCreationStep('none')}
                  aria-label="Close"
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid 1: Client and Contact Person details */}
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

              {/* Grid 2: Meeting Scheduling details */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Location / Platform *</label>
                  <input
                    type="text"
                    required
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
                    placeholder="e.g. Partnership Kickoff"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* Rich Texts */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Discussion Details *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Summarize the core topics and presentation details discussed during the meeting..."
                  value={discussion}
                  onChange={e => setDiscussion(e.target.value)}
                  className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Agreements Made</label>
                  <textarea
                    rows={3}
                    placeholder="List the agreements made between parties..."
                    value={agreements}
                    onChange={e => setAgreements(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Action Items</label>
                  <textarea
                    rows={3}
                    placeholder="What are the next actions and who is responsible?"
                    value={actionItems}
                    onChange={e => setActionItems(e.target.value)}
                    className="block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* PDF/Word Document upload block */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Attach Signed Document (Optional)</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                    isDragOver ? 'border-brand bg-brand-active' : 'border-gray-300 hover:border-brand'
                  }`}
                >
                  <input
                    type="file"
                    id="mom_doc_file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="mom_doc_file" className="cursor-pointer space-y-1 block">
                    <CloudArrowUp className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-xs text-gray-600">Drag & Drop signed MOM PDF/Word doc here, or <span className="text-brand font-semibold">Browse</span></p>
                    <p className="text-[10px] text-gray-400">Supports PDF, DOC, DOCX up to 10MB</p>
                  </label>
                </div>
                {fileName && (
                  <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded px-3 py-2">
                    <span className="text-gray-700 font-medium truncate max-w-[250px]">{fileName}</span>
                    <button type="button" onClick={() => setFileName('')} aria-label="Remove attached file" className="text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Form Action Controls */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreationStep('none')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 bg-white"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleFormSubmitAndSend}
                  className="corp-btn-primary"
                >
                  <PaperPlaneRight className="w-4 h-4" /> Finalize & Send
                </button>
              </div>
            </form>

            {/* Live Corporate Styled Memo Preview */}
            <div className="bg-gray-50 p-6 flex flex-col space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Live Corporate Memo Preview</h3>
              <div className="bg-white border border-gray-200 shadow-sm p-8 font-sans text-gray-900 rounded space-y-6">
                <div className="text-center border-b-2 border-gray-900 pb-4">
                  <h1 className="text-lg font-bold tracking-widest uppercase">MICROGENESIS</h1>
                  <p className="text-[10px] tracking-wider text-gray-500 uppercase">
                    {user?.job_title ? `${user.job_title} • ` : ''}{user?.department || 'Sales'} Department
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-800 pb-4 border-b border-gray-100">
                  <div>
                    <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Client / Company</span>
                    <span className="font-semibold text-gray-900 text-sm">{client || '(Draft Client)'}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Date of Meeting</span>
                    <span className="font-semibold text-gray-900 text-sm">{meetingDate ? formatDate(meetingDate) : '(Select Date)'}</span>
                  </div>
                  <div className="mt-2">
                    <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Representative</span>
                    <span className="font-semibold text-gray-900">{contactPerson || '(Draft Representative)'}</span>
                  </div>
                  <div className="mt-2">
                    <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Platform / Venue</span>
                    <span className="font-semibold text-gray-900">{location || '(Draft Venue)'}</span>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">1. PURPOSE</h4>
                    <p className="text-gray-700 leading-relaxed font-semibold">{purpose || 'Discuss sales targets and service level agreement guidelines.'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">2. CORE DISCUSSION & SUMMARY</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{discussion || 'No discussion points added yet.'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">3. KEY AGREEMENTS</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{agreements || 'List of agreements will show here.'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">4. REQUIRED ACTIONS & ACCOUNTABILITY</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{actionItems || 'List of action points will show here.'}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between">
                  <span>Prepared By: {user?.job_title ? `${user.name} (${user.job_title})` : user?.name}</span>
                  <span>Status: Draft (Pending Client Verification)</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* List Views */
          <motion.div
            key="mom_list_view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col space-y-6"
          >
            {loading ? (
              <div className="text-center py-12 text-gray-500 italic">Loading meeting documents...</div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded text-sm">{error}</div>
            ) : moms.length === 0 ? (
              <div className="bg-white border border-gray-200 p-12 text-center rounded">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No Minutes of Meeting Created</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                  Reimbursements require a Completed MOM to be attached. Document your client meeting now to begin.
                </p>
                {!!user?.reports_to && (
                  <button onClick={handleCreateNew} className="corp-btn-primary text-xs font-semibold px-4 py-2 rounded">
                    Create MOM
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-6">
                {/* Filter controls */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-4">
                  {/* Status Select */}
                  <div className="w-full md:w-44">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="corp-input w-full text-xs font-medium"
                    >
                      <option value="All">All Statuses</option>
                      <option value={MomStatus.DRAFT}>{MomStatus.DRAFT}</option>
                      <option value={MomStatus.COMPLETED}>{MomStatus.COMPLETED}</option>
                    </select>
                  </div>

                  {/* Source Select */}
                  <div className="w-full md:w-44">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Source</label>
                    <select
                      value={sourceFilter}
                      onChange={e => setSourceFilter(e.target.value as any)}
                      className="corp-input w-full text-xs font-medium"
                    >
                      <option value="All">All Sources</option>
                      <option value={MinutesSource.TEMPLATE}>Template</option>
                      <option value={MinutesSource.UPLOADED}>Uploaded</option>
                    </select>
                  </div>

                  {/* From Date */}
                  <div className="w-full md:w-48">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">From Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="corp-input w-full text-xs font-medium"
                    />
                  </div>

                  {/* To Date */}
                  <div className="w-full md:w-48">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">To Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="corp-input w-full text-xs font-medium"
                    />
                  </div>

                  {/* Clear Filters Button */}
                  {(searchTerm || statusFilter !== 'All' || sourceFilter !== 'All' || startDate || endDate) && (
                    <div className="pt-4 md:pt-0 self-end">
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('All');
                          setSourceFilter('All');
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* Two-Pane Master-Detail Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start" id="moms_master_detail">
                  {/* Left pane: Company list with search */}
                  <div className={`md:col-span-4 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] ${mobileShowDetail ? 'hidden md:flex' : 'flex'}`}>
                    {/* Left Pane Header / Company Search */}
                    <div className="p-4 border-b border-gray-100 bg-slate-50/50 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Companies List</span>
                        <span className="text-[10px] font-bold bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                          {companiesList.length}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search company or contact..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="corp-input corp-input-icon-left corp-input-icon-right w-full text-xs py-1.5"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                          <MagnifyingGlass className="w-4 h-4" />
                        </div>
                        {searchTerm && (
                          <button 
                            onClick={() => setSearchTerm('')} 
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Companies List */}
                    <div className="divide-y divide-gray-100 overflow-y-auto flex-1 min-h-0">
                      {companiesList.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-xs italic">
                          No matching companies
                        </div>
                      ) : (
                        companiesList.map((c) => {
                          const isSelected = selectedCompany === c.company;
                          return (
                            <button
                              key={c.company}
                              onClick={() => {
                                setSelectedCompany(c.company);
                                setMobileShowDetail(true);
                              }}
                              className={`w-full text-left p-4 transition-all flex flex-col gap-1 focus:outline-none cursor-pointer border-l-4 ${
                                isSelected 
                                  ? 'bg-brand-active/60 border-brand font-medium text-brand' 
                                  : 'hover:bg-slate-50/50 border-transparent text-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-sm font-bold truncate ${isSelected ? 'text-brand' : 'text-slate-800'}`}>
                                  {c.company}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  isSelected ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {c.filteredCount}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span>Last Active: {c.latestDate || 'N/A'}</span>
                                {c.filteredCount !== c.totalCount && (
                                  <span className="text-[10px] italic">({c.totalCount} total)</span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right pane: Detail View */}
                  <div className={`md:col-span-8 bg-slate-50 md:bg-transparent rounded-xl flex flex-col ${mobileShowDetail ? 'flex' : 'hidden md:flex'}`}>
                    {/* Mobile Back Button */}
                    {mobileShowDetail && (
                      <button
                        onClick={() => setMobileShowDetail(false)}
                        className="md:hidden mb-3 flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline p-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Companies
                      </button>
                    )}

                    {(() => {
                      const currentCompanyData = companiesList.find(c => c.company === selectedCompany);
                      if (currentCompanyData) {
                        return (
                          <div className="flex flex-col">
                            {/* Selected Company Header */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <h2 className="text-base font-extrabold text-slate-950">{currentCompanyData.company}</h2>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Showing {currentCompanyData.filteredCount} of {currentCompanyData.totalCount} meeting document{currentCompanyData.totalCount === 1 ? '' : 's'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Detail list */}
                            <div className="space-y-6 pb-4">
                              {currentCompanyData.filteredCount === 0 ? (
                                <div className="bg-white border border-gray-200 p-12 text-center rounded-xl shadow-sm">
                                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No Matching Meetings</h3>
                                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                    No meetings match your current filters (status, source, or date range) for this company.
                                  </p>
                                </div>
                              ) : (
                                Object.entries(currentCompanyData.months)
                                  .sort((a, b) => b[0].localeCompare(a[0]))
                                  .map(([monthStr, monthMoms]) => (
                                    <div key={monthStr} className="space-y-3">
                                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 px-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatMonth(monthStr)}
                                      </h4>
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {(monthMoms as Mom[]).map(mom => renderMomCard(mom))}
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-300 mb-4" />
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">Select a Company</h3>
                            <p className="text-xs text-gray-500 max-w-xs">
                              Choose a client company from the list on the left to browse and manage its meeting minutes.
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

      {/* MOM Transcript Viewer Modal */}
      <AnimatePresence>
        {previewMom && (
          <Modal onClose={() => setPreviewMom(null)} bare>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Minutes of Meeting transcript"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded border border-gray-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gray-900 p-4 text-white flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm tracking-wider uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand" />
                  {previewMom.minutes_source === MinutesSource.UPLOADED ? 'Uploaded Minutes of Meeting' : 'Official Minutes of Meeting Transcript'}
                </h3>
                <button
                  onClick={() => setPreviewMom(null)}
                  aria-label="Close"
                  className="text-gray-400 hover:text-white rounded hover:bg-gray-800 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {previewMom.minutes_source === MinutesSource.UPLOADED ? (
                /* Modal Body / Uploaded Minutes Metadata Summary */
                <div className="p-8 flex-1 min-h-0 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs text-gray-800 pb-4 border-b border-gray-200">
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Meeting Title / Client</span>
                      <span className="font-semibold text-gray-900 text-sm">{previewMom.client}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Date of Meeting</span>
                      <span className="font-semibold text-gray-900 text-sm">{previewMom.meeting_date}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Meeting Type</span>
                      <span className="font-semibold text-gray-900">{previewMom.meeting_type || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Internal Participants</span>
                      <span className="font-semibold text-gray-900">{previewMom.participants_internal || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">External Participants</span>
                      <span className="font-semibold text-gray-900">{previewMom.participants_external || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">Purpose</h4>
                      <p className="text-gray-700 leading-relaxed">{previewMom.purpose || 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">Summary</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{previewMom.discussion || 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">Key Decisions</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{previewMom.agreements || 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">Action Items</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{previewMom.action_items || 'N/A'}</p>
                    </div>

                    <div className="bg-gray-50 p-3 rounded border border-gray-100 flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-800 text-[10px]">Uploaded Minutes Document</p>
                          <p className="text-[10px] text-gray-500">{previewMom.file_name || 'No file attached'}</p>
                        </div>
                      </div>
                      {previewMom.file_name && (
                        <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Downloading file: ' + previewMom.file_name); }} className="text-brand hover:text-brand-hover text-[10px] font-semibold flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> Download File
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
                    <span>Prepared By: {previewMom.prepared_by}</span>
                    <span>Status: {previewMom.status}</span>
                  </div>
                </div>
              ) : (
                /* Modal Body / Transcript Content */
                <div className="p-8 flex-1 min-h-0 overflow-y-auto space-y-6">
                  <div className="text-center border-b-2 border-gray-900 pb-4">
                    <h1 className="text-xl font-bold tracking-widest uppercase">MICROGENESIS</h1>
                    <p className="text-xs tracking-wider text-gray-500 uppercase">
                      {previewMom.prepared_by_job_title ? `${previewMom.prepared_by_job_title} • ` : ''}{previewMom.prepared_by_department || 'Sales'} Department
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs text-gray-800 pb-4 border-b border-gray-200">
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Client / Company</span>
                      <span className="font-semibold text-gray-900 text-sm">{previewMom.client}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Date of Meeting</span>
                      <span className="font-semibold text-gray-900 text-sm">{previewMom.meeting_date}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Representative</span>
                      <span className="font-semibold text-gray-900">{previewMom.contact_person}</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-gray-400">Platform / Venue</span>
                      <span className="font-semibold text-gray-900">{previewMom.location || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">1. PURPOSE OF MEETING</h4>
                      <p className="text-gray-700 leading-relaxed">{previewMom.purpose || 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">2. MINUTE DISCUSSION DETAILS</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{previewMom.discussion || 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">3. KEY AGREEMENTS REACHED</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{previewMom.agreements || 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold uppercase text-gray-400 text-[10px] tracking-wider mb-1">4. REQUIRED ACTIONS & ACCOUNTABILITY</h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{previewMom.action_items || 'N/A'}</p>
                    </div>

                    {previewMom.file_name && (
                      <div className="bg-gray-50 p-3 rounded border border-gray-100 flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-semibold text-gray-800 text-[10px]">Signed Supporting Document</p>
                            <p className="text-[10px] text-gray-500">{previewMom.file_name}</p>
                          </div>
                        </div>
                        <a href={previewMom.file_url ? getUploadUrl(previewMom.file_url) : '#'} target="_blank" rel="noreferrer" onClick={(e) => { if(!previewMom.file_url) e.preventDefault(); }} className="text-brand hover:text-brand-hover text-[10px] font-semibold flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
                    <span>Prepared By: {previewMom.prepared_by}</span>
                    <span>Status: Completed & Dispatched</span>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                {previewMom.minutes_source !== MinutesSource.UPLOADED &&
                  previewMom.status === MomStatus.DRAFT &&
                  user?.id === previewMom.requestor_id && (
                    <button
                      onClick={() => { const m = previewMom; setPreviewMom(null); handleEdit(m); }}
                      className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-4 py-2 rounded flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Open Editor
                    </button>
                )}
                <button
                  onClick={() => setPreviewMom(null)}
                  className="corp-btn-primary text-xs font-semibold px-4 py-2 rounded"
                >
                  Close Transcript
                </button>
              </div>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};
