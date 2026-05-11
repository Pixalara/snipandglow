// PingFlow — Employee Account Manager
// Cloud Function to create employee Firebase Auth accounts and Firestore docs

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const VALID_EMPLOYEE_ROLES = ['branch_manager', 'trainer', 'sales_executive', 'receptionist'] as const;

export const createEmployee = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');

    const { gymId, name, email, phone, password, assignedBranches, role } = request.data;
    if (!gymId || !name || !email || !password) {
      throw new HttpsError('invalid-argument', 'gymId, name, email, and password are required.');
    }
    if (password.length < 6) {
      throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
    }
    if (!role || !VALID_EMPLOYEE_ROLES.includes(role)) {
      throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${VALID_EMPLOYEE_ROLES.join(', ')}`);
    }

    // Verify the caller is the gym admin
    if (request.auth.uid !== gymId) {
      throw new HttpsError('permission-denied', 'Only the gym admin can create employees.');
    }

    const db = admin.firestore();

    try {
      // Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email: email.toLowerCase(),
        password,
        displayName: name,
      });

      console.log(`[PingFlow][createEmployee] Created auth user: ${userRecord.uid} for gym: ${gymId}`);

      // Create employee doc under the gym
      await db.collection('gyms').doc(gymId).collection('employees').doc(userRecord.uid).set({
        uid: userRecord.uid,
        name,
        email: email.toLowerCase(),
        phone: phone || '',
        role,
        assignedBranches: assignedBranches || [],
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create a top-level lookup doc for fast employee → gym resolution on login
      await db.collection('employeeLinks').doc(userRecord.uid).set({
        gymId,
        name,
        email: email.toLowerCase(),
        role,
        assignedBranches: assignedBranches || [],
        isActive: true,
      });

      console.log(`[PingFlow][createEmployee] Employee doc created for ${name} (${email})`);

      return { success: true, uid: userRecord.uid };
    } catch (error: any) {
      console.error('[PingFlow][createEmployee] Error:', error);
      if (error.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'An account with this email already exists.');
      }
      throw new HttpsError('internal', error.message || 'Failed to create employee');
    }
  }
);


export const deleteEmployee = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');

    const { gymId, employeeUid } = request.data;
    if (!gymId || !employeeUid) {
      throw new HttpsError('invalid-argument', 'gymId and employeeUid are required.');
    }

    // Verify the caller is the gym admin
    if (request.auth.uid !== gymId) {
      throw new HttpsError('permission-denied', 'Only the gym admin can remove employees.');
    }

    const db = admin.firestore();

    try {
      // Delete the employee doc from the gym subcollection
      await db.collection('gyms').doc(gymId).collection('employees').doc(employeeUid).delete();
      console.log(`[PingFlow][deleteEmployee] Deleted employee doc: ${employeeUid} from gym: ${gymId}`);

      // Delete the top-level lookup doc
      await db.collection('employeeLinks').doc(employeeUid).delete();
      console.log(`[PingFlow][deleteEmployee] Deleted employeeLink: ${employeeUid}`);

      // Delete the Firebase Auth user
      await admin.auth().deleteUser(employeeUid);
      console.log(`[PingFlow][deleteEmployee] Deleted auth user: ${employeeUid}`);

      return { success: true };
    } catch (error: any) {
      console.error('[PingFlow][deleteEmployee] Error:', error);
      throw new HttpsError('internal', error.message || 'Failed to delete employee');
    }
  }
);
