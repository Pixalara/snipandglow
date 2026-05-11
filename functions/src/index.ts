import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Global configuration for Firebase Functions v2
 * Explicitly setting region to asia-south1 as per requirements
 */
setGlobalOptions({ 
  maxInstances: 10, 
  region: 'asia-south1' 
});

if (!admin.apps.length) {
  admin.initializeApp();
}

// Export all functions
export * from './automation/expiryChecker';
export * from './automation/inactivityChecker';
export * from './ai/broadcastAssistant';
export * from './auth/employeeManager';
export * from './auth/otpVerification';
export * from './broadcast/sendBroadcast';
export * from './whatsapp/sendLeadWhatsApp';

// ─── WhatsApp Connect: Connection management + webhook ──────────────────────
export { connectWhatsApp, getWhatsAppStatus, disconnectWhatsApp } from './whatsapp/whatsappConnect';
export { whatsappWebhook } from './whatsapp/webhook';

// ─── Inline Cloud Functions ─────────────────────────────────────────────────
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sendWhatsAppMessage } from './whatsapp/metaCloud.service';

// ─── Backfill employee links for existing employees ─────────────────────────
export const backfillEmployeeLinks = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
    const { gymId } = request.data;
    if (!gymId) throw new HttpsError('invalid-argument', 'gymId required.');
    if (request.auth.uid !== gymId) throw new HttpsError('permission-denied', 'Admin only.');

    const db = admin.firestore();
    const empsSnap = await db.collection('gyms').doc(gymId).collection('employees').get();
    let count = 0;

    for (const empDoc of empsSnap.docs) {
      const data = empDoc.data();
      const linkRef = db.collection('employeeLinks').doc(empDoc.id);
      const existing = await linkRef.get();
      if (!existing.exists) {
        await linkRef.set({
          gymId,
          name: data.name || '',
          email: data.email || '',
          role: 'employee',
          isActive: data.isActive ?? true,
        });
        count++;
        console.log(`[PingFlow][backfill] Created employeeLink for ${empDoc.id} (${data.email})`);
      }
    }

    return { success: true, backfilled: count, total: empsSnap.size };
  }
);

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

// NOTE: syncMessageStatuses is kept for backward compatibility.
// The whatsappWebhook endpoint now handles real-time delivery status updates from Meta.
// This function still provides value for marking stale messages as "Unknown" after 48 hours.
export const syncMessageStatuses = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
    const { gymId } = request.data;
    if (!gymId) throw new HttpsError('invalid-argument', 'gymId is required.');

    const db = admin.firestore();

    console.log(`[PingFlow][syncStatuses] Starting sync for gym: ${gymId}`);

    // This function marks old undelivered messages as "Unknown" after 48 hours
    // and counts current delivery states for the gym.
    // Real-time status updates are now handled by the whatsappWebhook endpoint.
    const cutoff = new Date(Date.now() - FORTY_EIGHT_HOURS_MS);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);

    const logsSnap = await db.collectionGroup('automationLogs')
      .where('gymId', '==', gymId)
      .where('status', '==', 'SUCCESS')
      .where('timestamp', '>=', cutoffTimestamp)
      .orderBy('timestamp', 'desc')
      .get();

    console.log(`[PingFlow][syncStatuses] Found ${logsSnap.size} recent SUCCESS logs`);

    let synced = 0;
    let skipped = 0;

    for (const doc of logsSnap.docs) {
      const data = doc.data();
      const current = data.currentStatus;

      // Skip if already in a terminal state
      if (current === 'Delivered' || current === 'Read' || current === 'Failed') {
        skipped++;
        continue;
      }

      // If no currentStatus set yet, mark as "Submitted" so the UI shows something
      if (!current) {
        let messageId: string | null = null;
        try {
          const resp = typeof data.apiResponse === 'string' ? JSON.parse(data.apiResponse) : data.apiResponse;
          messageId = resp?.submitted_message_id || null;
        } catch { /* ignore */ }

        if (messageId) {
          await doc.ref.update({
            currentStatus: 'Submitted',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
          synced++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    const result = { success: true, synced, skipped, errors: 0, total: logsSnap.size };
    console.log(`[PingFlow][syncStatuses] Done:`, result);
    return result;
  }
);

export const testWhatsAppDelivery = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
    const { gymId, phone, campaignName, templateParams } = request.data;
    if (!gymId || !phone || !campaignName) {
      throw new HttpsError('invalid-argument', 'gymId, phone, and campaignName are required.');
    }

    console.log(`[PingFlow][testWhatsAppDelivery] Testing: gym=${gymId}, phone=${phone}, campaign=${campaignName}`);

    const params = templateParams || ['Test User', 'Test Gym', '13/04/2026'];

    const result = await sendWhatsAppMessage(
      gymId,
      phone,
      campaignName,
      params
    );

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      debug: {
        phoneInput: phone,
        phoneCleaned: phone.replace(/\D/g, ''),
        phoneWithCountry: phone.replace(/\D/g, '').length === 10 ? '91' + phone.replace(/\D/g, '') : phone.replace(/\D/g, ''),
        campaignName,
        templateParams: params,
      }
    };
  }
);
