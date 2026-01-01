import { useState, useEffect, useCallback } from 'react';

export interface DeploymentStatus {
  status: 'live' | 'building' | 'failed' | 'not_deployed';
  url?: string;
  lastDeployedAt?: string;
  lastCommit?: string;
}

interface UseDeploymentStatusOptions {
  projectId: string;
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
}

/**
 * Hook to fetch and poll deployment status from the API
 *
 * @param options - Configuration options
 * @param options.projectId - The project ID to fetch status for
 * @param options.enabled - Whether to enable polling (default: true)
 * @param options.pollingInterval - How often to poll in ms (default: 10000 = 10s)
 *
 * @returns Deployment status and refresh function
 */
export function useDeploymentStatus({
  projectId,
  enabled = true,
  pollingInterval = 10000, // Poll every 10 seconds by default
}: UseDeploymentStatusOptions) {
  const [status, setStatus] = useState<DeploymentStatus>({
    status: 'not_deployed',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/deployment/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch deployment status');
      }

      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  // Set up polling
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = setInterval(fetchStatus, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollingInterval, fetchStatus]);

  // Manual refresh function
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}
