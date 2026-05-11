// PingFlow — Broadcast Cloud Function
// Sends WhatsApp broadcast to members using Meta Cloud API

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sendWhatsAppMessage } from '../whatsapp/metaCloud.service';

export const sendBroadcast = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');

    const { gymId, message, recipients } = request.data;
    if (!gymId || !message || !recipients?.length) {
      throw new HttpsError('invalid-argument', 'gymId, message, and recipients are required.');
    }

    console.log(`[PingFlow][Broadcast] Sending to ${recipients.length} members`);

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        const phone = r.phone || '';
        const result = await sendWhatsAppMessage(
          gymId,
          phone,
          'pingflow_broadcast',
          [message.replace(/\n+/g, ' ').trim()]
        );

        if (result.success) {
          sent++;
        } else {
          console.error(`[PingFlow][Broadcast] Failed for ${phone}: ${result.error}`);
          failed++;
        }
      } catch (err) {
        console.error(`[PingFlow][Broadcast] Error:`, err);
        failed++;
      }
    }

    console.log(`[PingFlow][Broadcast] Done: ${sent} sent, ${failed} failed`);
    return { success: true, sent, failed };
  }
);
