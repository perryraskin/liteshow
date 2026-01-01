'use client';

import { CheckCircle2, XCircle, Loader2, Clock, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDeploymentStatus } from '@/hooks/useDeploymentStatus';

interface DeploymentStatusIndicatorProps {
  projectId: string;
  compact?: boolean;
}

/**
 * Small deployment status indicator for headers/sidebars
 * Shows live deployment status with real-time polling
 */
export function DeploymentStatusIndicator({ projectId, compact = false }: DeploymentStatusIndicatorProps) {
  const { status, isLoading } = useDeploymentStatus({
    projectId,
    enabled: true,
    pollingInterval: 15000, // Poll every 15 seconds
  });

  if (isLoading) {
    return null;
  }

  // Don't show indicator if never deployed
  if (status.status === 'not_deployed') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status.status) {
      case 'live':
        return {
          icon: CheckCircle2,
          text: compact ? 'Live' : 'Live',
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600',
        };
      case 'building':
        return {
          icon: Loader2,
          text: compact ? 'Building' : 'Building',
          variant: 'secondary' as const,
          className: 'animate-pulse',
          iconClassName: 'animate-spin',
        };
      case 'failed':
        return {
          icon: XCircle,
          text: compact ? 'Failed' : 'Failed',
          variant: 'destructive' as const,
          className: '',
        };
      default:
        return {
          icon: Clock,
          text: 'Unknown',
          variant: 'outline' as const,
          className: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // If live status with URL, make badge clickable
  if (status.status === 'live' && status.url) {
    return (
      <a
        href={status.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <Badge variant={config.variant} className={`${config.className} cursor-pointer transition-colors`}>
          <Icon className={`h-3 w-3 mr-1 ${config.iconClassName || ''}`} />
          {config.text}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Badge>
      </a>
    );
  }

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className={`h-3 w-3 mr-1 ${config.iconClassName || ''}`} />
      {config.text}
    </Badge>
  );
}
