'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@prediction-club/ui';
import { ActiveCheckList, ActiveCheckListItem } from './active-check-list';
import type { ClubSetupStep } from '@/hooks/use-club-setup-status';

type ClubSetupChecklistProps = {
  steps: ClubSetupStep[];
};

export function ClubSetupChecklist({ steps }: ClubSetupChecklistProps) {
  return (
    <Accordion type="single" collapsible defaultValue="setup">
      <AccordionItem value="setup" className="border-b-0">
        <AccordionTrigger className="py-0 hover:no-underline">
          <div className="text-left">
            <div className="text-base font-semibold">Setup Checklist</div>
            <div className="text-xs text-muted-foreground">
              Progress from sign-in to autonomous execution readiness.
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
