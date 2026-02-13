'use client';

import { ActiveCheckList, ActiveCheckListItem } from './active-check-list';
import type { ClubSetupStep } from '@/hooks/use-club-setup-status';

type ClubSetupChecklistProps = {
  steps: ClubSetupStep[];
};

export function ClubSetupChecklist({ steps }: ClubSetupChecklistProps) {
  return (
    <ActiveCheckList>
      {steps.map((step) => (
        <ActiveCheckListItem key={step.id} active={step.active} status={step.status}>
          <div>
            <div className="font-medium">{step.label}</div>
            <div className="text-xs text-muted-foreground">{step.hint}</div>
          </div>
        </ActiveCheckListItem>
      ))}
    </ActiveCheckList>
  );
}
