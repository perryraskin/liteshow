'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Github, Database, Rocket, Copy, ExternalLink, Trash2, AlertTriangle, Eye, EyeOff, Settings as SettingsIcon, RefreshCw, GitPullRequest, CheckCircle2, Loader2 } from 'lucide-react';
import { ActivityFeed } from '@/components/ActivityFeed';
import { DeploymentTab } from '@/components/DeploymentTab';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPrUrl, setSyncPrUrl] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'checking' | 'up-to-date' | 'needs-update' | 'pr-created' | 'pr-exists' | 'error' | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('session_token');

        // Fetch project details
        const projectResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!projectResponse.ok) {
          throw new Error('Failed to fetch project');
        }

        const projectData = await projectResponse.json();
        setProject(projectData);

        // Initialize site settings form
        setSiteTitle(projectData.siteTitle || '');
        setSiteDescription(projectData.siteDescription || '');
        setFaviconUrl(projectData.faviconUrl || '');

        // Fetch pages
        const pagesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/pages`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          setPages(pagesData);
        }

        // Auto-check template sync status if GitHub is connected
        if (projectData.githubRepoUrl) {
          checkAndSyncTemplate();
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/settings`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            siteTitle,
            siteDescription,
            faviconUrl,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const updatedProject = await response.json();
      setProject(updatedProject);

      toast.success('Settings saved!', {
        description: 'Your site will use these settings on the next build.',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to save settings', {
        description: 'Please try again or contact support if the issue persists.',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const checkAndSyncTemplate = async () => {
    setSyncStatus('checking');
    try {
      const token = localStorage.getItem('session_token');

      // First check if there's already a pending PR
      const statusResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/sync-template/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.hasPendingPR && status.prUrl) {
          setSyncPrUrl(status.prUrl);
          setSyncStatus('pr-exists');
          return;
        }
      }

      // No pending PR, run sync check and auto-create PR if needed
      const syncResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/sync-template`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await syncResponse.json();

      if (!syncResponse.ok) {
        console.error('Sync check error:', data);
        setSyncStatus('error');
        return;
      }

      if (data.upToDate) {
        setSyncStatus('up-to-date');
        return;
      }

      // Changes detected and PR created
      setSyncPrUrl(data.prUrl);
      setSyncStatus('pr-created');
      toast.success('Template updates available!', {
        description: `${data.filesChanged} files updated. A PR has been created for review.`,
        action: {
          label: 'View PR',
          onClick: () => window.open(data.prUrl, '_blank')
        },
        duration: 10000,
      });
    } catch (error: any) {
      console.error('Template sync check error:', error);
      setSyncStatus('error');
    }
  };

  const handleSyncTemplate = async () => {
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/sync-template`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (response.status === 409) {
        // Existing PR
        setSyncPrUrl(data.prUrl);
        toast.info('Template sync PR already exists', {
          description: 'Review the existing PR before creating a new one.',
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync template');
      }

      if (data.upToDate) {
        toast.success('Template is up to date!', {
          description: 'Your site is already using the latest template version.',
        });
        return;
      }

      setSyncPrUrl(data.prUrl);
      toast.success('Template sync PR created!', {
        description: `${data.filesChanged} files updated. Review and merge in GitHub.`,
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Failed to sync template', {
        description: error.message || 'Please try again or contact support.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmation !== project.name) {
      toast.error('Project name does not match', {
        description: `Please type "${project.name}" exactly to confirm deletion.`,
      });
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      const data = await response.json();

      toast.success('Project deleted successfully', {
        description: data.githubRepoUrl
          ? 'The GitHub repository still exists and must be deleted manually if desired.'
          : 'All project data has been removed from Liteshow.',
        action: data.githubRepoUrl ? {
          label: 'Open GitHub Repo',
          onClick: () => window.open(`${data.githubRepoUrl}/settings`, '_blank')
        } : undefined,
        duration: 10000,
      });

      // Redirect after a short delay to allow user to see the message
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project', {
        description: 'An error occurred while deleting the project. Please try again.',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" prefetch={true}>
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
          <p className="text-muted-foreground">{project.description || 'No description'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Project Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
                  <dd className="text-sm">/{project.slug}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                  <dd className="text-sm">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.githubRepoUrl ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">GitHub Repository</div>
                    <a
                      href={project.githubRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Github className="h-4 w-4" />
                      {project.githubRepoName || 'View Repository'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Template Sync Status */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Astro Template Status</div>

                    {syncStatus === 'checking' && (
                      <div className="p-3 bg-muted border rounded-md">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Checking for template updates...</span>
                        </div>
                      </div>
                    )}

                    {syncStatus === 'up-to-date' && (
                      <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm text-green-900 dark:text-green-100 font-medium">Template is up to date</span>
                        </div>
                      </div>
                    )}

                    {(syncStatus === 'pr-created' || syncStatus === 'pr-exists') && syncPrUrl && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                        <div className="flex items-start gap-2">
                          <GitPullRequest className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              {syncStatus === 'pr-created' ? 'Template updates available' : 'Template sync PR pending'}
                            </div>
                            <a
                              href={syncPrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              Review and merge in GitHub
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {syncStatus === 'error' && (
                      <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <span className="text-sm text-red-900 dark:text-red-100">Failed to check template status</span>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      This checks if your Astro site files (templates/components/config) are up to date with the latest Liteshow version. Your content is separate and not affected.
                    </p>

                    {syncStatus && syncStatus !== 'checking' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={checkAndSyncTemplate}
                        className="w-full mt-2"
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Check Again
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Github className="h-4 w-4" />
                    <span>No GitHub repository connected</span>
                  </div>
                  <Link href={`/dashboard/projects/${project.id}/setup-github`} prefetch={true}>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <Github className="mr-2 h-4 w-4" />
                      Setup GitHub
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
            <TabsTrigger value="development">Development</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Pages</CardTitle>
                      <CardDescription>
                        {pages.length} {pages.length === 1 ? 'page' : 'pages'} in this project
                      </CardDescription>
                    </div>
                    <Link href={`/dashboard/projects/${project.id}/pages`} prefetch={true}>
                      <Button>
                        Manage Pages
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {pages.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No pages yet</p>
                      <Link href={`/dashboard/projects/${project.id}/pages`} prefetch={true}>
                        <Button>
                          Create Your First Page
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pages.map((page: any) => (
                        <Link
                          key={page.id}
                          href={`/dashboard/projects/${project.id}/pages/${page.id}`}
                          prefetch={true}
                        >
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{page.title}</h3>
                                {page.status === 'draft' && (
                                  <Badge variant="secondary">
                                    draft
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">/{page.slug}</p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(page.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="lg:col-span-1">
                <ActivityFeed projectId={project.id} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deployment">
            <DeploymentTab project={project} />
          </TabsContent>

          <TabsContent value="development">
            <Card>
              <CardHeader>
                <CardTitle>Site Configuration</CardTitle>
                <CardDescription>
                  Use these credentials to run the Astro site locally
                </CardDescription>
              </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 font-mono text-sm break-all">
                  <div className="text-muted-foreground">TURSO_DB_URL</div>
                  <div className="mt-1">{project.tursoDbUrl}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-1 font-mono text-sm">
                  <div className="text-muted-foreground">TURSO_DB_TOKEN</div>
                  <div className={`mt-1 ${showToken ? 'break-all' : ''}`}>
                    {showToken ? project.tursoDbToken : '•••••••••••••••••••••••••••••••••••'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showToken ? 'Hide' : 'Show'} Token
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`TURSO_DB_URL=${project.tursoDbUrl}\nTURSO_DB_TOKEN=${project.tursoDbToken}`);
                    toast.success('Copied to clipboard!', {
                      description: 'Environment variables are ready to paste into your .env file.',
                    });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>
            </div>
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  <CardTitle>Site Settings</CardTitle>
                </div>
                <CardDescription>
                  Customize how your site appears with a custom title, description, and favicon
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="siteTitle">Site Title</Label>
                  <Input
                    id="siteTitle"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    placeholder={project.name}
                  />
                  <p className="text-sm text-muted-foreground">
                    This appears after page titles. Example: "Home - {siteTitle || project.name}"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteDescription">Site Description</Label>
                  <Textarea
                    id="siteDescription"
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder={`Welcome to ${project.name}`}
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    Used as the default meta description for SEO when pages don't have their own description
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">Favicon URL</Label>
                  <Input
                    id="faviconUrl"
                    type="url"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://example.com/favicon.png"
                  />
                  <p className="text-sm text-muted-foreground">
                    URL to your favicon image (PNG, ICO, or SVG). Leave empty to use the default.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Danger Zone */}
        <Card className="border-destructive mt-12">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Irreversible actions that will permanently delete your project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium mb-1">Delete this project</p>
                <p className="text-sm text-muted-foreground">
                  Once deleted, this project and all its content will be gone forever. This will delete the database and remove the project from Liteshow. You'll need to manually delete the GitHub repository if desired.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project{' '}
              <strong className="text-foreground">{project.name}</strong>, its Turso database, and all associated content from Liteshow. The GitHub repository will remain and must be deleted manually if desired.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-2">
              Type <strong>{project.name}</strong> to confirm:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={project.name}
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleteConfirmation !== project.name || isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
