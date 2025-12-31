'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Zap, GitBranch, CheckCircle2 } from 'lucide-react';

export default function SetupGitHubPage() {
  const router = useRouter();
  const params = useParams();
  const [selectedOption, setSelectedOption] = useState<'create-now' | 'github-app'>('create-now');
  const [repoVisibility, setRepoVisibility] = useState<'public' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('session_token');

      if (selectedOption === 'create-now') {
        // Request OAuth scopes and create repo
        const requiredScope = repoVisibility === 'private' ? 'repo' : 'public_repo';
        router.push(`/auth/github/request-scope?scope=${requiredScope}&redirect=/dashboard/projects/${params.id}/setup-github/create?visibility=${repoVisibility}`);
      } else {
        // GitHub App flow - redirect to GitHub to install the app
        const githubAppName = 'liteshow-io-dev';
        const installUrl = `https://github.com/apps/${githubAppName}/installations/new?state=${encodeURIComponent(JSON.stringify({ projectId: params.id }))}`;
        window.location.href = installUrl;
      }
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

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
          <h1 className="text-3xl font-bold mb-2">Setup GitHub Repository</h1>
          <p className="text-muted-foreground">
            Connect a GitHub repository to enable version control and deployment for your project.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 border border-destructive/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Choose Setup Method</CardTitle>
            <CardDescription>
              Select how you want to connect GitHub to this project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create Now Option */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedOption === 'create-now'
                  ? 'border-primary ring-2 ring-primary'
                  : 'hover:border-muted-foreground'
              }`}
              onClick={() => setSelectedOption('create-now')}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Create GitHub Repo Now</CardTitle>
                      <CardDescription className="mt-1">
                        LiteShow creates and links the repository for you
                      </CardDescription>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={selectedOption === 'create-now'}
                    onChange={() => setSelectedOption('create-now')}
                    className="mt-1"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    <span>Automatic repository creation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    <span>Choose public or private</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    <span>Quick setup, ready to deploy</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* GitHub App Option */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedOption === 'github-app'
                  ? 'border-primary ring-2 ring-primary'
                  : 'hover:border-muted-foreground'
              }`}
              onClick={() => setSelectedOption('github-app')}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Connect with GitHub App</CardTitle>
                      <CardDescription className="mt-1">
                        Connect an existing repository with fine-grained access
                      </CardDescription>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={selectedOption === 'github-app'}
                    onChange={() => setSelectedOption('github-app')}
                    className="mt-1"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    <span>Use existing repository</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    <span>Works with organizations</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                    <span>Fine-grained access control</span>
                  </li>
                </ul>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>GitHub App:</strong> Install the LiteShow GitHub App and select which specific repositories to connect. You maintain full control over repository access.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Repository Visibility - Only when creating now */}
            {selectedOption === 'create-now' && (
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <h3 className="text-sm font-medium mb-3">Repository Visibility</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    LiteShow will create the GitHub repository for you.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Public Option */}
                  <Card
                    className={`cursor-pointer transition-all ${
                      repoVisibility === 'public'
                        ? 'border-primary ring-2 ring-primary'
                        : 'hover:border-muted-foreground'
                    }`}
                    onClick={() => setRepoVisibility('public')}
                  >
                    <CardContent className="pt-6 pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="radio"
                          checked={repoVisibility === 'public'}
                          onChange={() => setRepoVisibility('public')}
                        />
                        <div>
                          <p className="font-medium">Public</p>
                          <p className="text-xs text-muted-foreground">Free, visible to everyone</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Private Option */}
                  <Card
                    className={`cursor-pointer transition-all ${
                      repoVisibility === 'private'
                        ? 'border-primary ring-2 ring-primary'
                        : 'hover:border-muted-foreground'
                    }`}
                    onClick={() => setRepoVisibility('private')}
                  >
                    <CardContent className="pt-6 pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="radio"
                          checked={repoVisibility === 'private'}
                          onChange={() => setRepoVisibility('private')}
                        />
                        <div>
                          <p className="font-medium">Private</p>
                          <p className="text-xs text-muted-foreground">Only you can see</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <Button
              onClick={handleSetup}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Setting up...' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
