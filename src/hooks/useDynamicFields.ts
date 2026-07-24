import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { FieldDefinition } from '../types';
import { MasterDataCatalogs } from '../components/DynamicFieldRenderer';

// Shared by every form that renders admin-configured dynamic fields (MOM
// today) — fetches the active field definitions for that entity plus the
// Master Data catalogs any dropdown might be sourced from, once per mount.
export function useDynamicFields(entity: FieldDefinition['entity']) {
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [masterData, setMasterData] = useState<MasterDataCatalogs | undefined>(undefined);

  useEffect(() => {
    apiFetch(`/api/field-definitions?entity=${entity}`)
      .then((defs: FieldDefinition[]) => setDefinitions(defs.filter(d => d.active)))
      .catch(() => {});
    apiFetch('/api/master-data/all').then(setMasterData).catch(() => {});
  }, [entity]);

  return { definitions, masterData };
}

export function getMissingRequiredFieldLabel(definitions: FieldDefinition[], values: Record<string, string>): string | null {
  const missing = definitions.find(f => f.required && !String(values[f.key] ?? '').trim());
  return missing ? missing.label : null;
}
