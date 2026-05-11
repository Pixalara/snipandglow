import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { differenceInDays, startOfDay } from 'date-fns';
import { sendWhatsAppMessage } from '../whatsapp/metaCloud.service';
import { TEMPLATES } from '../whatsapp/templates';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const dailyInactivityCheck = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
  },
  async (event) => {
    try {
      console.log('[PingFlow][dailyInactivityCheck] Starting daily inactivity check...');
      
      const getIstDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const todayIst = startOfDay(getIstDate());

      // Query active members across all gyms
      const membersRef = db.collectionGroup('members').where('status', '==', 'active');
      const activeMembersSnapshot = await membersRef.get();

      const batch = db.batch();
      let logCount = 0;

      for (const doc of activeMembersSnapshot.docs) {
        const member = doc.data();
        
        if (!member.phone || !member.lastVisitDate) continue;

        // Convert Firestore Timestamp to Date
        const lastVisitDate = member.lastVisitDate.toDate();
        const daysSinceVisit = differenceInDays(todayIst, startOfDay(lastVisitDate));

        let campaignName = '';
        let eventType = '';

        if (daysSinceVisit === 5) {
          campaignName = TEMPLATES.INACTIVITY_D5;
          eventType = 'D-5_INACTIVE';
        } else if (daysSinceVisit === 10) {
          campaignName = TEMPLATES.INACTIVITY_D10;
          eventType = 'D-10_INACTIVE';
        }

        if (campaignName) {
          const gymId = doc.ref.parent.parent?.id;
          if (!gymId) continue;

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
          const gymName = gymDoc.data()?.name || 'the gym';

          const result = await sendWhatsAppMessage(
            gymId,
            member.phone,
            campaignName,
            [member.name, gymName]
          );

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
      } else {
        console.log('[PingFlow][dailyInactivityCheck] No inactive messages triggered today.');
      }
    } catch (error: unknown) {
      console.error('[PingFlow][dailyInactivityCheck] Fatal Error:', error);
    }
  }
);
