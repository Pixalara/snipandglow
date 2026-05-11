// PingFlow — Branch Service
// CRUD operations for gym branches

import {
  collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp,
  query, orderBy, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Branch } from '@/types';

function branchesCollection(gymId: string) {
  return collection(db, 'gyms', gymId, 'branches');
}

export function subscribeBranches(
  gymId: string,
  onData: (branches: Branch[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(branchesCollection(gymId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const branches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
      onData(branches);
    },
    (error) => onError(error)
  );
}

export async function createBranch(
  gymId: string,
  data: { name: string; address?: string; phone?: string; isDefault?: boolean }
): Promise<string> {
  const docRef = await addDoc(branchesCollection(gymId), {
    name: data.name,
    address: data.address || '',
    phone: data.phone || '',
    isDefault: data.isDefault || false,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateBranch(
  gymId: string,
  branchId: string,
  data: Partial<Branch>
): Promise<void> {
  await updateDoc(doc(db, 'gyms', gymId, 'branches', branchId), data);
}
