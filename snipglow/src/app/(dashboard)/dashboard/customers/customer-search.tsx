'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Input } from '@/components/ui/input';

interface CustomerSearchProps {
  defaultValue: string;
}

export function CustomerSearch({ defaultValue }: CustomerSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value.trim()) {
        params.set('search', value.trim());
      } else {
        params.delete('search');
      }

      startTransition(() => {
        router.push(`/customers?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  return (
    <div className="relative">
      <Input
        type="search"
        placeholder="Search by name or phone..."
        defaultValue={defaultValue}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full sm:w-64"
        aria-label="Search customers"
      />
      {isPending && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
    </div>
  );
}
