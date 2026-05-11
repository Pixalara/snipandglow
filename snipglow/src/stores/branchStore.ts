import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BranchStore {
  selectedBranchId: string | null
  setSelectedBranch: (id: string | null) => void
}

export const useBranchStore = create<BranchStore>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setSelectedBranch: (id) => set({ selectedBranchId: id }),
    }),
    { name: 'selected-branch' }
  )
)
