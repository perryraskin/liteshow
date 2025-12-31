'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');
    const state = searchParams.get('state');

    if (!installationId) {
      console.error('No installation_id received from GitHub');
      router.push('/dashboard');
      return;
    }

    // Parse state to get project ID
    let projectId: string | undefined;
    if (state) {
      try {
        const stateData = JSON.parse(state);
        projectId = stateData.projectId;
      } catch (err) {
        console.error('Failed to parse state:', err);
      }
    }

    if (!projectId) {
      console.error('No project ID in state');
      router.push('/dashboard');
      return;
    }

    // Redirect to repository selection page
    router.push(`/dashboard/projects/${projectId}/setup-github/select-repo?installation_id=${installationId}&setup_action=${setupAction || 'install'}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Processing GitHub App installation...</p>
      </div>
    </div>
  );
}

export default function GitHubAppCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
