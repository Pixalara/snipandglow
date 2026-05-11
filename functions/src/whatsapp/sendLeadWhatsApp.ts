// PingFlow — Send WhatsApp to Lead (Cloud Function)
// Callable function that sends a template message to a lead via Meta Cloud API

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendWhatsAppMessage } from './metaCloud.service';

export const sendLeadWhatsApp = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');

    const { gymId, phone, leadName } = request.data;
    if (!gymId || !phone || !leadName) {
      throw new HttpsError('invalid-argument', 'gymId, phone, and leadName are required.');
    }

    // Get gym name for the template
    const gymDoc = await admin.firestore().collection('gyms').doc(gymId).get();
    const gymName = gymDoc.exists ? (gymDoc.data()?.name || 'Our Gym') : 'Our Gym';

    console.log(`[PingFlow][LeadWhatsApp] Sending to ${phone} for lead: ${leadName}`);

    const result = await sendWhatsAppMessage(
      gymId,
      phone,
      'pingflow_otp_verification',
      [leadName, gymName]
    );

    if (!result.success) {
      console.error(`[PingFlow][LeadWhatsApp] Failed: ${result.error}`);
      return { success: false, error: result.error };
    }

    console.log(`[PingFlow][LeadWhatsApp] Success: messageId=${result.messageId}`);
    return { success: true, messageId: result.messageId };
  }
);
