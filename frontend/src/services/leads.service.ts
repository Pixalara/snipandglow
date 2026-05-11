// PingFlow — Leads Service
// Firestore CRUD operations with real-time listeners for lead management

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { formatPhoneE164 } from '@/lib/utils';
import { logActivity } from '@/services/audit.service';
import { getDataPathSegments } from '@/hooks/useBranch';
import type { Lead, LeadSource } from '@/types';

// ─── Collection Helpers ─────────────────────────────────────────────────────

function leadsCollection(_gymId: string) {
  const segs = getDataPathSegments();
  return collection(db, segs[0], segs[1], ...segs.slice(2), 'leads');
}

function leadDoc(_gymId: string, leadId: string) {
  const segs = getDataPathSegments();
  return doc(db, segs[0], segs[1], ...segs.slice(2), 'leads', leadId);
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  trialDate?: Date | null;
  notes?: string; // Initial note text, if provided
}

// ─── Real-time Listeners ────────────────────────────────────────────────────

export function subscribeLeads(
  gymId: string,
  onData: (leads: Lead[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(leadsCollection(gymId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const leads: Lead[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Lead[];
      onData(leads);
    },
    (error) => {
      console.error('Leads subscription error:', error);
      onError(error);
    }
  );
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export async function createLead(
  gymId: string,
  data: CreateLeadInput
): Promise<string> {
  const phone = formatPhoneE164(data.phone);

  const notes = data.notes
    ? [{ text: data.notes, createdBy: 'system', createdAt: Timestamp.now() }]
    : [];

  const docRef = await addDoc(leadsCollection(gymId), {
    name: data.name,
    phone,
    email: data.email || null,
    source: data.source,
    status: 'New',
    assignedTo: null,
    trialDate: data.trialDate ? Timestamp.fromDate(data.trialDate) : null,
    notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  logActivity('LEAD_ADDED', `Added lead ${data.name}`, {
    leadId: docRef.id,
    leadName: data.name,
    source: data.source,
  });

  return docRef.id;
}

export async function updateLead(
  gymId: string,
  leadId: string,
  data: Partial<Lead>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  // Remove id from update payload if present
  delete updateData.id;

  // Fetch current lead name for audit log if not in the update data
  let leadName = data.name;
  if (!leadName) {
    const snap = await getDoc(leadDoc(gymId, leadId));
    leadName = snap.exists() ? (snap.data() as Lead).name : leadId;
  }

  await updateDoc(leadDoc(gymId, leadId), updateData);

  logActivity('LEAD_UPDATED', `Updated lead ${leadName}`, {
    leadId,
    changes: Object.keys(data),
  });
}

export async function deleteLead(
  gymId: string,
  leadId: string
): Promise<void> {
  const snap = await getDoc(leadDoc(gymId, leadId));
  const name = snap.exists() ? (snap.data() as Lead).name : leadId;

  await deleteDoc(leadDoc(gymId, leadId));

  logActivity('LEAD_DELETED', `Deleted lead ${name}`, { leadId });
}

export async function claimLead(
  gymId: string,
  leadId: string,
  trainerUid: string,
  trainerName: string
): Promise<void> {
  await updateDoc(leadDoc(gymId, leadId), {
    assignedTo: trainerUid,
    updatedAt: serverTimestamp(),
  });

  logActivity('LEAD_CLAIMED', `${trainerName} claimed lead`, {
    leadId,
    trainerUid,
    trainerName,
  });
}
