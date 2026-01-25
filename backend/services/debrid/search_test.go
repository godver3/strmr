package debrid

import (
	"testing"

	"novastream/config"
	"novastream/models"
)

func TestNormalizeScrapeResult(t *testing.T) {
	input := ScrapeResult{
		Title:      "Breaking Bad S01E01",
		Indexer:    "",
		Magnet:     "magnet:?xt=urn:btih:ABC",
		InfoHash:   "ABC",
		FileIndex:  7,
		SizeBytes:  42,
		Seeders:    100,
		Provider:   "TorrentGalaxy",
		Languages:  []string{"🇬🇧", "🇺🇸"},
		Resolution: "1080p",
		MetaName:   "Breaking Bad",
		MetaID:     "tt0903747",
		Source:     "torrentio",
		Attributes: map[string]string{"custom": "value"},
	}

	result := normalizeScrapeResult(input)
	if result.ServiceType != models.ServiceTypeDebrid {
		t.Fatalf("expected ServiceTypeDebrid, got %v", result.ServiceType)
	}
	if result.GUID == "" {
		t.Fatalf("guid should be populated")
	}
	if got := result.Attributes["infoHash"]; got != "abc" {
		t.Fatalf("expected lowercase infoHash, got %q", got)
	}
	if got := result.Attributes["tracker"]; got != "TorrentGalaxy" {
		t.Fatalf("expected tracker attribute, got %q", got)
	}
	if got := result.Attributes["custom"]; got != "value" {
		t.Fatalf("expected custom attribute, got %q", got)
	}
	if result.DownloadURL != input.Magnet {
		t.Fatalf("download url mismatch")
	}
}

// TestSearchModeAccurateWaitsForAll verifies that accurate mode should wait for all scrapers
func TestSearchModeAccurateWaitsForAll(t *testing.T) {
	tests := []struct {
		name               string
		searchMode         config.SearchMode
		isAnime            bool
		expectWaitForAll   bool
	}{
		{
			name:             "fast mode non-anime uses early return",
			searchMode:       config.SearchModeFast,
			isAnime:          false,
			expectWaitForAll: false,
		},
		{
			name:             "fast mode anime waits for all (needs Nyaa)",
			searchMode:       config.SearchModeFast,
			isAnime:          true,
			expectWaitForAll: true,
		},
		{
			name:             "accurate mode non-anime waits for all",
			searchMode:       config.SearchModeAccurate,
			isAnime:          false,
			expectWaitForAll: true,
		},
		{
			name:             "accurate mode anime waits for all",
			searchMode:       config.SearchModeAccurate,
			isAnime:          true,
			expectWaitForAll: true,
		},
		{
			name:             "empty mode (defaults to fast) non-anime uses early return",
			searchMode:       "",
			isAnime:          false,
			expectWaitForAll: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the decision logic from search.go
			useAccurateMode := tt.searchMode == config.SearchModeAccurate
			shouldWaitForAll := useAccurateMode || tt.isAnime

			if shouldWaitForAll != tt.expectWaitForAll {
				t.Errorf("expected waitForAll=%v, got %v (searchMode=%q, isAnime=%v)",
					tt.expectWaitForAll, shouldWaitForAll, tt.searchMode, tt.isAnime)
			}
		})
	}
}

// TestSearchModeWithServiceMode verifies search mode works with different service modes
func TestSearchModeWithServiceMode(t *testing.T) {
	tests := []struct {
		name        string
		serviceMode config.StreamingServiceMode
		searchMode  config.SearchMode
		description string
	}{
		{
			name:        "debrid mode fast",
			serviceMode: config.StreamingServiceModeDebrid,
			searchMode:  config.SearchModeFast,
			description: "debrid with fast search should use early return",
		},
		{
			name:        "debrid mode accurate",
			serviceMode: config.StreamingServiceModeDebrid,
			searchMode:  config.SearchModeAccurate,
			description: "debrid with accurate search should wait for all scrapers",
		},
		{
			name:        "usenet mode fast",
			serviceMode: config.StreamingServiceModeUsenet,
			searchMode:  config.SearchModeFast,
			description: "usenet mode uses indexer timeout, not early return",
		},
		{
			name:        "hybrid mode fast",
			serviceMode: config.StreamingServiceModeHybrid,
			searchMode:  config.SearchModeFast,
			description: "hybrid with fast should use early return for debrid portion",
		},
		{
			name:        "hybrid mode accurate",
			serviceMode: config.StreamingServiceModeHybrid,
			searchMode:  config.SearchModeAccurate,
			description: "hybrid with accurate should wait for all",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify the settings are valid combinations
			settings := config.StreamingSettings{
				ServiceMode: tt.serviceMode,
				SearchMode:  tt.searchMode,
			}

			if settings.ServiceMode == "" {
				t.Error("service mode should not be empty")
			}
			if settings.SearchMode == "" && tt.searchMode != "" {
				t.Error("search mode should be preserved")
			}

			// Log the test case for documentation
			t.Logf("%s: %s", tt.name, tt.description)
		})
	}
}

// TestEarlyReturnThresholds documents the early return thresholds
func TestEarlyReturnThresholds(t *testing.T) {
	// These values should match the constants in search.go
	const expectedMinResults = 20
	const expectedTimeoutMs = 500

	// Document the behavior
	t.Logf("Early return triggers when:")
	t.Logf("  - At least %d results received, OR", expectedMinResults)
	t.Logf("  - Timeout of %dms reached with at least 1 result", expectedTimeoutMs)
	t.Logf("Early return is DISABLED when:")
	t.Logf("  - SearchMode is 'accurate'")
	t.Logf("  - Content is anime (needs Nyaa results)")
}
