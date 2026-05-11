"use strict";
// PingFlow — Broadcast Cloud Function
// Sends WhatsApp broadcast to members using Meta Cloud API
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBroadcast = void 0;
const https_1 = require("firebase-functions/v2/https");
const metaCloud_service_1 = require("../whatsapp/metaCloud.service");
exports.sendBroadcast = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { gymId, message, recipients } = request.data;
    if (!gymId || !message || !(recipients === null || recipients === void 0 ? void 0 : recipients.length)) {
        throw new https_1.HttpsError('invalid-argument', 'gymId, message, and recipients are required.');
    }
    console.log(`[PingFlow][Broadcast] Sending to ${recipients.length} members`);
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
        try {
            const phone = r.phone || '';
            const result = await (0, metaCloud_service_1.sendWhatsAppMessage)(gymId, phone, 'pingflow_broadcast', [message.replace(/\n+/g, ' ').trim()]);
            if (result.success) {
                sent++;
            }
            else {
                console.error(`[PingFlow][Broadcast] Failed for ${phone}: ${result.error}`);
                failed++;
            }
        }
        catch (err) {
            console.error(`[PingFlow][Broadcast] Error:`, err);
            failed++;
        }
    }
    console.log(`[PingFlow][Broadcast] Done: ${sent} sent, ${failed} failed`);
    return { success: true, sent, failed };
});
//# sourceMappingURL=sendBroadcast.js.map