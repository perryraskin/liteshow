'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
}

function DashboardContent() {
  const [session, setSession] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for session token in URL (from OAuth callback)
    const sessionToken = searchParams.get('session');
    if (sessionToken) {
      // Store in localStorage
      localStorage.setItem('session_token', sessionToken);
      // Remove from URL
      router.replace('/dashboard');
      return;
    }

    // Get stored session token
    const storedToken = localStorage.getItem('session_token');

    if (!storedToken) {
      router.push('/login');
      return;
    }

    // Check session via API with token
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${storedToken}`,
      },
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setSession(data);
          // Fetch projects
          return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });
        } else {
          localStorage.removeItem('session_token');
          router.push('/login');
        }
      })
      .then((res) => {
        if (res) return res.json();
      })
      .then((projectsData) => {
        if (projectsData) {
          setProjects(projectsData);
        }
      })
      .catch(() => {
        localStorage.removeItem('session_token');
        router.push('/login');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router, searchParams]);

  const handleSignOut = async () => {
    localStorage.removeItem('session_token');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold">LiteShow</h1>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Projects</h2>
              <p className="text-muted-foreground">Manage your LiteShow sites</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-6 bg-muted rounded w-3/4"></div>
                    <div className="h-5 w-16 bg-muted rounded-full"></div>
                  </div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">LiteShow</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {session.user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Projects</h2>
            <p className="text-muted-foreground">
              Manage your LiteShow sites
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/projects/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CardDescription className="mb-4 text-center">
                No projects yet. Create your first project to get started!
              </CardDescription>
              <Button onClick={() => router.push('/dashboard/projects/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <Badge variant={project.isPublished ? "default" : "secondary"}>
                      {project.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    /{project.slug}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
