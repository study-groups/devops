package main

import (
	"flag"
	"log"
	"os"

	"tubes/internal/tui"
)

func main() {
	f, err := os.OpenFile("tubes_hybrid.log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer f.Close()
	log.SetOutput(f)

	port := flag.String("port", "8080", "Port for the API server")
	flag.Parse()

	// Create and run the hybrid model
	hybridModel := tui.NewHybridModel(*port)
	if err := hybridModel.Run(); err != nil {
		log.Fatalf("Error running Tubes Hybrid: %v", err)
	}
}