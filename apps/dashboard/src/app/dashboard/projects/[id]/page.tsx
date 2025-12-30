'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Github, Database, Rocket, Copy, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { ActivityFeed } from '@/components/ActivityFeed';
import { toast } from 'sonner';
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

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('session_token');

        // Fetch project details
        const projectResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}`,
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

        // Fetch pages
        const pagesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}/pages`,
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
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const handleDeleteProject = async () => {
    if (deleteConfirmation !== project.name) {
      toast.error('Project name does not match');
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${params.id}`,
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

      toast.success('Project deleted from LiteShow', {
        description: 'Please manually delete the GitHub repository if needed',
        action: data.githubRepoUrl ? {
          label: 'Open GitHub',
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
      toast.error('Failed to delete project');
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
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <Badge variant={project.isPublished ? "default" : "secondary"}>
              {project.isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
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
            <CardContent className="space-y-3">
              <a
                href={project.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Github className="h-4 w-4" />
                View GitHub Repository
              </a>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                Turso Database: {project.tursoDbUrl}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Site Configuration</CardTitle>
            <CardDescription>
              Use these credentials to run the Astro site locally
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span>TURSO_DB_URL={project.tursoDbUrl}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(`TURSO_DB_URL=${project.tursoDbUrl}\nTURSO_DB_TOKEN=${project.tursoDbToken}`)}
                >
                  Copy
                </Button>
              </div>
              <div>TURSO_DB_TOKEN={project.tursoDbToken}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              <CardTitle>Deployment</CardTitle>
            </div>
            <CardDescription>
              Deploy your site to your preferred hosting platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Quick Deploy</p>
              <p className="text-sm text-muted-foreground mb-3">
                Click a button below to deploy your site. After connecting once, any content you publish will automatically trigger a rebuild.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://app.netlify.com/start/deploy?repository=${project.githubRepoUrl}#LITESHOW_PROJECT_SLUG=${project.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Deploy to Netlify
                  </Button>
                </a>
                <a
                  href={`https://vercel.com/new/clone?repository-url=${project.githubRepoUrl}&env=LITESHOW_PROJECT_SLUG&envDescription=Your%20project%20slug%20from%20LiteShow%20dashboard%3A%20${project.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Deploy to Vercel
                  </Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Netlify:</strong> Project slug auto-filled! Just click and deploy.<br />
                <strong>Vercel:</strong> Prompted to enter your project slug during setup (shown below).
              </p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Environment Variable</p>
              <p className="text-xs text-muted-foreground mb-3">
                Add this to your hosting platform's environment settings:
              </p>
              <div className="bg-muted p-3 rounded-md">
                <div className="flex items-start justify-between gap-2">
                  <code className="text-xs break-all">
                    LITESHOW_PROJECT_SLUG={project.slug}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(project.slug);
                      toast.success('Project slug copied to clipboard');
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                That's it! Your site will fetch content from the LiteShow API at build time. No database credentials needed.
              </p>
            </div>

            <div className="border-t pt-4">
              <a
                href={project.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                View full deployment instructions on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

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
                <Button onClick={() => router.push(`/dashboard/projects/${project.id}/pages`)}>
                  Manage Pages
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No pages yet</p>
                  <Button onClick={() => router.push(`/dashboard/projects/${project.id}/pages`)}>
                    Create Your First Page
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pages.map((page: any) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/dashboard/projects/${project.id}/pages/${page.id}`)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{page.title}</h3>
                          <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                            {page.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">/{page.slug}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(page.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-1">
            <ActivityFeed projectId={project.id} />
          </div>
        </div>

        {/* Danger Zone */}
        <Card className="border-destructive">
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
                  Once deleted, this project and all its content will be gone forever. This will delete the database and remove the project from LiteShow. You'll need to manually delete the GitHub repository if desired.
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
              <strong className="text-foreground">{project.name}</strong>, its Turso database, and all associated content from LiteShow. The GitHub repository will remain and must be deleted manually if desired.
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
