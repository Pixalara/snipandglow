// PingFlow — Audit Trail Service
// Logs all significant user actions for accountability and compliance

import { addDoc, collection, serverTimestamp, query, orderBy, limit, onSnapshot, type Unsubscribe, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';

export type ActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'MEMBER_ADDED'
  | 'MEMBER_UPDATED'
  | 'MEMBER_DELETED'
  | 'PLAN_ADDED'
  | 'PLAN_UPDATED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_COLLECTED'
  | 'BROADCAST_SENT'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'AUTOMATION_TRIGGERED'
  | 'SETTINGS_UPDATED'
  | 'LEAD_ADDED'
  | 'LEAD_UPDATED'
  | 'LEAD_DELETED'
  | 'LEAD_CLAIMED'
  | 'LEAD_WHATSAPP_SENT'
  | 'LEAD_CONVERTED';

export interface AuditLogEntry {
  id?: string;
  gymId: string;
  branchId: string | null; // 'GLOBAL' if no branch selected, or the active branch ID
  userId: string;
  userName: string;
  userRole: string;
  actionType: ActionType;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Timestamp;
}

function auditCollection(gymId: string) {
  return collection(db, 'gyms', gymId, 'auditLogs');
}

/**
 * Log an activity to the audit trail.
 * Automatically reads the current user from the auth store.
 */
export async function logActivity(
  actionType: ActionType,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  const state = useAuthStore.getState();
  const gymId = state.gymId || state.user?.uid;
  if (!gymId) return;

  // For employees, use their display name; for admin, use ownerName
  const userName = state.role === 'admin'
    ? (state.gym?.ownerName || state.user?.displayName || 'Unknown')
    : (state.user?.displayName || state.gym?.ownerName || 'Unknown');

  try {
    await addDoc(auditCollection(gymId), {
      gymId,
      branchId: state.activeBranchId || 'GLOBAL',
      userId: state.user?.uid || 'unknown',
      userName,
      userRole: state.role || 'admin',
      actionType,
      description,
      metadata: metadata || null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('[PingFlow][Audit] Failed to log activity:', err);
  }
}

/**
 * Subscribe to audit logs for a gym with optional filters
 */
export function subscribeAuditLogs(
  gymId: string,
  options: { limitCount?: number },
  onData: (logs: AuditLogEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    auditCollection(gymId),
    orderBy('timestamp', 'desc'),
    limit(options.limitCount || 100)
  );

  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
      onData(logs);
    },
    (error) => onError(error)
  );
}
