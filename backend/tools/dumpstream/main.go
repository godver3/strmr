package main

import (
	"flag"
	"log"

	"novastream/config"
)

func main() {
	var (
		configPath = flag.String("config", "cache/settings.json", "Path to backend settings.json")
	)
	flag.Parse()

	mgr := config.NewManager(*configPath)
	_, err := mgr.Load()
	if err != nil {
		log.Fatalf("load settings: %v", err)
	}

	// Note: This tool has been deprecated as the streaming layer was refactored.
	// streaming.NewUsenetReaderFactory and streaming.NewMetadataProvider have been
	// moved to the streaming.old package. This tool needs a complete rewrite
	// to work with the new streaming architecture that uses NzbSystem for streaming.
	log.Fatalf("dumpstream tool is deprecated and needs updating for the new streaming architecture")
}
