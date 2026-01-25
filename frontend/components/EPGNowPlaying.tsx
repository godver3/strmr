import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EPGNowPlaying as EPGNowPlayingData, EPGProgram } from '@/services/api';
import { useTheme } from '@/theme';

import { calculateProgramProgress, formatTimeRemaining } from '../hooks/useChannelEPG';

interface EPGProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

/**
 * Simple progress bar for showing program progress.
 */
export const EPGProgressBar = ({
  progress,
  height = 3,
  color,
  backgroundColor,
}: EPGProgressBarProps) => {
  const theme = useTheme();
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const barColor = color || theme.colors.accent.primary;
  const bgColor = backgroundColor || 'rgba(255, 255, 255, 0.2)';

  return (
    <View style={[styles.progressContainer, { height, backgroundColor: bgColor }]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clampedProgress}%`,
            backgroundColor: barColor,
          },
        ]}
      />
    </View>
  );
};

interface EPGProgramInfoProps {
  program: EPGProgram;
  showProgress?: boolean;
  showTimeRemaining?: boolean;
  compact?: boolean;
}

/**
 * Displays information about a single EPG program.
 */
export const EPGProgramInfo = ({
  program,
  showProgress = true,
  showTimeRemaining = true,
  compact = false,
}: EPGProgramInfoProps) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Update progress and time remaining every 30 seconds
  useEffect(() => {
    const updateState = () => {
      setProgress(calculateProgramProgress(program.start, program.stop));
      setTimeRemaining(formatTimeRemaining(program.stop));
    };

    updateState();
    const interval = setInterval(updateState, 30000);

    return () => clearInterval(interval);
  }, [program.start, program.stop]);

  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      <Text style={compact ? styles.compactTitle : styles.title} numberOfLines={1}>
        {program.title}
      </Text>
      {showProgress && progress !== null && (
        <EPGProgressBar progress={progress} height={compact ? 2 : 3} />
      )}
      {showTimeRemaining && timeRemaining && !compact && (
        <Text style={styles.timeRemaining}>{timeRemaining}</Text>
      )}
    </View>
  );
};

interface EPGNowPlayingDisplayProps {
  data: EPGNowPlayingData;
  showNext?: boolean;
  compact?: boolean;
}

/**
 * Displays current (and optionally next) program information.
 * Use this component in channel cards/lists.
 */
export const EPGNowPlayingDisplay = ({
  data,
  showNext = false,
  compact = false,
}: EPGNowPlayingDisplayProps) => {
  const hasCurrentProgram = !!data.current;
  const hasNextProgram = !!data.next;

  if (!hasCurrentProgram && !hasNextProgram) {
    return null;
  }

  return (
    <View style={compact ? styles.nowPlayingCompact : styles.nowPlaying}>
      {hasCurrentProgram && (
        <EPGProgramInfo
          program={data.current!}
          showProgress={true}
          showTimeRemaining={!compact}
          compact={compact}
        />
      )}
      {showNext && hasNextProgram && (
        <View style={styles.nextProgram}>
          <Text style={styles.nextLabel}>Next:</Text>
          <Text style={styles.nextTitle} numberOfLines={1}>
            {data.next!.title}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Minimal inline display for channel cards.
 * Shows just the current program title with a progress indicator.
 */
interface EPGInlineDisplayProps {
  data: EPGNowPlayingData | undefined;
  textColor?: string;
}

export const EPGInlineDisplay = ({ data, textColor = '#fff' }: EPGInlineDisplayProps) => {
  const [progress, setProgress] = useState<number | null>(null);

  const currentProgram = data?.current;

  // Update progress every 30 seconds
  useEffect(() => {
    if (!currentProgram) {
      setProgress(null);
      return;
    }

    const updateState = () => {
      setProgress(calculateProgramProgress(currentProgram.start, currentProgram.stop));
    };

    updateState();
    const interval = setInterval(updateState, 30000);

    return () => clearInterval(interval);
  }, [currentProgram]);

  if (!currentProgram) {
    return null;
  }

  return (
    <View style={styles.inlineContainer}>
      <Text style={[styles.inlineTitle, { color: textColor }]} numberOfLines={1}>
        {currentProgram.title}
      </Text>
      {progress !== null && (
        <EPGProgressBar progress={progress} height={2} color="rgba(139, 92, 246, 0.8)" />
      )}
    </View>
  );
};

/**
 * TV grid card EPG overlay - ultra minimal for grid cards.
 * Shows program title at the bottom of the card.
 */
interface EPGGridOverlayProps {
  data: EPGNowPlayingData | undefined;
}

export const EPGGridOverlay = ({ data }: EPGGridOverlayProps) => {
  const [progress, setProgress] = useState<number | null>(null);

  const currentProgram = data?.current;

  // Update progress every 30 seconds
  useEffect(() => {
    if (!currentProgram) {
      setProgress(null);
      return;
    }

    const updateProgress = () => {
      setProgress(calculateProgramProgress(currentProgram.start, currentProgram.stop));
    };

    updateProgress();
    const interval = setInterval(updateProgress, 30000);

    return () => clearInterval(interval);
  }, [currentProgram]);

  if (!currentProgram) {
    return null;
  }

  return (
    <View style={styles.gridOverlay}>
      <Text style={styles.gridTitle} numberOfLines={1}>
        {currentProgram.title}
      </Text>
      {progress !== null && (
        <View style={styles.gridProgressContainer}>
          <EPGProgressBar progress={progress} height={2} color="#8b5cf6" backgroundColor="rgba(255,255,255,0.15)" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Progress bar
  progressContainer: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Standard container
  container: {
    gap: 4,
  },
  compactContainer: {
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  compactTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  timeRemaining: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },

  // Now playing display
  nowPlaying: {
    gap: 6,
  },
  nowPlayingCompact: {
    gap: 3,
  },
  nextProgram: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  nextLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  nextTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    flex: 1,
  },

  // Inline display (for list cards)
  inlineContainer: {
    gap: 3,
    marginTop: 2,
  },
  inlineTitle: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.85,
  },

  // Grid overlay (for TV/tablet grid cards)
  gridOverlay: {
    gap: 3,
  },
  gridTitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '400',
  },
  gridProgressContainer: {
    marginTop: 2,
  },
});
