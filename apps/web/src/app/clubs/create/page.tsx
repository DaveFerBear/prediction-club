'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { useApi, useCreateClub } from '@/hooks';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

const slugifyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function CreateClubPage() {
  const router = useRouter();
  const { isAuthenticated } = useApi();
  const { connect, isPending: isConnecting } = useConnect();
  const { createClub, isCreating, error: createClubError } = useCreateClub();
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isPublic: true,
  });

  const slugPreview = useMemo(() => formData.slug || 'your-slug', [formData.slug]);

  const handleNameChange = (value: string) => {
    if (slugTouched) {
      setFormData({ ...formData, name: value });
      return;
    }
    const nextSlug = slugifyName(value);
    setFormData({ ...formData, name: value, slug: nextSlug });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      connect({ connector: injected() });
      return;
    }

    setError(null);

    try {
      const response = await createClub({
        name: formData.name,
        slug: formData.slug || undefined,
        description: formData.description || undefined,
        isPublic: formData.isPublic,
      });

      if (response.success) {
        router.push(`/clubs/${response.data?.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club');
    }
  };

  const createError = createClubError ? createClubError.message : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create a Club</h1>
          <p className="text-muted-foreground">
            Set up a new prediction club powered by Polymarket.
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Club Details</CardTitle>
            <CardDescription>Tell us about your club to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Club Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Signal Room"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setFormData({ ...formData, slug: e.target.value });
                  }}
                  placeholder="signal-room"
                />
                <p className="text-xs text-muted-foreground">Your club URL: /clubs/{slugPreview}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What's your club about?"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isPublic" className="text-sm">
                  Make this club public (visible to everyone)
                </label>
              </div>

              {(error || createError) && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error || createError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!formData.name.trim() || isCreating || isConnecting}
                >
                  {isCreating ? 'Creating...' : 'Create Club'}
                </Button>
              </div>

              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground text-center">
                  Connect your wallet to create a club.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
