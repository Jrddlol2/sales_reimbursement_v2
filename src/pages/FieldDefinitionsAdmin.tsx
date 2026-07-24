import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { FieldDefinition, FieldInputType } from '../types';
import { useToast } from '../components/Toast';
import { Pencil, X, Check, Plus, ListChecks } from '@phosphor-icons/react';
import { EmptyState } from '../components/EmptyState';

const INPUT_TYPES: { value: FieldInputType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Textarea' },
];

const MASTER_DATA_SOURCES: { value: FieldDefinition['master_data_entity']; label: string }[] = [
  { value: 'departments', label: 'Departments' },
  { value: 'costCenters', label: 'Cost Centers' },
  { value: 'businessUnits', label: 'Business Units' },
  { value: 'branches', label: 'Branches' },
  { value: 'projectCodes', label: 'Project Codes' },
  { value: 'vendors', label: 'Vendors' },
];

interface FormState {
  key: string;
  label: string;
  input_type: FieldInputType;
  required: boolean;
  active: boolean;
  default_value: string;
  display_order: number;
  optionsText: string; // comma-separated, only used when dropdownSource === 'static'
  dropdownSource: 'static' | 'master_data';
  master_data_entity: FieldDefinition['master_data_entity'] | '';
  allow_other: boolean;
}

const emptyForm = (nextOrder: number): FormState => ({
  key: '', label: '', input_type: 'text', required: false, active: true, default_value: '',
  display_order: nextOrder, optionsText: '', dropdownSource: 'static', master_data_entity: '', allow_other: false,
});

// Only 'mom' is wired to an actual form today (see MomQuickCreateModal.tsx /
// Moms.tsx), but the entity picker is left in place since FieldDefinition
// already supports more than one form target.
const ENTITY_OPTIONS: { value: FieldDefinition['entity']; label: string }[] = [
  { value: 'mom', label: 'Minutes of Meeting (MOM)' },
];

