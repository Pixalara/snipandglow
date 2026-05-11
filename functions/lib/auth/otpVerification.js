"use strict";
// PingFlow — Dual OTP Verification
// Sends OTP via Email (NodeMailer) + WhatsApp (Meta Cloud API), verifies both
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmWhatsAppOTP = exports.sendWhatsAppOnlyOTP = exports.resendWhatsAppOTP = exports.confirmSignup = exports.triggerSignupVerification = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const metaCloud_service_1 = require("../whatsapp/metaCloud.service");
const db = admin.firestore();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Email transporter — uses Zoho SMTP (DKIM verified for pixalara.com)
function getMailTransporter() {
    return nodemailer.createTransport({
        host: 'smtp.zoho.in',
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_EMAIL || 'auth@pixalara.com',
            pass: process.env.SMTP_PASSWORD || '',
        },
    });
}
// ─── Step 1: Trigger OTP Verification ───────────────────────────────────────
exports.triggerSignupVerification = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const { name, email, phone, password } = request.data;
    if (!name || !email || !phone || !password) {
        throw new https_1.HttpsError('invalid-argument', 'All fields are required.');
    }
    if (password.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
    }
    // Check if email already exists in Firebase Auth
    try {
        await admin.auth().getUserByEmail(email.toLowerCase());
        throw new https_1.HttpsError('already-exists', 'An account with this email already exists.');
    }
    catch (err) {
        if (err.code !== 'auth/user-not-found' && err instanceof https_1.HttpsError)
            throw err;
    }
    const emailOTP = generateOTP();
    const whatsappOTP = generateOTP();
    // Clean phone: digits only, ensure 91 prefix
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10)
        cleanPhone = '91' + cleanPhone;
    const verificationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Store pending verification
    await db.collection('pendingVerifications').doc(verificationId).set({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: cleanPhone,
        password,
        emailOTP,
        whatsappOTP,
        failedAttempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    console.log(`[PingFlow][OTP] Verification ${verificationId} created for ${email}`);
    // Send Email OTP
    try {
        const transporter = getMailTransporter();
        await transporter.sendMail({
            from: '"PingFlow Auth" <auth@pixalara.com>',
            to: email,
            subject: `${emailOTP} is your PingFlow verification code`,
            html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <div style="background:linear-gradient(135deg,#E11D48,#BE123C);padding:16px 24px;border-radius:14px 14px 0 0;">
              <h2 style="color:#FFF;margin:0;font-size:20px;">PingFlow</h2>
            </div>
            <div style="background:#FFF;border:1px solid #E2E8F0;border-top:none;padding:28px 24px;border-radius:0 0 14px 14px;">
              <p style="color:#334155;font-size:15px;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
              <p style="color:#64748B;font-size:14px;margin:0 0 20px;">Your email verification code is:</p>
              <div style="background:#F8FAFC;border:2px dashed #E2E8F0;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
                <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#0F172A;">${emailOTP}</span>
              </div>
              <p style="color:#94A3B8;font-size:12px;margin:0;">This code expires in 5 minutes. Do not share it with anyone.</p>
            </div>
          </div>
        `,
        });
        console.log(`[PingFlow][OTP] Email OTP sent to ${email}`);
    }
    catch (err) {
        console.error('[PingFlow][OTP] Email send failed:', err);
        throw new https_1.HttpsError('internal', 'Failed to send email verification code.');
    }
    // Send WhatsApp OTP via Meta Cloud API
    try {
        const waResult = await (0, metaCloud_service_1.sendWhatsAppMessage)('__default__', cleanPhone, 'pingflow_otp_verification', [whatsappOTP]);
        if (!waResult.success) {
            console.error('[PingFlow][OTP] WhatsApp OTP failed:', waResult.error);
        }
        else {
            console.log(`[PingFlow][OTP] WhatsApp OTP sent to ${cleanPhone}, messageId: ${waResult.messageId}`);
        }
    }
    catch (err) {
        console.error('[PingFlow][OTP] WhatsApp send failed:', err);
        // Don't throw — email OTP is the primary, WhatsApp is secondary
    }
    return { success: true, verificationId, phoneLast4: cleanPhone.slice(-4) };
});
// ─── Step 2: Confirm Signup (Verify both OTPs) ─────────────────────────────
exports.confirmSignup = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    var _a, _b;
    const { verificationId, emailCode, whatsappCode } = request.data;
    if (!verificationId || !emailCode || !whatsappCode) {
        throw new https_1.HttpsError('invalid-argument', 'Verification ID and both codes are required.');
    }
    const docRef = db.collection('pendingVerifications').doc(verificationId);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Verification expired or not found. Please try again.');
    }
    const data = snap.data();
    // Check expiry
    const expiresAt = ((_b = (_a = data.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.expiresAt);
    if (new Date() > expiresAt) {
        await docRef.delete();
        throw new https_1.HttpsError('deadline-exceeded', 'Verification codes have expired. Please request new codes.');
    }
    // Check failed attempts limit
    const attempts = (data.failedAttempts || 0);
    if (attempts >= 3) {
        throw new https_1.HttpsError('resource-exhausted', 'Too many failed attempts. Please contact support at hello@pixalara.com');
    }
    // Verify codes
    if (emailCode !== data.emailOTP || whatsappCode !== data.whatsappOTP) {
        await docRef.update({ failedAttempts: attempts + 1 });
        const remaining = 2 - attempts;
        if (remaining <= 0) {
            throw new https_1.HttpsError('resource-exhausted', 'Too many failed attempts. Please contact support at hello@pixalara.com');
        }
        throw new https_1.HttpsError('permission-denied', `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }
    // Both codes verified — create the user
    try {
        const userRecord = await admin.auth().createUser({
            email: data.email,
            password: data.password,
            displayName: data.name,
        });
        // Create gym document
        const planEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await db.collection('gyms').doc(userRecord.uid).set({
            ownerName: data.name,
            email: data.email,
            phone: data.phone,
            plan: 'trial',
            planStartDate: admin.firestore.FieldValue.serverTimestamp(),
            planEndDate: admin.firestore.Timestamp.fromDate(planEndDate),
            isActive: true,
            isWhatsAppVerified: true,
            onboardingComplete: false,
            walletBalance: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Log audit event
        await db.collection('gyms').doc(userRecord.uid).collection('auditLogs').add({
            gymId: userRecord.uid,
            branchId: 'GLOBAL',
            userId: userRecord.uid,
            userName: data.name,
            userRole: 'admin',
            actionType: 'USER_SIGNUP_VERIFIED',
            description: `Account created and verified via dual OTP (Email + WhatsApp)`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Clean up pending verification
        await docRef.delete();
        console.log(`[PingFlow][OTP] User ${userRecord.uid} created and verified`);
        // Generate a custom token so the frontend can sign in immediately
        const customToken = await admin.auth().createCustomToken(userRecord.uid);
        return { success: true, uid: userRecord.uid, customToken };
    }
    catch (err) {
        console.error('[PingFlow][OTP] User creation failed:', err);
        if (err.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'An account with this email already exists.');
        }
        throw new https_1.HttpsError('internal', err.message || 'Failed to create account.');
    }
});
// ─── Resend WhatsApp OTP ────────────────────────────────────────────────────
exports.resendWhatsAppOTP = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    var _a, _b;
    const { verificationId } = request.data;
    if (!verificationId)
        throw new https_1.HttpsError('invalid-argument', 'Verification ID required.');
    const docRef = db.collection('pendingVerifications').doc(verificationId);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Verification expired. Please start over.');
    }
    const data = snap.data();
    const expiresAt = ((_b = (_a = data.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.expiresAt);
    if (new Date() > expiresAt) {
        await docRef.delete();
        throw new https_1.HttpsError('deadline-exceeded', 'Verification expired. Please start over.');
    }
    // Generate new WhatsApp OTP
    const newOTP = generateOTP();
    await docRef.update({ whatsappOTP: newOTP });
    // Send via Meta Cloud API
    try {
        const waResult = await (0, metaCloud_service_1.sendWhatsAppMessage)('__default__', data.phone, 'pingflow_otp_verification', [newOTP]);
        if (!waResult.success) {
            console.error('[PingFlow][OTP] Resend failed:', waResult.error);
        }
        else {
            console.log(`[PingFlow][OTP] Resent WhatsApp OTP to ${data.phone}, messageId: ${waResult.messageId}`);
        }
    }
    catch (err) {
        console.error('[PingFlow][OTP] Resend failed:', err);
        // Don't throw — log and continue
    }
    return { success: true };
});
// ─── WhatsApp-Only OTP (for Google signup users) ────────────────────────────
exports.sendWhatsAppOnlyOTP = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { phone } = request.data;
    if (!phone)
        throw new https_1.HttpsError('invalid-argument', 'Phone number is required.');
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10)
        cleanPhone = '91' + cleanPhone;
    const otp = generateOTP();
    const verificationId = `wa_${request.auth.uid}_${Date.now()}`;
    await db.collection('pendingVerifications').doc(verificationId).set({
        uid: request.auth.uid,
        phone: cleanPhone,
        whatsappOTP: otp,
        failedAttempts: 0,
        type: 'whatsapp_only',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    // Send via Meta Cloud API
    try {
        const waResult = await (0, metaCloud_service_1.sendWhatsAppMessage)('__default__', cleanPhone, 'pingflow_otp_verification', [otp]);
        if (!waResult.success) {
            console.error('[PingFlow][OTP] WhatsApp-only send failed:', waResult.error);
        }
        else {
            console.log(`[PingFlow][OTP] WhatsApp-only OTP sent to ${cleanPhone}, messageId: ${waResult.messageId}`);
        }
    }
    catch (err) {
        console.error('[PingFlow][OTP] WhatsApp-only send failed:', err);
        // Don't throw — log and continue
    }
    return { success: true, verificationId, phoneLast4: cleanPhone.slice(-4) };
});
exports.confirmWhatsAppOTP = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required.');
    const { verificationId, code } = request.data;
    if (!verificationId || !code)
        throw new https_1.HttpsError('invalid-argument', 'Verification ID and code required.');
    const docRef = db.collection('pendingVerifications').doc(verificationId);
    const snap = await docRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Verification expired. Please try again.');
    const data = snap.data();
    // Verify ownership
    if (data.uid !== request.auth.uid)
        throw new https_1.HttpsError('permission-denied', 'Invalid verification.');
    // Check expiry
    const expiresAt = ((_b = (_a = data.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.expiresAt);
    if (new Date() > expiresAt) {
        await docRef.delete();
        throw new https_1.HttpsError('deadline-exceeded', 'Code expired. Please request a new one.');
    }
    // Check attempts
    const attempts = data.failedAttempts || 0;
    if (attempts >= 3) {
        throw new https_1.HttpsError('resource-exhausted', 'Too many failed attempts. Contact hello@pixalara.com');
    }
    // Verify code
    if (code !== data.whatsappOTP) {
        await docRef.update({ failedAttempts: attempts + 1 });
        const remaining = 2 - attempts;
        throw new https_1.HttpsError('permission-denied', remaining <= 0
            ? 'Too many failed attempts. Contact hello@pixalara.com'
            : `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }
    // Success — update gym doc
    await db.collection('gyms').doc(request.auth.uid).update({
        isWhatsAppVerified: true,
        phone: data.phone,
    });
    // Audit log
    await db.collection('gyms').doc(request.auth.uid).collection('auditLogs').add({
        gymId: request.auth.uid,
        branchId: 'GLOBAL',
        userId: request.auth.uid,
        userName: request.auth.token.name || 'User',
        userRole: 'admin',
        actionType: 'WHATSAPP_VERIFIED',
        description: 'WhatsApp number verified via OTP',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    await docRef.delete();
    console.log(`[PingFlow][OTP] WhatsApp verified for ${request.auth.uid}`);
    return { success: true };
});
//# sourceMappingURL=otpVerification.js.map