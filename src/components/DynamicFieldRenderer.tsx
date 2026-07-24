import React from 'react';
import { FieldDefinition, Department, CostCenter, BusinessUnit, Branch, ProjectCode, Vendor } from '../types';

export interface MasterDataCatalogs {
  departments: Department[];
  costCenters: CostCenter[];
  businessUnits: BusinessUnit[];
  branches: Branch[];
  projectCodes: ProjectCode[];
  vendors: Vendor[];
}

interface DynamicFieldRendererProps {
  /** Already filtered to `active` and sorted by `display_order` by the caller. */
  definitions: FieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Required only when at least one definition has a master_data_entity dropdown source. */
  masterData?: MasterDataCatalogs;
  errors?: Record<string, string>;
}

const OTHER_SENTINEL = '__other__';

const optionsFor = (field: FieldDefinition, masterData?: MasterDataCatalogs): string[] => {
  if (field.master_data_entity && masterData) {
    return masterData[field.master_data_entity].filter(r => r.active).map(r => r.name);
  }
  return field.options || [];
};

// Renders whatever set of admin-configured fields is passed in — text,
// number, date, textarea, or dropdown (optionally sourced live from a Phase 1
// Master Data catalog instead of a static option list, and optionally
// allowing a free-text "Other" fallback). No knowledge of what the fields
// mean; the caller (a MOM form today) just supplies definitions + values.
export const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({ definitions, values, onChange, masterData, errors }) => {
  if (definitions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {definitions.map(field => {
        const value = values[field.key] ?? '';
        const labelClass = 'block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1';
        const inputClass = 'block w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-brand focus:outline-none bg-white';
        const wrapperClass = field.input_type === 'textarea' ? 'md:col-span-2' : '';

        if (field.input_type === 'dropdown') {
          const options = optionsFor(field, masterData);
          const isKnownOption = options.includes(value);
          const isOtherMode = field.allow_other && value !== '' && !isKnownOption;
          return (
            <div key={field.id} className={wrapperClass}>
              <label className={labelClass}>{field.label}{field.required && ' *'}</label>
              <select
                required={field.required && !field.allow_other}
                value={isOtherMode ? OTHER_SENTINEL : value}
                onChange={e => {
                  if (e.target.value === OTHER_SENTINEL) onChange(field.key, '');
                  else onChange(field.key, e.target.value);
                }}
                className={inputClass}
              >
                <option value="">-- Select {field.label} --</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                {field.allow_other && <option value={OTHER_SENTINEL}>+ Specify your own...</option>}
              </select>
              {isOtherMode && (
                <input
                  type="text"
                  required={field.required}
                  autoFocus
                  placeholder={`Enter your own ${field.label.toLowerCase()}`}
                  value={value}
                  onChange={e => onChange(field.key, e.target.value)}
                  className={`${inputClass} mt-2`}
                />
              )}
              {errors?.[field.key] && <p className="text-[11px] text-red-600 font-semibold mt-1">{errors[field.key]}</p>}
            </div>
          );
        }

        if (field.input_type === 'textarea') {
          return (
            <div key={field.id} className={wrapperClass}>
              <label className={labelClass}>{field.label}{field.required && ' *'}</label>
              <textarea
                required={field.required}
                rows={3}
                value={value}
                onChange={e => onChange(field.key, e.target.value)}
                className={inputClass}
              />
              {errors?.[field.key] && <p className="text-[11px] text-red-600 font-semibold mt-1">{errors[field.key]}</p>}
            </div>
          );
        }

        return (
          <div key={field.id} className={wrapperClass}>
            <label className={labelClass}>{field.label}{field.required && ' *'}</label>
            <input
              type={field.input_type === 'number' ? 'number' : field.input_type === 'date' ? 'date' : 'text'}
              required={field.required}
              value={value}
              onChange={e => onChange(field.key, e.target.value)}
              className={inputClass}
            />
            {errors?.[field.key] && <p className="text-[11px] text-red-600 font-semibold mt-1">{errors[field.key]}</p>}
          </div>
        );
      })}
    </div>
  );
};
