import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import apiService, { EPGNowPlaying, EPGStatus } from '@/services/api';

// Re-export types for convenience
export type { EPGNowPlaying, EPGProgram, EPGStatus } from '@/services/api';

// Map of channelId -> EPGNowPlaying for quick lookup
export type EPGDataMap = Map<string, EPGNowPlaying>;

// Cache duration in milliseconds (2 minutes - programs change infrequently)
const EPG_CACHE_DURATION = 2 * 60 * 1000;

// Batch size for EPG requests
const EPG_BATCH_SIZE = 50;

interface UseChannelEPGResult {
  epgData: EPGDataMap;
  epgStatus: EPGStatus | null;
  loading: boolean;
  error: string | null;
  fetchEPGForChannels: (channelIds: string[]) => Promise<void>;
  getProgram: (channelId: string) => EPGNowPlaying | undefined;
  isEnabled: boolean;
}

/**
 * Hook to fetch and manage EPG (Electronic Program Guide) data for live channels.
 *
 * Usage:
 * ```tsx
 * const { epgData, fetchEPGForChannels, getProgram, isEnabled } = useChannelEPG();
 *
 * // Fetch EPG for visible channels (uses tvgId)
 * useEffect(() => {
 *   const tvgIds = channels.filter(ch => ch.tvgId).map(ch => ch.tvgId!);
 *   fetchEPGForChannels(tvgIds);
 * }, [channels]);
 *
 * // Get program for a channel
 * const program = getProgram(channel.tvgId);
 * ```
 */
export const useChannelEPG = (): UseChannelEPGResult => {
  const [epgData, setEpgData] = useState<EPGDataMap>(new Map());
  const [epgStatus, setEpgStatus] = useState<EPGStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const pendingChannelsRef = useRef<Set<string>>(new Set());

  // Fetch EPG status on mount
  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const status = await apiService.getEPGStatus();
        if (!cancelled) {
          setEpgStatus(status);
          if (!status.enabled) {
            console.log('[useChannelEPG] EPG is disabled');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.log('[useChannelEPG] Failed to fetch EPG status:', err);
          // EPG might not be configured - that's OK
        }
      }
    };

    void fetchStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchEPGForChannels = useCallback(async (channelIds: string[]) => {
    // Filter out empty IDs and already-fetched channels (within cache window)
    const now = Date.now();
    const shouldRefetch = now - lastFetchTimeRef.current > EPG_CACHE_DURATION;

    // Dedupe and filter
    const uniqueIds = [...new Set(channelIds.filter((id) => id && id.trim()))];

    if (uniqueIds.length === 0) {
      return;
    }

    // If within cache window and we have data for all requested channels, skip fetch
    if (!shouldRefetch) {
      const missingIds = uniqueIds.filter((id) => !pendingChannelsRef.current.has(id));
      if (missingIds.length === 0) {
        return;
      }
    }

    // Track pending channels
    uniqueIds.forEach((id) => pendingChannelsRef.current.add(id));

    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      // Batch requests if many channels
      const batches: string[][] = [];
      for (let i = 0; i < uniqueIds.length; i += EPG_BATCH_SIZE) {
        batches.push(uniqueIds.slice(i, i + EPG_BATCH_SIZE));
      }

      const allResults: EPGNowPlaying[] = [];

      for (const batch of batches) {
        if (controller.signal.aborted) {
          return;
        }

        const results = await apiService.getEPGNowPlaying(batch, controller.signal);
        allResults.push(...results);
      }

      if (controller.signal.aborted) {
        return;
      }

      // Convert array to map
      const newMap = new Map<string, EPGNowPlaying>();
      for (const item of allResults) {
        if (item.channelId) {
          newMap.set(item.channelId, item);
        }
      }

      setEpgData(newMap);
      lastFetchTimeRef.current = Date.now();
      console.log('[useChannelEPG] Fetched EPG data for', newMap.size, 'channels');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      console.log('[useChannelEPG] Error fetching EPG:', err);
      setError((err as Error)?.message || 'Failed to load EPG data');
    } finally {
      setLoading(false);
    }
  }, []);

  const getProgram = useCallback(
    (channelId: string | undefined): EPGNowPlaying | undefined => {
      if (!channelId) {
        return undefined;
      }
      return epgData.get(channelId);
    },
    [epgData],
  );

  const isEnabled = useMemo(() => {
    return epgStatus?.enabled ?? false;
  }, [epgStatus?.enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    epgData,
    epgStatus,
    loading,
    error,
    fetchEPGForChannels,
    getProgram,
    isEnabled,
  };
};

/**
 * Calculate progress percentage for a program.
 * Returns a value between 0 and 100, or null if times are invalid.
 */
export function calculateProgramProgress(start: string, stop: string): number | null {
  const startTime = new Date(start).getTime();
  const stopTime = new Date(stop).getTime();
  const now = Date.now();

  if (isNaN(startTime) || isNaN(stopTime) || startTime >= stopTime) {
    return null;
  }

  if (now < startTime) {
    return 0;
  }

  if (now >= stopTime) {
    return 100;
  }

  const duration = stopTime - startTime;
  const elapsed = now - startTime;

  return Math.round((elapsed / duration) * 100);
}

/**
 * Calculate time remaining for a program in minutes.
 * Returns null if times are invalid or program has ended.
 */
export function calculateTimeRemaining(stop: string): number | null {
  const stopTime = new Date(stop).getTime();
  const now = Date.now();

  if (isNaN(stopTime) || now >= stopTime) {
    return null;
  }

  return Math.ceil((stopTime - now) / 60000);
}

/**
 * Format time remaining as a human-readable string.
 */
export function formatTimeRemaining(stop: string): string | null {
  const minutes = calculateTimeRemaining(stop);
  if (minutes === null) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes} min left`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h left`;
  }

  return `${hours}h ${remainingMinutes}m left`;
}
