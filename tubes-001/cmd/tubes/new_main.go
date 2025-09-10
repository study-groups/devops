package main

import (
	"flag"
	"log"
	"os"

	"tubes/internal/tui"
)

func main() {
	f, err := os.OpenFile("tubes_new.log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer f.Close()
	log.SetOutput(f)

	port := flag.String("port", "8080", "Port for the API server")
	flag.Parse()

	// Create and run the new Tubes model
	model := tui.NewTubesModel(*port)
	
	log.Printf("Starting Tubes with new architecture on port %s", *port)
	
	if err := model.Run(); err != nil {
		log.Fatalf("Error running Tubes: %v", err)
	}
}