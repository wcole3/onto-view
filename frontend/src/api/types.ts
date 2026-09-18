/** Shared API types. Field names match the backend exactly. */

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  schema_version: number;
}

export interface WorkspaceCreate {
  name: string;
}

export interface WorkspaceUpdate {
  name?: string | null;
}

export interface Capabilities {
  version: string;
  rdf_formats: string[];
  linkml_formats: string[];
  max_upload_bytes: number;
  max_graph_nodes: number;
  max_graph_edges: number;
  network_imports_enabled: boolean;
  profiles: string[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
