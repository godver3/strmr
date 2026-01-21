/**
 * Utility functions for the details screen
 */

export const formatFileSize = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) {
    return 'Unknown size';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export const formatPublishDate = (iso?: string) => {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const padNumber = (value: number) => value.toString().padStart(2, '0');

export const buildSeasonQuery = (title: string, seasonNumber: number) => {
  const trimmed = title.trim();
  if (!trimmed) {
    return '';
  }
  return `${trimmed} S${padNumber(seasonNumber)}`;
};

export const buildEpisodeQuery = (title: string, seasonNumber: number, episodeNumber: number) => {
  const base = buildSeasonQuery(title, seasonNumber);
  if (!base) {
    return '';
  }
  return `${base}E${padNumber(episodeNumber)}`;
};

export const episodesMatch = (a?: any, b?: any) => {
  if (!a || !b) {
    return false;
  }
  if (a.id && b.id) {
    return a.id === b.id;
  }
  return a.seasonNumber === b.seasonNumber && a.episodeNumber === b.episodeNumber;
};

export const getResultKey = (result: any) =>
  result.guid || result.downloadUrl || result.link || `${result.indexer}:${result.title}`;

/**
 * Check if an episode hasn't aired yet based on its air date.
 * Returns true if:
 * - The episode has no air date (assumed unreleased)
 * - The episode's air date is in the future
 */
export const isEpisodeUnreleased = (airedDate?: string): boolean => {
  if (!airedDate) {
    return true;
  }

  try {
    // Parse the date string (format: YYYY-MM-DD)
    const airDate = new Date(airedDate + 'T00:00:00');
    if (isNaN(airDate.getTime())) {
      return true; // Invalid date, assume unreleased
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare dates only, not times

    return airDate > today;
  } catch {
    return true; // Error parsing, assume unreleased
  }
};

/**
 * Format a user-friendly message for unreleased episodes when no search results are found.
 */
export const formatUnreleasedMessage = (episodeLabel: string, airedDate?: string): string => {
  if (!airedDate) {
    return `${episodeLabel} hasn't aired yet. No early results found.`;
  }

  try {
    const airDate = new Date(airedDate + 'T00:00:00');
    if (isNaN(airDate.getTime())) {
      return `${episodeLabel} hasn't aired yet. No early results found.`;
    }

    const formatted = airDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${episodeLabel} hasn't aired yet. No early results found. Airs ${formatted}.`;
  } catch {
    return `${episodeLabel} hasn't aired yet. No early results found.`;
  }
};

export const toStringParam = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
};
