// PingFlow — Plans Service
// Firestore CRUD operations for gym plans with real-time listeners

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Plan } from '@/types';
import { getDataPathSegments } from '@/hooks/useBranch';

function plansCollection(_gymId: string) {
  const segs = getDataPathSegments();
  return collection(db, segs[0], segs[1], ...segs.slice(2), 'plans');
}

function planDoc(_gymId: string, planId: string) {
  const segs = getDataPathSegments();
  return doc(db, segs[0], segs[1], ...segs.slice(2), 'plans', planId);
}

export function subscribePlans(
  gymId: string,
  onData: (plans: Plan[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(plansCollection(gymId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const plans: Plan[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Plan[];
      onData(plans);
    },
    (error) => {
      console.error('Plans subscription error:', error);
      onError(error);
    }
  );
}

export async function createPlan(
  gymId: string,
  data: { name: string; durationDays: number; price: number }
): Promise<string> {
  const docRef = await addDoc(plansCollection(gymId), {
    name: data.name,
    durationDays: data.durationDays,
    price: data.price,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePlan(
  gymId: string,
  planId: string,
  data: Partial<{ name: string; durationDays: number; price: number; isActive: boolean }>
): Promise<void> {
  await updateDoc(planDoc(gymId, planId), data);
}

export async function deletePlan(
  gymId: string,
  planId: string
): Promise<void> {
  await deleteDoc(planDoc(gymId, planId));
}
