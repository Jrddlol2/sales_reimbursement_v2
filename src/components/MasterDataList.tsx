import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { MasterDataRecord } from '../types';
import { useToast } from './Toast';
import { Pencil, X, Check, Plus, Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Pagination, usePagination } from './Pagination';
import { EmptyState } from './EmptyState';

export interface MasterDataField {
  key: 'name' | 'code' | 'notes';
  label: string;
  required?: boolean;
  placeholder?: string;
}

interface MasterDataListProps {
  title: string;
  description: string;
  endpoint: string;
  fields: MasterDataField[];
  icon: PhosphorIcon;
}

type EditState = { name: string; code: string; notes: string };
const emptyForm: EditState = { name: '', code: '', notes: '' };

// Generic reusable master-data CRUD list — one instance per entity
// (Department, Cost Center, Business Unit, Branch, Project Code, Vendor),
// mirroring CompanyDirectory.tsx's inline-edit-row pattern. Adding a future
// master-data type means adding one entry to MasterDataAdmin.tsx's tab list,
// not a new component.
export const MasterDataList: React.FC<MasterDataListProps> = ({ title, description, endpoint, fields, icon: Icon }) => {
  const toast = useToast();
  const [records, setRecords] = useState<MasterDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<EditState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchRecords = () => {
    setLoading(true);
    apiFetch(endpoint).then(data => {
      setRecords(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecords();
    setEditingId(null);
    setShowAddForm(false);
    setAddForm(emptyForm);
  }, [endpoint]);

  const startEdit = (r: MasterDataRecord) => {
    setEditingId(r.id);
    setEditState({ name: r.name, code: r.code || '', notes: r.notes || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(emptyForm);
  };

  const saveEdit = async (r: MasterDataRecord) => {
    if (!editState.name.trim()) return toast.error('Name is required.');
    setSaving(true);
    try {
      await apiFetch(`${endpoint}/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editState.name, code: editState.code, notes: editState.notes })
      });
      toast.success(`${editState.name} updated.`);
      cancelEdit();
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update record.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: MasterDataRecord) => {
    try {
      await apiFetch(`${endpoint}/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !r.active })
      });
      toast.success(`${r.name} marked ${r.active ? 'Inactive' : 'Active'}.`);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return toast.error('Name is required.');
    setSaving(true);
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ name: addForm.name, code: addForm.code, notes: addForm.notes })
      });
      toast.success(`${addForm.name} added.`);
      setAddForm(emptyForm);
      setShowAddForm(false);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add record.');
    } finally {
      setSaving(false);
    }
  };

  const { currentPage, setPage, totalPages, paginatedItems: paginatedRecords, totalItems } = usePagination(records, 25);
  const colCount = fields.length + 2; // + Status + Action columns

  if (loading) {
    return (
      <div className="corp-card p-6 animate-pulse space-y-3">
        <div className="h-8 bg-slate-100 rounded-md w-full"></div>
        <div className="h-12 bg-slate-50 rounded-md w-full"></div>
        <div className="h-12 bg-slate-50 rounded-md w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 font-display">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <button onClick={() => setShowAddForm(v => !v)} className="corp-btn-primary shrink-0">
          <Plus className="w-4 h-4" /> Add {title.replace(/s$/, '')}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={submitAdd} className="corp-card p-5 space-y-4">
          <div className={`grid grid-cols-1 md:grid-cols-${fields.length} gap-4`}>
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {f.label}{f.required && ' *'}
                </label>
                <input
                  type="text"
                  required={f.required}
                  value={addForm[f.key]}
                  onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddForm(emptyForm); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="corp-btn-primary">
              {saving ? 'Adding...' : `Add ${title.replace(/s$/, '')}`}
            </button>
          </div>
        </form>
      )}

      <div className="corp-card flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {fields.map(f => (
                  <th key={f.key} className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">{f.label}</th>
                ))}
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Status</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-display">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} description={`Add your first ${title.toLowerCase().replace(/s$/, '')} to make it available across the app.`} />
                  </td>
                </tr>
              ) : paginatedRecords.map(r => {
                const isEditing = editingId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className={`hover:bg-brand/5 transition-colors ${!r.active ? 'opacity-60' : ''}`}>
                      {fields.map(f => (
                        <td key={f.key} className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-800">
                          {f.key === 'name' ? <span className="font-bold text-gray-950">{r.name}</span> : (r[f.key] || '—')}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button onClick={() => toggleActive(r)} title="Click to toggle">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {r.active ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm font-medium">
                        {!isEditing && (
                          <button
                            onClick={() => startEdit(r)}
                            className="inline-flex items-center gap-1 text-brand hover:text-brand-hover font-semibold text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={colCount} className="px-4 py-4">
                          <div className={`grid grid-cols-1 md:grid-cols-${fields.length} gap-3`}>
                            {fields.map(f => (
                              <div key={f.key}>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{f.label}</label>
                                <input
                                  type="text"
                                  value={editState[f.key]}
                                  onChange={e => setEditState({ ...editState, [f.key]: e.target.value })}
                                  className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(r)}
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
          itemLabel={title.toLowerCase()}
        />
      </div>
    </div>
  );
};
