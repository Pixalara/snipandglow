'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { EditCustomerModal, type CustomerRow } from '../customers-client';

/**
 * Edit button for the customer profile page. Opens the shared EditCustomerModal
 * (name, phone, email, gender, date of birth, notes, membership). Lets staff
 * backfill Date of Birth for customers that were created before the field existed.
 */
export function EditCustomerButton({ customer }: { customer: CustomerRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Pencil className="size-4" />
        Edit
      </button>
      {open && <EditCustomerModal customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}
