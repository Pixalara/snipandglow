import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { getWalletRecipients, getCampaignHistory } from './actions';
import { AnnouncementsClient } from './announcements-client';

// =============================================================================
// Admin — Announcements (feature emails)
// =============================================================================

export default async function AdminAnnouncementsPage() {
  const user = await requireAdmin();
  const [{ configured, missingEnv, recipients }, history] = await Promise.all([
    getWalletRecipients(),
    getCampaignHistory(),
  ]);

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_announcements',
  });

  return <AnnouncementsClient configured={configured} missingEnv={missingEnv} recipients={recipients} history={history} />;
}
