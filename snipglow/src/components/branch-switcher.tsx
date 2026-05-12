'use client';

import { useTransition } from 'react';
import { Building2 } from 'lucide-react';
import type { Branch } from '@/types';
import { switchBranch } from '@/app/(dashboard)/actions';

interface BranchSwitcherProps {
  branches: Branch[];
  activeBranchId: string;
}

export function BranchSwitcher({ branches, activeBranchId }: BranchSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  function handleBranchChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newBranchId = e.target.value;
    if (newBranchId === activeBranchId) return;

    startTransition(async () => {
      await switchBranch(newBranchId);
    });
  }

  if (branches.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="text-foreground">{activeBranch?.name ?? 'Branch'}</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      <Building2 className="size-4 text-muted-foreground" />
      <select
        value={activeBranchId}
        onChange={handleBranchChange}
        disabled={isPending}
        className="appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-8 text-sm text-foreground transition-colors hover:border-ring focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50 max-w-[120px] sm:max-w-none truncate"
        aria-label="Switch branch"
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      {isPending && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          <span className="block size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </span>
      )}
    </div>
  );
}
