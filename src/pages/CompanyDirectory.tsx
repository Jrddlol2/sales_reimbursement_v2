import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Company, Department, BusinessUnit, CostCenter, User, UserRole } from '../types';
import { useToast } from '../components/Toast';
import { Pencil, X, Check, Plus, Buildings } from '@phosphor-icons/react';
import { Pagination, usePagination } from '../components/Pagination';

interface EditState {
  name: string;
  industry: string;
  notes: string;
  address: string;
  business_unit_id: string;
  cost_center_id: string;
  default_department_id: string;
  currency: string;
  tax_id: string;
  default_approver_id: string;
}

const emptyForm: EditState = {
  name: '', industry: '', notes: '',
  address: '', business_unit_id: '', cost_center_id: '', default_department_id: '', currency: '', tax_id: '', default_approver_id: ''
};

const toCompanyBody = (f: EditState) => ({
  name: f.name, industry: f.industry, notes: f.notes,
  address: f.address || undefined,
  business_unit_id: f.business_unit_id || undefined,
  cost_center_id: f.cost_center_id || undefined,
  default_department_id: f.default_department_id || undefined,
  currency: f.currency || undefined,
  tax_id: f.tax_id || undefined,
  default_approver_id: f.default_approver_id || undefined,
});

// Phase 1 MDM enrichment fields, shared between the Add form and the
// inline-edit row so both stay in sync as fields are added later.
const CompanyEnrichmentFields: React.FC<{
  values: EditState;
  onChange: (patch: Partial<EditState>) => void;
  businessUnits: BusinessUnit[];
  costCenters: CostCenter[];
  departments: Department[];
  approvers: User[];
  compact?: boolean;
}> = ({ values, onChange, businessUnits, costCenters, departments, approvers, compact }) => {
  const inputClass = compact
    ? 'block w-full border border-gray-300 rounded px-2 py-1.5 text-xs'
    : 'block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none';
  const labelClass = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1';

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Address</label>
          <input type="text" value={values.address} onChange={e => onChange({ address: e.target.value })} className={inputClass} placeholder="Optional" />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input type="text" value={values.currency} onChange={e => onChange({ currency: e.target.value })} className={inputClass} placeholder="e.g. PHP" />
        </div>
        <div>
          <label className={labelClass}>Tax ID</label>
          <input type="text" value={values.tax_id} onChange={e => onChange({ tax_id: e.target.value })} className={inputClass} placeholder="Optional" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Business Unit</label>
          <select value={values.business_unit_id} onChange={e => onChange({ business_unit_id: e.target.value })} className={inputClass}>
            <option value="">-- None --</option>
            {businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cost Center</label>
          <select value={values.cost_center_id} onChange={e => onChange({ cost_center_id: e.target.value })} className={inputClass}>
            <option value="">-- None --</option>
            {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Default Department</label>
          <select value={values.default_department_id} onChange={e => onChange({ default_department_id: e.target.value })} className={inputClass}>
            <option value="">-- None --</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Default Approver (reference only — does not affect claim routing)</label>
        <select
          value={values.default_approver_id}
          onChange={e => onChange({ default_approver_id: e.target.value })}
          className={compact ? 'block w-full md:w-1/3 border border-gray-300 rounded px-2 py-1.5 text-xs' : 'block w-full md:w-1/3 border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none'}
        >
          <option value="">-- None --</option>
          {approvers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <p className="mt-1 text-[10px] text-slate-400">
          Informational only, e.g. the usual account owner for this client. A claim's actual approver always comes from the requestor's reporting manager.
        </p>
      </div>
    </div>
  );
};

export const CompanyDirectory: React.FC = () => {
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<EditState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Reference data for the enrichment fields — fetched once, not per-row.
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [approvers, setApprovers] = useState<User[]>([]);

  const fetchCompanies = () => {
    setLoading(true);
    apiFetch('/api/companies').then(data => {
      setCompanies(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCompanies();
    apiFetch('/api/master-data/all').then(data => {
      setBusinessUnits(data.businessUnits || []);
      setCostCenters(data.costCenters || []);
      setDepartments(data.departments || []);
    }).catch(() => {});
    apiFetch('/api/users').then((data: User[]) => {
      setApprovers(data.filter(u => u.role === UserRole.APPROVER));
    }).catch(() => {});
  }, []);

  const startEdit = (c: Company) => {
    setEditingId(c.id);
    setEditState({
      name: c.name, industry: c.industry || '', notes: c.notes || '',
      address: c.address || '', business_unit_id: c.business_unit_id || '', cost_center_id: c.cost_center_id || '',
      default_department_id: c.default_department_id || '', currency: c.currency || '', tax_id: c.tax_id || '',
      default_approver_id: c.default_approver_id || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(emptyForm);
  };

  const saveEdit = async (c: Company) => {
    if (!editState.name.trim()) return toast.error('Company name is required.');
    setSaving(true);
    try {
      await apiFetch(`/api/companies/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify(toCompanyBody(editState))
      });
      toast.success(`${editState.name} updated.`);
      cancelEdit();
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update company.');
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return toast.error('Company name is required.');
    setSaving(true);
    try {
      await apiFetch('/api/companies', {
        method: 'POST',
        body: JSON.stringify(toCompanyBody(addForm))
      });
      toast.success(`${addForm.name} added to the directory.`);
      setAddForm(emptyForm);
      setShowAddForm(false);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add company.');
    } finally {
      setSaving(false);
    }
  };

  const { currentPage, setPage, totalPages, paginatedItems: paginatedCompanies, totalItems } = usePagination(companies, 25);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-7 w-48 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-md"></div>
        </div>
        <div className="corp-card flex flex-col overflow-hidden animate-pulse">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
          </div>
          <div className="p-4 space-y-4">
            <div className="h-8 bg-slate-100 rounded-md w-full"></div>
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display">Company Directory</h2>
          <p className="mt-1 text-xs text-slate-500">Canonical master list of client companies. Used to populate the "Client (Company Name)" field on every Minutes of Meeting.</p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="corp-btn-primary shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={submitAdd} className="corp-card p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">New Company</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name *</label>
              <input
                type="text"
                required
                value={addForm.name}
                onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="e.g. Ayala Land Inc"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Industry</label>
              <input
                type="text"
                value={addForm.industry}
                onChange={e => setAddForm({ ...addForm, industry: e.target.value })}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="e.g. Real Estate"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
              <input
                type="text"
                value={addForm.notes}
                onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="Optional"
              />
            </div>
          </div>

          <CompanyEnrichmentFields
            values={addForm}
            onChange={patch => setAddForm({ ...addForm, ...patch })}
            businessUnits={businessUnits}
            costCenters={costCenters}
            departments={departments}
            approvers={approvers}
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddForm(emptyForm); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="corp-btn-primary">
              {saving ? 'Adding...' : 'Add Company'}
            </button>
          </div>
        </form>
      )}

      <div className="corp-card flex flex-col overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-display flex items-center gap-2">
            <div className="w-1 h-3 bg-brand rounded-full"></div>
            All Companies ({companies.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Name</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Industry</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Notes</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 py-4">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
                        <Buildings className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-gray-700">No companies yet</p>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto">Add your first company to make it available in the MOM Client field.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedCompanies.map(c => {
                const isEditing = editingId === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-brand/5 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm font-bold text-gray-950">{c.name}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">{c.industry || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">{c.notes || '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm font-medium">
                        {!isEditing && (
                          <button
                            onClick={() => startEdit(c)}
                            className="inline-flex items-center gap-1 text-brand hover:text-brand-hover font-semibold text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
                              <input
                                type="text"
                                value={editState.name}
                                onChange={e => setEditState({ ...editState, name: e.target.value })}
                                className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Industry</label>
                              <input
                                type="text"
                                value={editState.industry}
                                onChange={e => setEditState({ ...editState, industry: e.target.value })}
                                className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
                              <input
                                type="text"
                                value={editState.notes}
                                onChange={e => setEditState({ ...editState, notes: e.target.value })}
                                className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                            </div>
                          </div>

                          <CompanyEnrichmentFields
                            values={editState}
                            onChange={patch => setEditState({ ...editState, ...patch })}
                            businessUnits={businessUnits}
                            costCenters={costCenters}
                            departments={departments}
                            approvers={approvers}
                            compact
                          />

                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(c)}
                              disabled={saving}
                              className="corp-btn-primary text-xs"
                            >
                              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          itemsPerPage={25}
          itemLabel="companies"
        />
      </div>
    </div>
  );
};
