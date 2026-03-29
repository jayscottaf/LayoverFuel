import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncQueue, getPendingCount } from '@/lib/offline-queue';
import { useToast } from '@/hooks/use-toast';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('[OFFLINE] Failed to get pending count:', error);
    }
  }, []);

  // Sync queue and refresh data
  const performSync = useCallback(async () => {
    if (syncStatus === 'syncing') return; // Already syncing

    try {
      setSyncStatus('syncing');
      console.log('[OFFLINE] Starting sync...');

      const result = await syncQueue();

      if (result.failed > 0) {
        setSyncStatus('error');
        toast({
          title: 'Partial Sync',
          description: `${result.success} logs synced, ${result.failed} failed`,
          variant: 'destructive',
        });
      } else if (result.success > 0) {
        setSyncStatus('success');
        toast({
          title: 'Synced!',
          description: `${result.success} log${result.success > 1 ? 's' : ''} synced successfully`,
        });

        // Invalidate dashboard to show updated data
        await queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      }

      // Refresh pending count
      await refreshPendingCount();

      // Reset sync status after a delay
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('[OFFLINE] Sync error:', error);
      setSyncStatus('error');
      toast({
        title: 'Sync Failed',
        description: 'Could not sync offline logs. Will retry later.',
        variant: 'destructive',
      });

      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [syncStatus, queryClient, toast, refreshPendingCount]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[OFFLINE] Connection restored');
      setIsOnline(true);

      // Auto-sync when coming back online
      performSync();
    };

    const handleOffline = () => {
      console.log('[OFFLINE] Connection lost');
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial pending count check
    refreshPendingCount();

    // Periodic check for pending items (every 30 seconds)
    const interval = setInterval(refreshPendingCount, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [performSync, refreshPendingCount]);

  return {
    isOnline,
    isOffline: !isOnline,
    pendingCount,
    syncStatus,
    manualSync: performSync,
    refreshPendingCount,
  };
}
