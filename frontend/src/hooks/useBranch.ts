// PingFlow — Branch Hook
// Resolves the correct Firestore data path based on single/multi-branch mode.
// Single-branch: data at gyms/{gymId}/members (backward compatible)
// Multi-branch: data at gyms/{gymId}/branches/{branchId}/members

import { useAuthStore } from '@/store/authStore';

/**
 * Returns the resolved base path for branch-scoped data.
 * All service files should use this to build collection references.
 */
export function useBranch() {
  const { gymId, gym, branches, activeBranchId, setActiveBranchId } = useAuthStore();

  const isMultiBranch = gym?.isMultiBranch === true && branches.length > 1;
  const branchId = activeBranchId;

  // Resolve the base path for data collections
  // Single-branch: gyms/{gymId}
  // Multi-branch: gyms/{gymId}/branches/{branchId}
  const dataPath = isMultiBranch && branchId
    ? `gyms/${gymId}/branches/${branchId}`
    : `gyms/${gymId}`;

  const activeBranch = branches.find(b => b.id === branchId) || branches[0] || null;

  return {
    gymId,
    branchId,
    dataPath,
    isMultiBranch,
    branches,
    activeBranch,
    setActiveBranchId,
  };
}

/**
 * Returns the resolved base path for branch-scoped data.
 * Single-branch: gyms/{gymId}
 * Multi-branch: gyms/{gymId}/branches/{branchId}
 */
export function getDataPath(): string {
  const state = useAuthStore.getState();
  const { gymId, gym, activeBranchId, branches } = state;
  const isMulti = gym?.isMultiBranch === true && branches.length > 1;
  if (isMulti && activeBranchId) {
    return `gyms/${gymId}/branches/${activeBranchId}`;
  }
  return `gyms/${gymId}`;
}

/**
 * Returns the path segments as an array for use with Firestore collection()/doc().
 * e.g. ['gyms', 'abc123'] or ['gyms', 'abc123', 'branches', 'branch1']
 */
export function getDataPathSegments(): string[] {
  const segs = getDataPath().split('/');
  // Safety: ensure no null/undefined segments
  if (segs.some(s => !s || s === 'null' || s === 'undefined')) {
    return ['gyms', '_placeholder'];
  }
  return segs;
}
