package main

import (
	"fmt"
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"tubes/internal/tui"
)

func main() {
	// Setup logging
	logFile, err := os.OpenFile("tubes.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalln("Failed to open log file:", err)
	}
	defer logFile.Close()
	log.SetOutput(logFile)

	// Create and initialize the TUI model
	model, err := tui.NewModel()
	if err != nil {
		log.Fatalf("Failed to create model: %v", err)
	}

	// Create Bubbletea program with options
	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
		tea.WithOutput(os.Stderr),
	)

	// Start the program
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error running program: %v\n", err)
		os.Exit(1)
	}
}