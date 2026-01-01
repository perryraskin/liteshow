'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { History, RotateCcw, AlertCircle } from 'lucide-react';

interface Version {
  id: string;
  pageId: string;
  versionNumber: number;
  snapshot: string; // JSON string
  createdBy: string;
  createdAt: string;
}

interface VersionHistoryProps {
  projectId: string;
  pageId: string;
  currentPageStatus?: {
    status: string;
    hasUnpublishedChanges: boolean;
    deployed?: boolean;
  };
  onRestore?: () => void;
}

export function VersionHistory({ projectId, pageId, currentPageStatus, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (showHistory) {
      fetchVersions();
    }
  }, [projectId, pageId, showHistory]);

  const fetchVersions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/pages/${pageId}/versions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }

      const data = await response.json();
      setVersions(data);
    } catch (err) {
      console.error('Error fetching versions:', err);
      setError('Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    if (!confirm(`Restore to version ${versionNumber}? This will create a new version before restoring.`)) {
      return;
    }

    try {
      setIsRestoring(true);
      setError(null);

      const token = localStorage.getItem('session_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/pages/${pageId}/versions/${versionNumber}/restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to restore version');
      }

      // Refresh versions list
      await fetchVersions();

      // Notify parent to refresh page data
      if (onRestore) {
        onRestore();
      }

      alert(`Successfully restored to version ${versionNumber}`);
    } catch (err) {
      console.error('Error restoring version:', err);
      setError('Failed to restore version');
    } finally {
      setIsRestoring(false);
    }
  };

  const getSnapshotPreview = (snapshot: string) => {
    try {
      const data = JSON.parse(snapshot);
      return {
        title: data.page?.title || 'Untitled',
        blockCount: data.blocks?.length || 0,
        status: data.page?.status || 'unknown',
        hasUnpublishedChanges: data.page?.hasUnpublishedChanges || false,
        deployed: data.page?.deployed || false,
      };
    } catch {
      return {
        title: 'Unknown',
        blockCount: 0,
        status: 'unknown',
        hasUnpublishedChanges: false,
        deployed: false,
      };
    }
  };

  if (!showHistory) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowHistory(true)}
        className="gap-2"
      >
        <History className="h-4 w-4" />
        Version History
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Version History</CardTitle>
              <CardDescription>
                {versions.length} {versions.length === 1 ? 'version' : 'versions'} saved
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading versions...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive py-4">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No versions yet</p>
              <p className="text-xs text-muted-foreground mt-2">
                Versions are created automatically when you update the page
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => {
                const preview = getSnapshotPreview(version.snapshot);
                const isCurrent = index === 0;

                // For current version, use live page status; for historical, use snapshot
                const displayStatus = isCurrent && currentPageStatus ? currentPageStatus.status : preview.status;
                const displayHasChanges = isCurrent && currentPageStatus
                  ? currentPageStatus.hasUnpublishedChanges
                  : preview.hasUnpublishedChanges;

                return (
                  <div
                    key={version.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Version {version.versionNumber}</span>
                        {isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                        {isCurrent && displayHasChanges && (
                          <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400">
                            Unsaved Changes
                          </Badge>
                        )}
                        {displayStatus === 'draft' && (
                          <Badge variant="outline" className="text-xs">
                            draft
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {preview.title} • {preview.blockCount} {preview.blockCount === 1 ? 'block' : 'blocks'}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version.versionNumber)}
                        disabled={isRestoring}
                        className="gap-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
