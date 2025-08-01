import { IdmapBackend } from 'app/enums/idmap.enum';

export type IdmapBackendOptions = Record<IdmapBackend, IdmapBackendOption>;

export interface IdmapBackendOption {
  description: string;
  parameters: Record<string, IdmapBackendParameter>;
  has_secrets: boolean;
  services: string[];
}

export interface IdmapBackendParameter {
  default: string | boolean | number | null;
  required: boolean;
}
