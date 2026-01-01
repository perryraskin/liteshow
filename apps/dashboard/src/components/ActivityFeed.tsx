'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  source: string;
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    githubUsername: string;
    avatarUrl: string | null;
  };
}

interface ActivityFeedProps {
  projectId: string;
}

function formatActivityText(activity: Activity): string {
  const { action, entityType, metadata } = activity;

  switch (action) {
    case 'page_created':
      return `created page "${metadata?.title || 'Untitled'}"`;
    case 'page_updated':
      return `updated page "${metadata?.title || 'Untitled'}"`;
    case 'page_saved':
      return `saved page "${metadata?.title || 'Untitled'}"`;
    case 'page_deleted':
      return `deleted page "${metadata?.title || 'Untitled'}"`;
    case 'block_created':
      return `added ${metadata?.type} block to "${metadata?.pageTitle || 'page'}"`;
    case 'block_updated':
      return `updated ${metadata?.type} block in "${metadata?.pageTitle || 'page'}"`;
    case 'block_deleted':
      return `removed ${metadata?.type} block from "${metadata?.pageTitle || 'page'}"`;
    case 'block_reordered':
      return `reordered blocks in "${metadata?.pageTitle || 'page'}"`;
    case 'project_created':
      return `created project`;
    case 'git_sync':
      return `synced content to GitHub`;
    default:
      return `performed ${action} on ${entityType}`;
  }
}

function getActivityIcon(action: string): string {
  if (action.includes('created')) return '✨';
  if (action.includes('updated')) return '✏️';
  if (action.includes('deleted')) return '🗑️';
  if (action.includes('saved')) return '💾';
  if (action.includes('reordered')) return '🔄';
  if (action.includes('git_sync')) return '📦';
  return '📝';
}

function getSourceBadgeVariant(source: string): 'default' | 'secondary' | 'outline' {
  switch (source) {
    case 'ai':
      return 'default';
    case 'git_sync':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('session_token');
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/activity?limit=20`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch activities');
        }

        const data = await response.json();
        setActivities(data.activities);
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError('Failed to load activity feed');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [projectId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Recent changes to your project</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Recent changes to your project</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Recent changes to your project</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity yet. Start creating pages and blocks!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>Recent changes to your project</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-4 items-start">
              <Avatar className="h-8 w-8">
                <AvatarImage src={activity.user.avatarUrl || undefined} />
                <AvatarFallback>
                  {activity.user.name?.[0] || activity.user.githubUsername[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    <span className="font-medium">
                      {activity.user.name || activity.user.githubUsername}
                    </span>
                    {' '}
                    {getActivityIcon(activity.action)}
                    {' '}
                    {formatActivityText(activity)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                  {activity.source !== 'manual' && (
                    <Badge variant={getSourceBadgeVariant(activity.source)} className="text-xs">
                      {activity.source}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
