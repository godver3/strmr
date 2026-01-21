import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native';

// Lazy load expo-updates to avoid crash on builds without the native module
const getUpdates = (): typeof import('expo-updates') | null => {
  try {
    return require('expo-updates');
  } catch {
    return null;
  }
};

type UpdateState = 'checking' | 'downloading' | 'ready' | 'none' | 'error';

interface UpdateCheckerProps {
  children: React.ReactNode;
  /** Timeout in ms to wait for update check before proceeding (default: 5000) */
  timeout?: number;
  /** Enable simulation mode to test the update UI flow (dev only) */
  simulate?: boolean;
}

/**
 * Checks for OTA updates on app launch and shows an updating splash screen
 * while downloading. Automatically reloads the app when the update is ready.
 */
export function UpdateChecker({ children, timeout = 5000, simulate = false }: UpdateCheckerProps) {
  const [updateState, setUpdateState] = useState<UpdateState>('checking');
  const [progress, setProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [toastOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Simulation mode for testing the UI flow in development
    if (__DEV__ && simulate) {
      const runSimulation = async () => {
        setProgress('Checking for updates...');
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setUpdateState('downloading');
        setProgress('Downloading update...');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        setUpdateState('ready');
        setProgress('Restarting...');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // In simulation, just proceed to the app instead of reloading
        console.log('[Updates] Simulation complete - would reload here in production');
        setUpdateState('none');
      };
      runSimulation();
      return;
    }

    // Skip update check in development mode
    if (__DEV__) {
      setUpdateState('none');
      return;
    }

    // Skip if Updates module is not available (e.g., in Expo Go or builds without it)
    const Updates = getUpdates();
    if (!Updates?.checkForUpdateAsync) {
      setUpdateState('none');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const checkForUpdates = async () => {
      try {
        setProgress('Checking for updates...');

        // Set a timeout to proceed if update check takes too long
        timeoutId = setTimeout(() => {
          if (!cancelled && updateState === 'checking') {
            console.log('[Updates] Timeout reached, proceeding without update');
            setUpdateState('none');
          }
        }, timeout);

        const update = await Updates.checkForUpdateAsync();

        if (cancelled) return;

        if (update.isAvailable) {
          // Clear timeout since we found an update
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          setUpdateState('downloading');
          setProgress('Downloading update...');

          await Updates.fetchUpdateAsync();

          if (cancelled) return;

          setUpdateState('ready');
          setProgress('Restarting...');

          // Small delay to show the "Restarting..." message
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Reload the app to apply the update
          await Updates.reloadAsync();
        } else {
          // No update available, proceed with current version
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          setUpdateState('none');
        }
      } catch (error) {
        if (cancelled) return;

        console.log('[Updates] Error checking for updates:', error);
        // On error, show toast notification then proceed with current version
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Determine user-friendly error message
        const isNetworkError =
          error instanceof Error &&
          (error.message.includes('network') ||
            error.message.includes('Network') ||
            error.message.includes('fetch') ||
            error.message.includes('timeout') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ENOTFOUND'));

        setErrorMessage(
          isNetworkError
            ? 'Unable to check for updates - server unreachable'
            : 'Unable to check for updates',
        );
        setUpdateState('error');
      }
    };

    checkForUpdates();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeout, simulate]);

  // Handle error state: show toast, wait, then proceed to app
  useEffect(() => {
    if (updateState !== 'error') return;

    // Fade in the toast
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // After 8 seconds, fade out and proceed
    const timer = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setUpdateState('none');
      });
    }, 8000);

    return () => clearTimeout(timer);
  }, [updateState, toastOpacity]);

  // Show updating splash screen while checking/downloading
  if (updateState === 'checking' || updateState === 'downloading' || updateState === 'ready') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#3f66ff" style={styles.spinner} />
          <Text style={styles.title}>{updateState === 'ready' ? 'Restarting' : 'Updating'}</Text>
          <Text style={styles.progress}>{progress}</Text>
        </View>
      </View>
    );
  }

  // Error state: show children with toast overlay
  if (updateState === 'error') {
    return (
      <>
        {children}
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]} pointerEvents="none">
          <View style={styles.toast}>
            <View style={styles.toastIndicator} />
            <Text style={styles.toastMessage}>{errorMessage}</Text>
          </View>
        </Animated.View>
      </>
    );
  }

  // Update check complete, render children
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    marginBottom: 24,
    transform: [{ scale: Platform.isTV ? 1.5 : 1 }],
  },
  title: {
    fontSize: Platform.isTV ? 32 : 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  progress: {
    fontSize: Platform.isTV ? 18 : 14,
    color: '#888888',
    textAlign: 'center',
  },
  // Toast styles for error notifications
  toastContainer: {
    position: 'absolute',
    top: Platform.isTV ? 48 : 60,
    left: Platform.isTV ? 48 : 16,
    right: Platform.isTV ? 48 : 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#ff6b6b',
    borderRadius: Platform.isTV ? 16 : 12,
    paddingVertical: Platform.isTV ? 16 : 12,
    paddingHorizontal: Platform.isTV ? 20 : 16,
    maxWidth: Platform.isTV ? 600 : '100%',
    shadowColor: '#ff6b6b',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastIndicator: {
    width: Platform.isTV ? 6 : 4,
    alignSelf: 'stretch',
    backgroundColor: '#ff6b6b',
    borderRadius: 4,
    marginRight: Platform.isTV ? 16 : 12,
  },
  toastMessage: {
    flex: 1,
    color: '#ffffff',
    fontSize: Platform.isTV ? 20 : 15,
    fontWeight: '500',
  },
});
