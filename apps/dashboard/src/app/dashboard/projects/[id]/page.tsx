'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Github, Database } from 'lucide-react';
import { ActivityFeed } from '@/components/ActivityFeed';

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      </main>
    </div>
  );
}