export const FieldDefinitionsAdmin: React.FC = () => {
  const toast = useToast();
  const [entity, setEntity] = useState<FieldDefinition['entity']>('mom');
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<FormState>(emptyForm(1));
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm(1));
  const [saving, setSaving] = useState(false);

  const fetchDefinitions = () => {
    setLoading(true);
    apiFetch(`/api/field-definitions?entity=${entity}`).then(data => {
      setDefinitions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDefinitions();
    setEditingId(null);
    setShowAddForm(false);
  }, [entity]);

  const toApiBody = (f: FormState) => ({
    entity,
    key: f.key.trim(),
    label: f.label.trim(),
    input_type: f.input_type,
    required: f.required,
    active: f.active,
    default_value: f.default_value || undefined,
    display_order: f.display_order,
    options: f.input_type === 'dropdown' && f.dropdownSource === 'static'
      ? f.optionsText.split(',').map(o => o.trim()).filter(Boolean)
      : undefined,
    master_data_entity: f.input_type === 'dropdown' && f.dropdownSource === 'master_data' ? f.master_data_entity || undefined : undefined,
    allow_other: f.input_type === 'dropdown' ? f.allow_other : false,
  });

  const startEdit = (f: FieldDefinition) => {
    setEditingId(f.id);
    setEditState({
      key: f.key, label: f.label, input_type: f.input_type, required: f.required, active: f.active,
      default_value: f.default_value || '', display_order: f.display_order,
      optionsText: (f.options || []).join(', '),
      dropdownSource: f.master_data_entity ? 'master_data' : 'static',
      master_data_entity: f.master_data_entity || '',
      allow_other: !!f.allow_other,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(emptyForm(definitions.length + 1));
  };

  const saveEdit = async (f: FieldDefinition) => {
    if (!editState.label.trim()) return toast.error('Field label is required.');
    setSaving(true);
    try {
      await apiFetch(`/api/field-definitions/${f.id}`, { method: 'PUT', body: JSON.stringify(toApiBody(editState)) });
      toast.success(`${editState.label} updated.`);
      cancelEdit();
      fetchDefinitions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update field.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: FieldDefinition) => {
    try {
      await apiFetch(`/api/field-definitions/${f.id}`, { method: 'PUT', body: JSON.stringify({ active: !f.active }) });
      toast.success(`${f.label} marked ${f.active ? 'Inactive' : 'Active'}.`);
      fetchDefinitions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.key.trim() || !addForm.label.trim()) return toast.error('Key and label are required.');
    setSaving(true);
    try {
      await apiFetch('/api/field-definitions', { method: 'POST', body: JSON.stringify(toApiBody(addForm)) });
      toast.success(`${addForm.label} added.`);
      setAddForm(emptyForm(definitions.length + 2));
      setShowAddForm(false);
      fetchDefinitions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add field.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'block w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none bg-white';
  const labelClass = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1';

  const renderFieldForm = (state: FormState, setState: (s: FormState) => void, keyLocked: boolean) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Key {!keyLocked && '*'}</label>
          <input
            type="text" disabled={keyLocked} required
            value={state.key}
            onChange={e => setState({ ...state, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
            className={`${inputClass} ${keyLocked ? 'bg-slate-50 text-slate-400' : ''}`}
            placeholder="e.g. type_of_account"
          />
        </div>
        <div>
          <label className={labelClass}>Label *</label>
          <input type="text" required value={state.label} onChange={e => setState({ ...state, label: e.target.value })} className={inputClass} placeholder="e.g. Type of Account" />
        </div>
        <div>
          <label className={labelClass}>Input Type</label>
          <select value={state.input_type} onChange={e => setState({ ...state, input_type: e.target.value as FieldInputType })} className={inputClass}>
            {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {state.input_type === 'dropdown' && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-3">
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={state.dropdownSource === 'static'} onChange={() => setState({ ...state, dropdownSource: 'static' })} /> Static list
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={state.dropdownSource === 'master_data'} onChange={() => setState({ ...state, dropdownSource: 'master_data' })} /> From Master Data catalog
            </label>
          </div>
          {state.dropdownSource === 'static' ? (
            <div>
              <label className={labelClass}>Options (comma-separated)</label>
              <input type="text" value={state.optionsText} onChange={e => setState({ ...state, optionsText: e.target.value })} className={inputClass} placeholder="Existing Client, Prospective Client / Lead, Other" />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Source Catalog</label>
              <select value={state.master_data_entity || ''} onChange={e => setState({ ...state, master_data_entity: e.target.value as FieldDefinition['master_data_entity'] })} className={inputClass}>
                <option value="">-- Choose a catalog --</option>
                {MASTER_DATA_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={state.allow_other} onChange={e => setState({ ...state, allow_other: e.target.checked })} />
            Allow "specify your own value" fallback
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className={labelClass}>Default Value</label>
          <input type="text" value={state.default_value} onChange={e => setState({ ...state, default_value: e.target.value })} className={inputClass} placeholder="Optional" />
        </div>
        <div>
          <label className={labelClass}>Display Order</label>
          <input type="number" value={state.display_order} onChange={e => setState({ ...state, display_order: parseInt(e.target.value) || 0 })} className={inputClass} />
        </div>
        <label className="flex items-center gap-1.5 text-xs pb-1.5">
          <input type="checkbox" checked={state.required} onChange={e => setState({ ...state, required: e.target.checked })} /> Required
        </label>
        <label className="flex items-center gap-1.5 text-xs pb-1.5">
          <input type="checkbox" checked={state.active} onChange={e => setState({ ...state, active: e.target.checked })} /> Active
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display">Dynamic Form Fields</h2>
          <p className="mt-1 text-xs text-slate-500">
            Configure the extra fields that appear on reimbursement forms — label, type, required/optional, active/inactive, default value, and order — instead of hardcoding them.
          </p>
        </div>
        <button onClick={() => setShowAddForm(v => !v)} className="corp-btn-primary shrink-0">
          <Plus className="w-4 h-4" /> Add Field
        </button>
      </div>

      <div>
        <label className={labelClass}>Form</label>
        <select value={entity} onChange={e => setEntity(e.target.value as FieldDefinition['entity'])} className={`${inputClass} max-w-xs`}>
          {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {showAddForm && (
        <form onSubmit={submitAdd} className="corp-card p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">New Field</h3>
          {renderFieldForm(addForm, setAddForm, false)}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowAddForm(false); setAddForm(emptyForm(definitions.length + 1)); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 bg-white">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="corp-btn-primary">{saving ? 'Adding...' : 'Add Field'}</button>
          </div>
        </form>
      )}

      <div className="corp-card flex flex-col overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-8 bg-slate-100 rounded-md w-full"></div>
            <div className="h-12 bg-slate-50 rounded-md w-full"></div>
          </div>
        ) : definitions.length === 0 ? (
          <div className="px-4 py-12">
            <EmptyState icon={ListChecks} title="No fields configured yet" description="Add a field to make it appear on this form." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...definitions].sort((a, b) => a.display_order - b.display_order).map(f => {
              const isEditing = editingId === f.id;
              return (
                <div key={f.id} className={`p-4 ${!f.active ? 'opacity-60' : ''}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      {renderFieldForm(editState, setEditState, true)}
                      <div className="flex justify-end gap-2">
                        <button onClick={cancelEdit} disabled={saving} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded border border-slate-300 bg-white">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                        <button onClick={() => saveEdit(f)} disabled={saving} className="corp-btn-primary text-xs">
                          <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-950">{f.label}</span>
                          <span className="text-[10px] font-mono text-slate-400">{f.key}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">{f.input_type}</span>
                          {f.required && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Required</span>}
                          <button onClick={() => toggleActive(f)} title="Click to toggle">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {f.active ? 'Active' : 'Inactive'}
                            </span>
                          </button>
                        </div>
                        {f.input_type === 'dropdown' && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {f.master_data_entity ? `Sourced from ${f.master_data_entity}` : (f.options || []).join(', ')}
                            {f.allow_other && ' · allows "specify own"'}
                          </p>
                        )}
                      </div>
                      <button onClick={() => startEdit(f)} className="inline-flex items-center gap-1 text-brand hover:text-brand-hover font-semibold text-xs shrink-0">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
