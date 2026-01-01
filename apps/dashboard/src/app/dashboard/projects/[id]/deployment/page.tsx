'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Rocket, ExternalLink, Github, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  githubRepoUrl?: string;
  githubRepoName?: string;
  deploymentPlatform?: string;
  deploymentStatus?: string;
  deploymentUrl?: string;
  lastDeployedAt?: string;
  autoDeployOnSave: boolean;
}

interface Deployment {
  id: string;
  status: string;
  commitSha?: string;
  commitMessage?: string;
  deploymentUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export default function DeploymentPage() {
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('session_token');

      // Fetch project
      const projectRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (projectRes.ok) {
        const projectData = await projectRes.json();
        setProject(projectData);
      }

      // Fetch deployment history
      const deploymentsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/deployments`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (deploymentsRes.ok) {
        const deploymentsData = await deploymentsRes.json();
        setDeployments(deploymentsData);
      }
    } catch (error) {
      console.error('Error fetching deployment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableGitHubPages = async () => {
    setIsEnabling(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/deployment/enable`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to enable GitHub Pages');
      }

      toast.success('GitHub Pages enabled!', {
        description: 'Your site will be deployed on the next save.',
      });

      fetchData();
    } catch (error) {
      console.error('Error enabling GitHub Pages:', error);
      toast.error('Failed to enable GitHub Pages');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/deployment/deploy`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger deployment');
      }

      const data = await response.json();

      toast.success('Deployment started!', {
        description: 'Your site is being built. This usually takes 2-3 minutes.',
      });

      fetchData();
    } catch (error) {
      console.error('Error deploying:', error);
      toast.error('Failed to start deployment');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleToggleAutoDeploy = async (enabled: boolean) => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${params.id}/deployment/settings`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ autoDeployOnSave: enabled }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setProject((prev) => prev ? { ...prev, autoDeployOnSave: enabled } : null);

      toast.success(enabled ? 'Auto-deploy enabled' : 'Auto-deploy disabled');
    } catch (error) {
      console.error('Error updating auto-deploy:', error);
      toast.error('Failed to update settings');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Live</Badge>;
      case 'building':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Building</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Not Deployed</Badge>;
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!project?.githubRepoUrl) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Github className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            Connect a GitHub repository to enable deployment
          </p>
          <Button onClick={() => window.location.href = `/dashboard/projects/${params.id}/setup-github`}>
            <Github className="mr-2 h-4 w-4" />
            Setup GitHub
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deployment Status</CardTitle>
              <CardDescription>GitHub Pages deployment via GitHub Actions</CardDescription>
            </div>
            {getStatusBadge(project.deploymentStatus || 'not_deployed')}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.deploymentUrl && (
            <div>
              <Label className="text-sm font-medium">Live URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={project.deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {project.deploymentUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {project.lastDeployedAt && (
            <div>
              <Label className="text-sm font-medium">Last Deployed</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(project.lastDeployedAt).toLocaleString()}
              </p>
            </div>
          )}

          <div className="pt-4">
            <Button
              onClick={handleDeploy}
              disabled={isDeploying || project.deploymentStatus === 'building'}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Deploy Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Settings</CardTitle>
          <CardDescription>Configure how and when your site is deployed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-deploy on Save</Label>
              <p className="text-sm text-muted-foreground">
                Automatically deploy when you save content changes
              </p>
            </div>
            <Switch
              checked={project.autoDeployOnSave}
              onCheckedChange={handleToggleAutoDeploy}
            />
          </div>
        </CardContent>
      </Card>

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
          <CardDescription>Recent deployments to GitHub Pages</CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No deployments yet
            </p>
          ) : (
            <div className="space-y-3">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(deployment.status)}
                      {deployment.commitSha && (
                        <code className="text-xs text-muted-foreground">
                          {deployment.commitSha.substring(0, 7)}
                        </code>
                      )}
                    </div>
                    {deployment.commitMessage && (
                      <p className="text-sm">{deployment.commitMessage}</p>
                    )}
                    {deployment.errorMessage && (
                      <p className="text-sm text-destructive mt-1">
                        {deployment.errorMessage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(deployment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {deployment.deploymentUrl && (
                    <a
                      href={deployment.deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
