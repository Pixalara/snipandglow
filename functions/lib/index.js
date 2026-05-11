"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWhatsAppDelivery = exports.syncMessageStatuses = exports.backfillEmployeeLinks = exports.whatsappWebhook = exports.disconnectWhatsApp = exports.getWhatsAppStatus = exports.connectWhatsApp = void 0;
const v2_1 = require("firebase-functions/v2");
const admin = require("firebase-admin");
/**
 * Global configuration for Firebase Functions v2
 * Explicitly setting region to asia-south1 as per requirements
 */
(0, v2_1.setGlobalOptions)({
    maxInstances: 10,
    region: 'asia-south1'
});
if (!admin.apps.length) {
    admin.initializeApp();
}
// Export all functions
__exportStar(require("./automation/expiryChecker"), exports);
__exportStar(require("./automation/inactivityChecker"), exports);
__exportStar(require("./ai/broadcastAssistant"), exports);
__exportStar(require("./auth/employeeManager"), exports);
__exportStar(require("./auth/otpVerification"), exports);
__exportStar(require("./broadcast/sendBroadcast"), exports);
__exportStar(require("./whatsapp/sendLeadWhatsApp"), exports);
// ─── WhatsApp Connect: Connection management + webhook ──────────────────────
var whatsappConnect_1 = require("./whatsapp/whatsappConnect");
Object.defineProperty(exports, "connectWhatsApp", { enumerable: true, get: function () { return whatsappConnect_1.connectWhatsApp; } });
Object.defineProperty(exports, "getWhatsAppStatus", { enumerable: true, get: function () { return whatsappConnect_1.getWhatsAppStatus; } });
Object.defineProperty(exports, "disconnectWhatsApp", { enumerable: true, get: function () { return whatsappConnect_1.disconnectWhatsApp; } });
var webhook_1 = require("./whatsapp/webhook");
Object.defineProperty(exports, "whatsappWebhook", { enumerable: true, get: function () { return webhook_1.whatsappWebhook; } });
// ─── Inline Cloud Functions ─────────────────────────────────────────────────
const https_1 = require("firebase-functions/v2/https");
const metaCloud_service_1 = require("./whatsapp/metaCloud.service");
// ─── Backfill employee links for existing employees ─────────────────────────
exports.backfillEmployeeLinks = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { gymId } = request.data;
    if (!gymId)
        throw new https_1.HttpsError('invalid-argument', 'gymId required.');
    if (request.auth.uid !== gymId)
        throw new https_1.HttpsError('permission-denied', 'Admin only.');
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
                isActive: (_a = data.isActive) !== null && _a !== void 0 ? _a : true,
            });
            count++;
            console.log(`[PingFlow][backfill] Created employeeLink for ${empDoc.id} (${data.email})`);
        }
    }
    return { success: true, backfilled: count, total: empsSnap.size };
});
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
// NOTE: syncMessageStatuses is kept for backward compatibility.
// The whatsappWebhook endpoint now handles real-time delivery status updates from Meta.
// This function still provides value for marking stale messages as "Unknown" after 48 hours.
exports.syncMessageStatuses = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { gymId } = request.data;
    if (!gymId)
        throw new https_1.HttpsError('invalid-argument', 'gymId is required.');
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
            let messageId = null;
            try {
                const resp = typeof data.apiResponse === 'string' ? JSON.parse(data.apiResponse) : data.apiResponse;
                messageId = (resp === null || resp === void 0 ? void 0 : resp.submitted_message_id) || null;
            }
            catch ( /* ignore */_a) { /* ignore */ }
            if (messageId) {
                await doc.ref.update({
                    currentStatus: 'Submitted',
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                });
                synced++;
            }
            else {
                skipped++;
            }
        }
        else {
            skipped++;
        }
    }
    const result = { success: true, synced, skipped, errors: 0, total: logsSnap.size };
    console.log(`[PingFlow][syncStatuses] Done:`, result);
    return result;
});
exports.testWhatsAppDelivery = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { gymId, phone, campaignName, templateParams } = request.data;
    if (!gymId || !phone || !campaignName) {
        throw new https_1.HttpsError('invalid-argument', 'gymId, phone, and campaignName are required.');
    }
    console.log(`[PingFlow][testWhatsAppDelivery] Testing: gym=${gymId}, phone=${phone}, campaign=${campaignName}`);
    const params = templateParams || ['Test User', 'Test Gym', '13/04/2026'];
    const result = await (0, metaCloud_service_1.sendWhatsAppMessage)(gymId, phone, campaignName, params);
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
});
//# sourceMappingURL=index.js.map