'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CreateRepoContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'creating' | 'success' | 'error'>('creating');
  const [error, setError] = useState('');

  useEffect(() => {
    const createRepo = async () => {
      try {
        const token = localStorage.getItem('session_token');
        const visibility = searchParams.get('visibility') || 'public';

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/link-github`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              strategy: 'create-now',
              repoVisibility: visibility,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create repository');
        }

        setStatus('success');
        // Redirect to project page after 2 seconds
        setTimeout(() => {
          router.push(`/dashboard/projects/${params.id}`);
        }, 2000);
      } catch (err: any) {
        console.error('Error creating repository:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    createRepo();
  }, [params.id, router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'creating' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
            {status === 'creating' && 'Creating Repository...'}
            {status === 'success' && 'Repository Created!'}
            {status === 'error' && 'Failed to Create Repository'}
          </CardTitle>
          <CardDescription>
            {status === 'creating' && 'Please wait while we set up your GitHub repository'}
            {status === 'success' && 'Your GitHub repository has been created and linked'}
            {status === 'error' && 'There was an error creating your repository'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'creating' && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• Creating GitHub repository</p>
              <p>• Setting up deployment files</p>
              <p>• Linking to your project</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Redirecting you back to your project...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                onClick={() => router.push(`/dashboard/projects/${params.id}`)}
                className="w-full"
              >
                Back to Project
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreateRepoPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <CreateRepoContent />
    </Suspense>
  );
}
