import Papa from 'papaparse';
import { Claim, Approval, User } from './types';
import { getStatusBadgeClass, getStatusConfig } from './statusConfig';

// Thin re-exports over statusConfig.ts (the single source of truth for
// status -> color/label/icon) kept for existing callers that need a raw
// class string or label instead of the <StatusBadge> component.
export const getStatusColor = getStatusBadgeClass;

// Canonical display label for a status, e.g. 'Ready for Claim' -> 'Ready to
// Claim', 'ReturnedForRevision' -> 'Returned for Revision'. <StatusBadge>
// already applies this by default — only call this directly when you need
// the bare label string outside a badge.
export const getStatusDisplayLabel = (status: string): string => getStatusConfig(status).label;

export const formatPHP = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};

// Single source of truth for date display — call sites otherwise reach for
// whichever toLocaleDateString/toLocaleString options are at hand, producing
// "7/24/2026" in one table and "July 24, 2026" in the next for the same kind
// of value. Defaults to a compact "Jul 24, 2026" form; pass `options` to
// override for a specific need (e.g. a "Month Year" grouping label).
export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Every claim gets a real claim_number once /api/claims persists it; this
// fallback only ever applies to a claim object that hasn't round-tripped
// through the server yet (there shouldn't be any in normal use, but it keeps
// display code crash-proof either way).
export const getClaimNumber = (claim: Pick<Claim, 'id' | 'claim_number'>): string =>
  claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;

// Resolves the approver's name and comment for a claim's most recent
// "Approved" decision, falling back to the currently assigned approver's
// name (no comment on file) if no Approved decision exists yet.
export const getApproverInfo = (
  claim: { approvals?: Approval[]; current_approver_id?: string },
  users: User[]
): { name: string; comment: string } => {
  const approvalRecord = (claim.approvals || []).slice().reverse().find(a => a.decision === 'Approved');
  if (approvalRecord) {
    const approver = users.find(u => u.id === approvalRecord.approver_id);
    return { name: approver?.name || 'Unknown Approver', comment: approvalRecord.comment || 'No comment provided.' };
  }
  const approver = users.find(u => u.id === claim.current_approver_id);
  return { name: approver?.name || 'Unknown Approver', comment: 'No comment on file.' };
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const userId = localStorage.getItem('mockUserId');
  const headers: Record<string, string> = {};
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    headers
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to upload file');
  }
  const data = await res.json();
  return data.url;
};


// TEMPORARY (Phase 0 interim upload access gate — see server.ts's
// /uploads/:filename route) — appends the current mock user id as a query
// param so direct browser resource loads (<img src>, <iframe src>,
// window.open, <a href>) still carry an identity the server can check, since
// those requests can't attach the X-User-Id header apiFetch() uses. Wrap any
// receipt/MOM attachment URL with this before handing it to the DOM. Safe to
// call on an already-external or empty URL — passes it through unchanged.
export const getUploadUrl = (url?: string | null): string => {
  if (!url || !url.startsWith('/uploads/')) return url || '';
  const userId = localStorage.getItem('mockUserId');
  if (!userId) return url;
  return `${url}?uid=${encodeURIComponent(userId)}`;
};

export const IS_DEMO_MODE = (import.meta as any).env?.VITE_IS_DEMO_MODE !== 'false';

// Shared by every MOM-creation form (MomQuickCreateModal.tsx, Moms.tsx's
// "Create Minutes in System" template) so "Fill with Sample Data" produces
// the same quality of demo content everywhere instead of each form keeping
// its own copy-pasted word lists that drift apart.
export interface MomSampleData {
  client: string;
  contactPerson: string;
  contactPersonEmail: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  purpose: string;
  discussion: string;
  agreements: string;
  actionItems: string;
}

export const generateMomSampleData = (): MomSampleData => {
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

  const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const clientName = rand(companies);
  const contactName = rand(contacts);
  const [first, ...rest] = contactName.split(' ');
  const last = rest[rest.length - 1] || first;

  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 30));

  return {
    client: clientName,
    contactPerson: contactName,
    contactPersonEmail: `${first.toLowerCase()}.${last.toLowerCase()}@${clientName.replace(/[^a-zA-Z]/g, '').toLowerCase()}.com`,
    meetingDate: d.toISOString().split('T')[0],
    meetingTime: `${String(Math.floor(Math.random() * 7) + 9).padStart(2, '0')}:00`,
    location: rand(platforms),
    purpose: rand(purposes),
    discussion: rand(discussions),
    agreements: 'Agreed to proceed with the next steps as discussed. Client will review proposals internally and revert by end of week.',
    actionItems: rand(items),
  };
};

// Randomizes admin-configured dynamic fields for the "Fill with Sample Data"
// action — generic over whatever fields exist today or get added later, so
// the sample-data generator never needs updating when an Admin adds a field.
export const generateSampleCustomFieldValues = (
  definitions: { key: string; input_type: string; label: string; options?: string[]; master_data_entity?: string }[],
  masterData?: Record<string, { name: string; active: boolean }[]>
): Record<string, string> => {
  const values: Record<string, string> = {};
  definitions.forEach(f => {
    if (f.input_type === 'dropdown') {
      const options = f.master_data_entity && masterData
        ? masterData[f.master_data_entity].filter(r => r.active).map(r => r.name)
        : (f.options || []);
      if (options.length > 0) values[f.key] = options[Math.floor(Math.random() * options.length)];
    } else if (f.input_type === 'number') {
      values[f.key] = String(Math.floor(Math.random() * 100));
    } else if (f.input_type === 'date') {
      values[f.key] = new Date().toISOString().split('T')[0];
    } else if (f.input_type === 'textarea') {
      values[f.key] = `Sample details for ${f.label.toLowerCase()}.`;
    } else {
      values[f.key] = `Sample ${f.label}`;
    }
  });
  return values;
};

// Shared by TransactionHistory and MyRequests — both export the same shape
// of unified request row, so the CSV-building logic lives in one place
// instead of two copies that could format columns differently over time.
export const exportRequestsToCSV = (
  items: { reference: string; type: string; status: string; amount: number; date: string }[],
  filename: string
) => {
  if (items.length === 0) return;
  const csv = Papa.unparse(items.map(item => ({
    Reference: item.reference,
    Type: item.type,
    Status: item.status,
    Amount: item.amount,
    Date: item.date ? item.date.substring(0, 10) : ''
  })));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
