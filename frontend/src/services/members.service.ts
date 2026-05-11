// PingFlow — Members Service
// Firestore CRUD operations with auto-status calculation and real-time listeners

import {
  collection,
  collectionGroup,
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
  where,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { formatPhoneE164 } from '@/lib/utils';
import { differenceInDays, startOfDay } from 'date-fns';
import { logActivity } from '@/services/audit.service';
import { getDataPathSegments } from '@/hooks/useBranch';
import type { Member, MemberStatus, AutomationLog } from '@/types';

function membersCollection(_gymId: string) {
  const segs = getDataPathSegments();
  return collection(db, segs[0], segs[1], ...segs.slice(2), 'members');
}

function memberDoc(_gymId: string, memberId: string) {
  const segs = getDataPathSegments();
  return doc(db, segs[0], segs[1], ...segs.slice(2), 'members', memberId);
}

// ─── Status Calculation ─────────────────────────────────────────────────────

export function calculateMemberStatus(
  endDate: Date,
  lastVisitDate: Date | null
): MemberStatus {
  const today = startOfDay(new Date());
  const endDay = startOfDay(endDate);
  const daysUntilExpiry = differenceInDays(endDay, today);

  // Expired: endDate is in the past (not today)
  if (daysUntilExpiry < 0) {
    return 'expired';
  }

  // Expiring soon: within 7 days including expiry day
  if (daysUntilExpiry <= 7) {
    return 'expiring_soon';
  }

  // Check inactivity: only if member has a lastVisitDate and hasn't visited in 10+ days
  // This avoids marking freshly renewed members as inactive
  if (lastVisitDate) {
    const lastVisitDay = startOfDay(lastVisitDate);
    const daysSinceVisit = differenceInDays(today, lastVisitDay);
    if (daysSinceVisit >= 10) {
      return 'inactive';
    }
  }

  return 'active';
}

// ─── Real-time Listeners ────────────────────────────────────────────────────

export function subscribeMembers(
  gymId: string,
  onData: (members: Member[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(membersCollection(gymId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const members: Member[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Member[];
      onData(members);
    },
    (error) => {
      console.error('Members subscription error:', error);
      onError(error);
    }
  );
}

export function subscribeExpiringMembers(
  gymId: string,
  daysAhead: number,
  onData: (members: Member[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const today = startOfDay(new Date());
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const todayUnix = Math.floor(today.getTime() / 1000);
  const futureUnix = Math.floor(futureDate.getTime() / 1000);

  const q = query(
    membersCollection(gymId),
    where('endDateUnix', '>=', todayUnix),
    where('endDateUnix', '<=', futureUnix),
    orderBy('endDateUnix', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const members: Member[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Member[];
      onData(members);
    },
    (error) => {
      console.error('Expiring members subscription error:', error);
      onError(error);
    }
  );
}

export function subscribeRecentAutomationLogs(
  gymId: string,
  count: number,
  onData: (logs: AutomationLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  // Logs are stored under gyms/{gymId}/members/{memberId}/automationLogs
  // Use collectionGroup to query across all member sub-collections
  const q = query(
    collectionGroup(db, 'automationLogs'),
    where('gymId', '==', gymId),
    orderBy('timestamp', 'desc'),
    limit(count)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AutomationLog[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AutomationLog[];
      onData(logs);
    },
    (error) => {
      console.error('Automation logs subscription error:', error);
      onError(error);
    }
  );
}

export function subscribeMemberAutomationLogs(
  gymId: string,
  memberId: string,
  count: number,
  onData: (logs: AutomationLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'automationLogs'),
    where('gymId', '==', gymId),
    where('memberId', '==', memberId),
    orderBy('timestamp', 'desc'),
    limit(count)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AutomationLog[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AutomationLog[];
      onData(logs);
    },
    (error) => {
      console.error('Member automation logs error:', error);
      onError(error);
    }
  );
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

interface CreateMemberInput {
  name: string;
  phone: string;
  planId: string;
  planName: string;
  startDate: Date;
  endDate: Date;
  lastVisitDate: Date | null;
}

export async function createMember(
  gymId: string,
  data: CreateMemberInput
): Promise<string> {
  const phone = formatPhoneE164(data.phone);
  const endDateTimestamp = Timestamp.fromDate(data.endDate);
  const endDateUnix = Math.floor(data.endDate.getTime() / 1000);
  const status = calculateMemberStatus(data.endDate, data.lastVisitDate);

  const docRef = await addDoc(membersCollection(gymId), {
    name: data.name,
    phone,
    planId: data.planId,
    planName: data.planName,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: endDateTimestamp,
    lastVisitDate: data.lastVisitDate ? Timestamp.fromDate(data.lastVisitDate) : null,
    status,
    endDateUnix,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  logActivity('MEMBER_ADDED', `Added member ${data.name} to ${data.planName}`, { memberId: docRef.id, memberName: data.name, planName: data.planName });
  return docRef.id;
}

interface UpdateMemberInput {
  name?: string;
  phone?: string;
  planId?: string;
  planName?: string;
  startDate?: Date;
  endDate?: Date;
  lastVisitDate?: Date | null;
}

export async function updateMember(
  gymId: string,
  memberId: string,
  data: UpdateMemberInput
): Promise<void> {
  // Fetch current member data to compute status with merged fields
  const currentDoc = await getDoc(memberDoc(gymId, memberId));
  if (!currentDoc.exists()) throw new Error('Member not found');

  const current = currentDoc.data() as Member;

  const endDate = data.endDate ?? current.endDate.toDate();
  const lastVisitDate = data.lastVisitDate !== undefined
    ? data.lastVisitDate
    : current.lastVisitDate
      ? current.lastVisitDate.toDate()
      : null;

  const status = calculateMemberStatus(
    endDate instanceof Date ? endDate : endDate,
    lastVisitDate
  );

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = formatPhoneE164(data.phone);
  if (data.planId !== undefined) updateData.planId = data.planId;
  if (data.planName !== undefined) updateData.planName = data.planName;
  if (data.startDate !== undefined) updateData.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate !== undefined) {
    updateData.endDate = Timestamp.fromDate(data.endDate);
    updateData.endDateUnix = Math.floor(data.endDate.getTime() / 1000);
  }
  if (data.lastVisitDate !== undefined) {
    updateData.lastVisitDate = data.lastVisitDate
      ? Timestamp.fromDate(data.lastVisitDate)
      : null;
  }

  await updateDoc(memberDoc(gymId, memberId), updateData);
  logActivity('MEMBER_UPDATED', `Updated member ${data.name || current.name}`, { memberId, changes: Object.keys(updateData) });
}

export async function deleteMember(
  gymId: string,
  memberId: string
): Promise<void> {
  const snap = await getDoc(memberDoc(gymId, memberId));
  const name = snap.exists() ? (snap.data() as Member).name : memberId;
  await deleteDoc(memberDoc(gymId, memberId));
  logActivity('MEMBER_DELETED', `Deleted member ${name}`, { memberId });
}

export async function getMember(
  gymId: string,
  memberId: string
): Promise<Member | null> {
  const docSnap = await getDoc(memberDoc(gymId, memberId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Member;
}
