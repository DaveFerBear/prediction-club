'use client';

import type { ReactNode } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';
import { CopyableAddress } from '@/components/copyable-address';
import type { Application } from '@/hooks';

type AdminConsoleSectionProps = {
  applications: Application[];
  appsLoading: boolean;
  appsError?: Error;
  approvingId: string | null;
  onApprove: (applicationId: string) => void;
  settingsPanel: ReactNode;
};

export function AdminConsoleSection(props: AdminConsoleSectionProps) {
  const { applications, appsLoading, appsError, approvingId, onApprove, settingsPanel } = props;

  return (
    <section
      className="mt-10 rounded-2xl border p-5"
      style={{
        background: '#f8fafc',
        borderColor: 'var(--club-border-strong)',
      }}
    >
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[color:var(--club-text-primary)]">Admin Console</h2>
        <p className="text-sm text-[color:var(--club-text-secondary)]">
          Review member access and update club settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-[color:var(--club-border-soft)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Pending Applications</CardTitle>
            <CardDescription>Approve new members.</CardDescription>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <p className="text-sm text-muted-foreground">Loading applications...</p>
            ) : appsError ? (
              <p className="text-sm text-destructive">{appsError.message}</p>
            ) : applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending applications.</p>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="rounded-lg border border-[color:var(--club-border-soft)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-[color:var(--club-text-primary)]">
                          {app.user.email || (
                            <CopyableAddress address={app.user.walletAddress} variant="inline" />
                          )}
                        </p>
                        {app.user.email ? (
                          <CopyableAddress
                            address={app.user.walletAddress}
                            variant="compact"
                            className="text-muted-foreground"
                          />
                        ) : null}
                      </div>
                      <Badge variant="outline">{new Date(app.createdAt).toLocaleDateString()}</Badge>
                    </div>

                    {app.message ? (
                      <p className="mt-2 text-sm text-muted-foreground">&ldquo;{app.message}&rdquo;</p>
                    ) : null}

                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => onApprove(app.id)}
                        disabled={approvingId === app.id}
                      >
                        {approvingId === app.id ? 'Approving...' : 'Approve'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {settingsPanel}
      </div>
    </section>
  );
}
