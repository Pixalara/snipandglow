// PingFlow — Auth Store (Zustand)

import { create } from 'zustand';
import type { AuthUser, Gym, UserRole, Branch } from '@/types';

interface AuthState {
  user: AuthUser | null;
  gym: Gym | null;
  role: UserRole;
  gymId: string | null;
  branches: Branch[];
  activeBranchId: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  isWhatsAppVerified: boolean;
  setUser: (user: AuthUser | null) => void;
  setGym: (gym: Gym | null) => void;
  setRole: (role: UserRole) => void;
  setGymId: (gymId: string | null) => void;
  setBranches: (branches: Branch[]) => void;
  setActiveBranchId: (branchId: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsOnboarded: (isOnboarded: boolean) => void;
  setIsWhatsAppVerified: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  gym: null,
  role: 'admin',
  gymId: null,
  branches: [],
  activeBranchId: null,
  isLoading: true,
  isOnboarded: false,
  isWhatsAppVerified: false,
  setUser: (user) => set({ user }),
  setGym: (gym) => set({ gym, isOnboarded: gym !== null && (gym as any)?.onboardingComplete === true }),
  setRole: (role) => set({ role }),
  setGymId: (gymId) => set({ gymId }),
  setBranches: (branches) => set({ branches }),
  setActiveBranchId: (activeBranchId) => set({ activeBranchId }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsOnboarded: (isOnboarded) => set({ isOnboarded }),
  setIsWhatsAppVerified: (isWhatsAppVerified) => set({ isWhatsAppVerified }),
  reset: () => set({ user: null, gym: null, role: 'admin', gymId: null, branches: [], activeBranchId: null, isLoading: false, isOnboarded: false, isWhatsAppVerified: false }),
}));
