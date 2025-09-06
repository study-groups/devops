package main

import (
	"log"
	"os"

	"github.com/rivo/tview"
)

func main() {
	config, err := LoadConfig("panels.toml")
	if err != nil {
		log.Fatalf("Error loading panels.toml: %v", err)
	}

	pwd, _ := os.Getwd()

	// Set up the Redux-style store and middleware.
	store := NewStore(pwd)
	commandMiddleware := NewCommandMiddleware(NewExecutor())
	store.AddMiddleware(commandMiddleware.Middleware)

	app := tview.NewApplication()

	// The TUI is now a subscriber to the store.
	tui := NewTUI(app, store, config)

	app.SetRoot(tui.GetRoot(), true).EnableMouse(false)

	// Start the TUI's subscription to store changes.
	tui.Subscribe()

	// Initial dispatch to render the UI.
	store.Dispatch(nil)

	if err := app.Run(); err != nil {
		log.Fatalf("Error running application: %v", err)
	}
}
