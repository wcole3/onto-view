import { create } from "zustand";

import type { Capabilities, Workspace } from "@/api/types";

interface AppState {
  capabilities: Capabilities | null;
  currentWorkspace: Workspace | null;
  isInitializing: boolean;
  initializationError: string | null;
  setCapabilities: (capabilities: Capabilities) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setInitializing: (isInitializing: boolean) => void;
  setInitializationError: (error: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  capabilities: null,
  currentWorkspace: null,
  isInitializing: true,
  initializationError: null,
  setCapabilities: (capabilities) => set({ capabilities }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setInitializing: (isInitializing) => set({ isInitializing }),
  setInitializationError: (initializationError) => set({ initializationError }),
}));
