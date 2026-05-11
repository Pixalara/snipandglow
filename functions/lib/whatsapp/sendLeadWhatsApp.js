"use strict";
// PingFlow — Send WhatsApp to Lead (Cloud Function)
// Callable function that sends a template message to a lead via Meta Cloud API
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLeadWhatsApp = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const metaCloud_service_1 = require("./metaCloud.service");
exports.sendLeadWhatsApp = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { gymId, phone, leadName } = request.data;
    if (!gymId || !phone || !leadName) {
        throw new https_1.HttpsError('invalid-argument', 'gymId, phone, and leadName are required.');
    }
    // Get gym name for the template
    const gymDoc = await admin.firestore().collection('gyms').doc(gymId).get();
    const gymName = gymDoc.exists ? (((_a = gymDoc.data()) === null || _a === void 0 ? void 0 : _a.name) || 'Our Gym') : 'Our Gym';
    console.log(`[PingFlow][LeadWhatsApp] Sending to ${phone} for lead: ${leadName}`);
    const result = await (0, metaCloud_service_1.sendWhatsAppMessage)(gymId, phone, 'pingflow_otp_verification', [leadName, gymName]);
    if (!result.success) {
        console.error(`[PingFlow][LeadWhatsApp] Failed: ${result.error}`);
        return { success: false, error: result.error };
    }
    console.log(`[PingFlow][LeadWhatsApp] Success: messageId=${result.messageId}`);
    return { success: true, messageId: result.messageId };
});
//# sourceMappingURL=sendLeadWhatsApp.js.map