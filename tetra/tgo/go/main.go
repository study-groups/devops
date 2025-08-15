package main

import (
	"bufio"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/rivo/tview"
)

const CommandPipe = "/tmp/rag-tui.pipe"

// Command defines the structure for API calls over the named pipe.
type Command struct {
	Action  string            `json:"action"`
	Payload map[string]string `json:"payload"`
}

func main() {
	// 1. Initialize the Core API Service
	pwd, _ := os.Getwd()
	core := NewCore(pwd)

	// 2. Initialize the TUI, passing the core service to it
	app := tview.NewApplication()
	tui := NewTUI(app, core)

	// Set the app root and handlers
	app.SetRoot(tui.GetRoot(), true).EnableMouse(false)
	tui.SetKeybinds()
	tui.UpdateStatus() // Initial status update

	// 3. Start the named pipe listener for external commands
	go startCommandListener(core, app)

	// 4. Graceful shutdown handling
	sigc := make(chan os.Signal, 1)
	signal.Notify(sigc, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigc
		os.Remove(CommandPipe) // Clean up the named pipe
		app.Stop()
	}()

	// Run the application
	if err := app.Run(); err != nil {
		log.Fatalf("Error running application: %v", err)
	}
}

// startCommandListener creates and listens on a named pipe for JSON commands.
func startCommandListener(core *Core, app *tview.Application) {
	// Ensure the pipe doesn't exist from a previous run
	_ = os.Remove(CommandPipe)

	if err := syscall.Mkfifo(CommandPipe, 0666); err != nil {
		log.Printf("Failed to create named pipe: %v", err)
		return
	}
	defer os.Remove(CommandPipe)

	log.Printf("Listening for commands on %s", CommandPipe)

	for {
		pipe, err := os.OpenFile(CommandPipe, os.O_RDONLY, 0666)
		if err != nil {
			log.Printf("Failed to open pipe for reading: %v", err)
			continue // Loop to retry opening
		}

		scanner := bufio.NewScanner(pipe)
		for scanner.Scan() {
			var cmd Command
			if err := json.Unmarshal(scanner.Bytes(), &cmd); err != nil {
				log.Printf("Error decoding command: %v", err)
				continue
			}

			// Execute command and refresh TUI
			app.QueueUpdateDraw(func() {
				executeCommand(core, &cmd)
			})
		}
		pipe.Close()
	}
}

// executeCommand routes the IPC command to the appropriate core function.
func executeCommand(core *Core, cmd *Command) {
	log.Printf("Executing command: %s", cmd.Action)
	switch cmd.Action {
	case "loadFile":
		if path, ok := cmd.Payload["path"]; ok {
			core.LoadFile(path)
		}
	case "saveFile":
		if content, ok := cmd.Payload["content"]; ok {
			core.SetEditorContent(content)
			core.SaveFile()
		}
	// Add more commands here for RAG, e.g., "add_to_index", "query"
	default:
		log.Printf("Unknown command received: %s", cmd.Action)
	}
}

