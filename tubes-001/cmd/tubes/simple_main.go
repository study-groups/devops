package main

import (
	"fmt"
	"log"
	"os"
)

func main() {
	f, err := os.OpenFile("tubes.log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer f.Close()
	log.SetOutput(f)

	log.Println("Tubes starting up...")
	fmt.Println("Tubes TUI - Clean Build Version")
	fmt.Println("This is a minimal working version while the UI architecture is being reorganized.")
}