// PingFlow — WhatsApp Service (Meta Cloud API Integration)
// Manages WhatsApp connection lifecycle and messaging via Cloud Functions

import type { WhatsAppStatus } from '@/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

/**
 * Connect a gym's WhatsApp Business number via Meta Embedded Signup
 * Sends the authorization code to the backend for token exchange
 */
export async function connectWhatsApp(
  gymId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const connectFn = httpsCallable(functions, 'connectWhatsApp');
    const result = await connectFn({ gymId, code });
    return result.data as { success: boolean; error?: string };
  } catch (err: any) {
    console.error('[PingFlow][whatsapp.service] Connect failed:', err);
    return { success: false, error: err.message || 'Failed to connect WhatsApp' };
  }
}

/**
 * Get the current WhatsApp connection status for a gym
 */
export async function getWhatsAppStatus(
  gymId: string
): Promise<WhatsAppStatus> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const statusFn = httpsCallable(functions, 'getWhatsAppStatus');
    const result = await statusFn({ gymId });
    return result.data as WhatsAppStatus;
  } catch (err: any) {
    console.error('[PingFlow][whatsapp.service] Get status failed:', err);
    return { status: 'not_connected', phoneNumber: null, displayName: null };
  }
}

/**
 * Disconnect a gym's WhatsApp Business number, reverting to default
 */
export async function disconnectWhatsApp(
  gymId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const disconnectFn = httpsCallable(functions, 'disconnectWhatsApp');
    const result = await disconnectFn({ gymId });
    return result.data as { success: boolean; error?: string };
  } catch (err: any) {
    console.error('[PingFlow][whatsapp.service] Disconnect failed:', err);
    return { success: false, error: err.message || 'Failed to disconnect WhatsApp' };
  }
}

/**
 * Trigger manual automation for a specific gym
 * Uses Firebase v2 httpsCallable for asia-south1
 */
export async function triggerManualAutomation(gymId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const triggerManual = httpsCallable(functions, 'triggerAutomationManual');
    const result = await triggerManual({ gymId });
    
    const data = result.data as { success: boolean; count: number };
    return { 
      success: !!data.success, 
      count: data.count || 0 
    };
  } catch (err: any) {
    console.error('[PingFlow][whatsapp.service] Manual trigger failed:', err);
    return { success: false, error: err.message || 'Failed to trigger manual automation' };
  }
}

/**
 * Sync delivery statuses for recent automation messages
 * Polls for real delivery status (Delivered, Read, Failed)
 * Note: Webhook now handles this automatically, kept for backward compatibility
 */
export async function syncMessageStatuses(gymId: string): Promise<{ success: boolean; synced?: number; skipped?: number; errors?: number; error?: string }> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const syncFn = httpsCallable(functions, 'syncMessageStatuses');
    const result = await syncFn({ gymId });
    const data = result.data as { success: boolean; synced: number; skipped: number; errors: number };
    return data;
  } catch (err: any) {
    console.error('[PingFlow][whatsapp.service] Sync statuses failed:', err);
    return { success: false, error: err.message || 'Failed to sync statuses' };
  }
}

/**
 * Generate an AI-enhanced broadcast message using Vertex AI (Gemini)
 */
export async function generateAIBroadcast(
  draft: string,
  gymName: string,
  vibeIndex: number = 0,
  intent: string = 'all'
): Promise<{ success: boolean; message?: string; vibeUsed?: number; totalVibes?: number; error?: string }> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const aiFn = httpsCallable(functions, 'generateAIBroadcast');
    const result = await aiFn({ draft, gymName, vibeIndex, intent });
    return result.data as { success: boolean; message: string; vibeUsed: number; totalVibes: number };
  } catch (err: any) {
    console.error('[PingFlow][whatsapp.service] AI broadcast failed:', err);
    return { success: false, error: err.message || 'AI generation failed' };
  }
}
