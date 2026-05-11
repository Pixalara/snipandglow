"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyInactivityCheck = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const date_fns_1 = require("date-fns");
const metaCloud_service_1 = require("../whatsapp/metaCloud.service");
const templates_1 = require("../whatsapp/templates");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.dailyInactivityCheck = (0, scheduler_1.onSchedule)({
    schedule: 'every day 09:00',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
}, async (event) => {
    var _a, _b;
    try {
        console.log('[PingFlow][dailyInactivityCheck] Starting daily inactivity check...');
        const getIstDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const todayIst = (0, date_fns_1.startOfDay)(getIstDate());
        // Query active members across all gyms
        const membersRef = db.collectionGroup('members').where('status', '==', 'active');
        const activeMembersSnapshot = await membersRef.get();
        const batch = db.batch();
        let logCount = 0;
        for (const doc of activeMembersSnapshot.docs) {
            const member = doc.data();
            if (!member.phone || !member.lastVisitDate)
                continue;
            // Convert Firestore Timestamp to Date
            const lastVisitDate = member.lastVisitDate.toDate();
            const daysSinceVisit = (0, date_fns_1.differenceInDays)(todayIst, (0, date_fns_1.startOfDay)(lastVisitDate));
            let campaignName = '';
            let eventType = '';
            if (daysSinceVisit === 5) {
                campaignName = templates_1.TEMPLATES.INACTIVITY_D5;
                eventType = 'D-5_INACTIVE';
            }
            else if (daysSinceVisit === 10) {
                campaignName = templates_1.TEMPLATES.INACTIVITY_D10;
                eventType = 'D-10_INACTIVE';
            }
            if (campaignName) {
                const gymId = (_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
                if (!gymId)
                    continue;
                // Deduplication: check if we already logged this specific event today for this member
                const logId = `${eventType}_${todayIst.getTime()}`;
                const logRef = doc.ref.collection('automationLogs').doc(logId);
                const existingLog = await logRef.get();
                if (existingLog.exists) {
                    console.log(`[PingFlow][dailyInactivityCheck] Skipping, already sent ${eventType} for ${member.name}`);
                    continue;
                }
                console.log(`[PingFlow][dailyInactivityCheck] Sending ${eventType} to ${member.name}`);
                // In prompting config, templates require: name, gymName
                // But our current payload function just takes an array of params.
                // Getting gymName requires fetching it, or passing it if we cached it.
                // Fetch gymName:
                const gymDoc = await db.collection('gyms').doc(gymId).get();
                const gymName = ((_b = gymDoc.data()) === null || _b === void 0 ? void 0 : _b.name) || 'the gym';
                const result = await (0, metaCloud_service_1.sendWhatsAppMessage)(gymId, member.phone, campaignName, [member.name, gymName]);
                batch.set(logRef, {
                    gymId,
                    memberId: doc.id,
                    memberName: member.name,
                    eventType,
                    campaignName,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: result.success ? 'SUCCESS' : 'FAILED',
                    messageId: result.messageId || null,
                    error: result.error || null,
                });
                logCount++;
            }
        }
        if (logCount > 0) {
            await batch.commit();
            console.log(`[PingFlow][dailyInactivityCheck] Sent and logged ${logCount} automated messages.`);
        }
        else {
            console.log('[PingFlow][dailyInactivityCheck] No inactive messages triggered today.');
        }
    }
    catch (error) {
        console.error('[PingFlow][dailyInactivityCheck] Fatal Error:', error);
    }
});
//# sourceMappingURL=inactivityChecker.js.map