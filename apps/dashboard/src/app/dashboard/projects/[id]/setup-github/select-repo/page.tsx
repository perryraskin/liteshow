'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Github, Lock, Unlock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

function SelectRepoContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  useEffect(() => {
    const fetchRepositories = async () => {
      if (!installationId) {
        setError('Installation ID is missing. Please try installing the GitHub App again.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/github-app/installations/${installationId}/repos`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch repositories');
        }

        const data = await response.json();
        setRepositories(data.repositories || []);
      } catch (err: any) {
        console.error('Error fetching repositories:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepositories();
  }, [installationId]);

  const handleLinkRepository = async () => {
    if (!selectedRepo || !installationId) return;

    setIsLinking(true);
    try {
      const token = localStorage.getItem('session_token');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/link-github`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            strategy: 'github-app',
            githubInstallationId: installationId,
            githubRepoId: selectedRepo.full_name,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link repository');
      }

      toast.success('Repository linked successfully!');
      router.push(`/dashboard/projects/${params.id}`);
    } catch (err: any) {
      console.error('Error linking repository:', err);
      toast.error(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading repositories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Select Repository</h1>
          <p className="text-muted-foreground">
            Choose which repository to connect to this LiteShow project.
          </p>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-destructive">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-destructive">{error}</p>
                  {error.includes('not configured') && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Please ask your administrator to set up the GitHub App following the instructions in <code className="text-xs">docs/GITHUB_APP_SETUP.md</code>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!error && repositories.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No repositories available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The LiteShow GitHub App doesn't have access to any repositories yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Go to GitHub and grant the app access to your repositories, then refresh this page.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </CardContent>
          </Card>
        )}

        {!error && repositories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Repositories</CardTitle>
              <CardDescription>
                Select a repository to connect to this project. LiteShow will push content changes to this repository.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {repositories.map((repo) => (
                <Card
                  key={repo.id}
                  className={`cursor-pointer transition-all ${
                    selectedRepo?.id === repo.id
                      ? 'border-primary ring-2 ring-primary'
                      : 'hover:border-muted-foreground'
                  }`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {repo.private ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Unlock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{repo.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {repo.private ? 'Private' : 'Public'} repository
                        </p>
                      </div>
                    </div>
                    {selectedRepo?.id === repo.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button
                onClick={handleLinkRepository}
                disabled={!selectedRepo || isLinking}
                className="w-full mt-4"
              >
                {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLinking ? 'Linking...' : 'Link Repository'}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-2">
                Don't see your repository?{' '}
                <a
                  href={`https://github.com/settings/installations`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Configure GitHub App access
                </a>
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function SelectRepoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <SelectRepoContent />
    </Suspense>
  );
}
