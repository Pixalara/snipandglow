"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerAutomationManual = exports.dailyExpiryCheck = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const metaCloud_service_1 = require("../whatsapp/metaCloud.service");
const templates_1 = require("../whatsapp/templates");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
function getStageConfig(daysUntilExpiry) {
    switch (daysUntilExpiry) {
        case 3:
            return {
                eventType: 'D-3_WARNING',
                campaignName: templates_1.TEMPLATES.EXPIRY_WARNING,
                header: 'Don\'t Lose Your Progress!',
                phoneLabel: 'Call My Gym',
                urlLabel: 'Renew Online',
            };
        case 0:
            return {
                eventType: 'D-0_EXPIRY',
                campaignName: templates_1.TEMPLATES.EXPIRY_TODAY,
                header: 'Final Alert: Membership Expires Today!',
                phoneLabel: 'Call My Gym',
                urlLabel: 'Renew Online',
            };
        case -2:
            return {
                eventType: 'D+2_PASSED',
                campaignName: templates_1.TEMPLATES.EXPIRY_PASSED,
                header: 'We Miss You at the Gym!',
                phoneLabel: 'Talk to Manager',
                urlLabel: 'Renew & Return',
            };
        default:
            return null;
    }
}
// ─── IST date boundary helpers ──────────────────────────────────────────────
function getIstDayBoundsInSeconds(offsetDays) {
    const todayIstStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const todayIst = new Date(todayIstStr);
    const targetDate = new Date(todayIst);
    targetDate.setDate(targetDate.getDate() + offsetDays);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();
    const pad = (n) => n.toString().padStart(2, '0');
    const startSec = Math.floor(new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00.000+05:30`).getTime() / 1000);
    const endSec = Math.floor(new Date(`${y}-${pad(m)}-${pad(d)}T23:59:59.999+05:30`).getTime() / 1000);
    return { start: startSec, end: endSec };
}
/**
 * Determine which stage (3, 0, -2) a member's endDateUnix falls into.
 * Returns the daysUntilExpiry value or null if no match.
 */
function matchExpiryStage(endDateUnix, bounds) {
    for (const [days, { start, end }] of bounds) {
        if (endDateUnix >= start && endDateUnix <= end)
            return days;
    }
    return null;
}
// ─── Core processing logic ──────────────────────────────────────────────────
async function processExpiryLogic(docs, todayLogIdSuffix, forceRetry = false) {
    var _a;
    // Pre-compute IST day bounds for all 3 stages
    const stageBounds = new Map([
        [3, getIstDayBoundsInSeconds(3)],
        [0, getIstDayBoundsInSeconds(0)],
        [-2, getIstDayBoundsInSeconds(-2)],
    ]);
    console.log(`[PingFlow] Processing ${docs.length} members. ForceRetry: ${forceRetry}`);
    for (const [days, b] of stageBounds) {
        console.log(`[PingFlow] Stage ${days}: ${b.start}–${b.end}`);
    }
    const batch = db.batch();
    let count = 0;
    for (const doc of docs) {
        const member = doc.data();
        if (!member.phone || !member.endDateUnix) {
            console.log(`[PingFlow] Skipping ${member.name || doc.id}: missing phone or endDateUnix`);
            continue;
        }
        const gymId = (_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
        if (!gymId)
            continue;
        // Match member to a stage
        const stage = matchExpiryStage(member.endDateUnix, stageBounds);
        if (stage === null) {
            console.log(`[PingFlow] No match for ${member.name} (endDateUnix: ${member.endDateUnix})`);
            continue;
        }
        const config = getStageConfig(stage);
        // Deduplication
        const logId = forceRetry
            ? `${config.eventType}_manual_${Date.now()}`
            : `${config.eventType}_${todayLogIdSuffix}`;
        const logRef = doc.ref.collection('automationLogs').doc(logId);
        if (!forceRetry) {
            const existing = await logRef.get();
            if (existing.exists) {
                console.log(`[PingFlow] Already processed ${config.eventType} for ${member.name}. Skipping.`);
                continue;
            }
        }
        // Fetch gym data
        const gymDoc = await db.collection('gyms').doc(gymId).get();
        const gymData = gymDoc.exists ? gymDoc.data() : null;
        const gymName = (gymData === null || gymData === void 0 ? void 0 : gymData.name) || (gymData === null || gymData === void 0 ? void 0 : gymData.gymName) || 'your gym';
        // Format expiry date DD/MM/YYYY
        const expiryDate = new Date(member.endDateUnix * 1000);
        const dd = expiryDate.getDate().toString().padStart(2, '0');
        const mm = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = expiryDate.getFullYear();
        const formattedExpiry = `${dd}/${mm}/${yyyy}`;
        // Template params: {{1}} Member Name, {{2}} Gym Name, {{3}} Expiry Date
        const templateParams = [member.name, gymName, formattedExpiry];
        // NOTE: Header, phone button, and URL button are all static in the Meta templates.
        // Only body templateParams are dynamic.
        // Clean destination for logging
        let logDestination = member.phone.replace(/\D/g, '');
        if (logDestination.length === 10)
            logDestination = '91' + logDestination;
        console.log(`[PingFlow] Sending ${config.eventType} to ${member.name} (${logDestination}) campaign: ${config.campaignName}`);
        const result = await (0, metaCloud_service_1.sendWhatsAppMessage)(gymId, member.phone, config.campaignName, templateParams);
        console.log(`[PingFlow] Result for ${member.name}:`, JSON.stringify(result));
        batch.set(logRef, {
            gymId,
            memberId: doc.id,
            memberName: member.name,
            memberPhone: member.phone,
            destination: logDestination,
            eventType: config.eventType,
            campaignName: config.campaignName,
            templateParams,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: result.success ? 'SUCCESS' : 'FAILED',
            messageId: result.messageId || null,
            error: result.error || null,
        });
        count++;
    }
    if (count > 0)
        await batch.commit();
    return count;
}
// ─── Scheduled function: runs daily at 9 AM IST ────────────────────────────
exports.dailyExpiryCheck = (0, scheduler_1.onSchedule)({
    schedule: 'every day 09:00',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
}, async () => {
    try {
        const snapshot = await db.collectionGroup('members').get();
        const count = await processExpiryLogic(snapshot.docs, getIstDayBoundsInSeconds(0).start, false);
        console.log(`[PingFlow][dailyExpiryCheck] Sent ${count} messages.`);
    }
    catch (error) {
        console.error('[PingFlow][dailyExpiryCheck] Error:', error);
    }
});
// ─── Manual trigger: callable from frontend ─────────────────────────────────
exports.triggerAutomationManual = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { gymId } = request.data;
    if (!gymId)
        throw new https_1.HttpsError('invalid-argument', 'GymID missing.');
    try {
        console.log(`[PingFlow][triggerAutomationManual] Manual trigger for gym: ${gymId}`);
        const snapshot = await db.collection('gyms').doc(gymId).collection('members').get();
        console.log(`[PingFlow][triggerAutomationManual] Found ${snapshot.docs.length} members`);
        const count = await processExpiryLogic(snapshot.docs, getIstDayBoundsInSeconds(0).start, true);
        return { success: true, count };
    }
    catch (error) {
        console.error('[PingFlow][triggerAutomationManual] Error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=expiryChecker.js.map