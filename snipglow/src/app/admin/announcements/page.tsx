import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { getWalletRecipients } from './actions';
import { AnnouncementsClient } from './announcements-client';

// =============================================================================
// Admin — Announcements (feature emails)
// =============================================================================

export default async function AdminAnnouncementsPage() {
  const user = await requireAdmin();
  const { configured, missingEnv, recipients } = await getWalletRecipients();

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_announcements',
  });

  return <AnnouncementsClient configured={configured} missingEnv={missingEnv} recipients={recipients} />;
}
