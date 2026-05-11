// PingFlow — Plan Guard
// Wraps Pro-only content; renders children if access granted, UpgradeModal if denied

import React, { useState } from 'react';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from '@/components/ui/UpgradeModal';
import type { FeatureName } from '@/config/planConfig';

interface PlanGuardProps {
  feature: FeatureName;
  children: React.ReactNode;
}

export default function PlanGuard({ feature, children }: PlanGuardProps) {
  const { canAccess } = usePlan();
  const [dismissed, setDismissed] = useState(false);

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  return (
    <UpgradeModal
      isOpen={!dismissed}
      onClose={() => setDismissed(true)}
      reason={feature}
    />
  );
}
