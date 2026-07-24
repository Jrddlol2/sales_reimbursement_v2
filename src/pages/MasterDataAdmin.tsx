import React, { useState } from 'react';
import { MasterDataList, MasterDataField } from '../components/MasterDataList';
import { Buildings, Wallet, Stack, MapPin, FolderSimple, Truck, Icon as PhosphorIcon } from '@phosphor-icons/react';

const STANDARD_FIELDS: MasterDataField[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'code', label: 'Code', placeholder: 'Optional' },
  { key: 'notes', label: 'Notes', placeholder: 'Optional' },
];

interface EntityTab {
  key: string;
  label: string;
  endpoint: string;
  description: string;
  icon: PhosphorIcon;
}

// Adding a future master-data type is one entry here — no new component.
const ENTITY_TABS: EntityTab[] = [
  { key: 'departments', label: 'Departments', endpoint: '/api/master-data/departments', description: 'Departments available for User, Company, and (soon) claim assignment.', icon: Stack },
  { key: 'cost-centers', label: 'Cost Centers', endpoint: '/api/master-data/cost-centers', description: 'Cost centers used to attribute spend to a budget owner.', icon: Wallet },
  { key: 'business-units', label: 'Business Units', endpoint: '/api/master-data/business-units', description: 'Business units used to group Companies and departments.', icon: Buildings },
  { key: 'branches', label: 'Branches', endpoint: '/api/master-data/branches', description: 'Physical office branches / locations.', icon: MapPin },
  { key: 'project-codes', label: 'Project Codes', endpoint: '/api/master-data/project-codes', description: 'Project codes for tagging claims to a specific engagement.', icon: FolderSimple },
  { key: 'vendors', label: 'Vendors', endpoint: '/api/master-data/vendors', description: 'Known vendors/merchants referenced by expense line items.', icon: Truck },
];

export const MasterDataAdmin: React.FC = () => {
  const [activeKey, setActiveKey] = useState(ENTITY_TABS[0].key);
  const active = ENTITY_TABS.find(t => t.key === activeKey) || ENTITY_TABS[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display">Master Data</h2>
        <p className="mt-1 text-xs text-slate-500">
          Centralized reference data used across the app instead of hardcoded lists. Inactive records are hidden from new selections but kept for historical records that already reference them.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-0">
        {ENTITY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveKey(tab.key)}
            className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-t border-b-2 transition-colors font-display ${
              activeKey === tab.key
                ? 'border-brand text-brand bg-brand/5'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <MasterDataList
        key={active.key}
        title={active.label}
        description={active.description}
        endpoint={active.endpoint}
        fields={STANDARD_FIELDS}
        icon={active.icon}
      />
    </div>
  );
};
