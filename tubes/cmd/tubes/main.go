package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"tubes/internal/theme"
	"tubes/internal/tui"
)

func main() {
	// Check if we're in a proper TTY environment
	if !isTerminal() {
		runSimpleMode()
		return
	}

	// Setup logging
	logFile, err := os.OpenFile("tubes.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalln("Failed to open log file:", err)
	}
	defer logFile.Close()
	log.SetOutput(logFile)

	log.Println("Starting Tubes TUI mode...")

	// Create and initialize the TUI model
	model, err := tui.NewModel()
	if err != nil {
		log.Fatalf("Failed to create model: %v", err)
	}

	// Create Bubbletea program
	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
	)

	// Start the program
	if _, err := p.Run(); err != nil {
		log.Printf("TUI error: %v", err)
		fmt.Printf("TUI failed, falling back to simple mode...\n")
		runSimpleMode()
	}
}

func isTerminal() bool {
	// Check if stdin is a terminal and we have TTY access
	fileInfo, _ := os.Stdin.Stat()
	return (fileInfo.Mode()&os.ModeCharDevice) != 0
}

func runSimpleMode() {
	fmt.Println("=== Tubes Simple Mode ===")
	fmt.Println("(TUI not available in this environment)")
	fmt.Println()
	
	// Load theme
	t, err := theme.Load("monochrome")
	if err != nil {
		fmt.Printf("Warning: Could not load theme: %v\n", err)
	} else {
		fmt.Printf("Theme: %s\n", t.Name)
	}
	
	mode := "self"
	fmt.Printf("Mode: %s\n", mode)
	fmt.Println()
	fmt.Println("Available commands:")
	fmt.Println("  help     - Show this help")
	fmt.Println("  mode     - Toggle between self/tasks mode") 
	fmt.Println("  theme    - List themes")
	fmt.Println("  quit     - Exit")
	fmt.Println()
	
	scanner := bufio.NewScanner(os.Stdin)
	
	for {
		fmt.Print("tubes> ")
		if !scanner.Scan() {
			break
		}
		
		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			continue
		}
		
		parts := strings.Fields(input)
		cmd := parts[0]
		
		switch cmd {
		case "help":
			fmt.Println("Commands: help, mode, theme, quit")
			
		case "mode":
			if mode == "self" {
				mode = "tasks"
			} else {
				mode = "self"
			}
			fmt.Printf("Switched to %s mode\n", mode)
			
		case "theme":
			themes, err := theme.List()
			if err != nil {
				fmt.Printf("Error listing themes: %v\n", err)
			} else {
				fmt.Println("Available themes:", strings.Join(themes, ", "))
			}
			
		case "quit", "exit":
			fmt.Println("Goodbye!")
			return
			
		default:
			fmt.Printf("Unknown command: %s (try 'help')\n", cmd)
		}
	}
}