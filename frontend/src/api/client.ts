import type {
  ApiErrorBody,
  Capabilities,
  Workspace,
  WorkspaceCreate,
  WorkspaceUpdate,
} from "./types";

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, "network_error", "Network request failed.");
  }

  if (!response.ok) {
    let code = "http_error";
    let message = `Request failed with status ${response.status}.`;
    let details: Record<string, unknown> | undefined;
    try {
      const parsed = (await response.json()) as { error?: ApiErrorBody };
      if (parsed.error) {
        code = parsed.error.code;
        message = parsed.error.message;
        details = parsed.error.details;
      }
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(response.status, code, message, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  getCapabilities: (signal?: AbortSignal): Promise<Capabilities> =>
    request<Capabilities>("/capabilities", { signal }),

  listWorkspaces: (signal?: AbortSignal): Promise<Workspace[]> =>
    request<Workspace[]>("/workspaces", { signal }),

  createWorkspace: (payload: WorkspaceCreate, signal?: AbortSignal): Promise<Workspace> =>
    request<Workspace>("/workspaces", { method: "POST", body: payload, signal }),

  getWorkspace: (workspaceId: string, signal?: AbortSignal): Promise<Workspace> =>
    request<Workspace>(`/workspaces/${encodeURIComponent(workspaceId)}`, { signal }),

  updateWorkspace: (
    workspaceId: string,
    payload: WorkspaceUpdate,
    signal?: AbortSignal,
  ): Promise<Workspace> =>
    request<Workspace>(`/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      body: payload,
      signal,
    }),

  deleteWorkspace: (workspaceId: string, signal?: AbortSignal): Promise<void> =>
    request<void>(`/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      signal,
    }),
};
