package main

import (
	"fmt"
	"log"
	"os"

	"github.com/rivo/tview"
)

func main() {
	f, err := os.OpenFile("tubes.log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer f.Close()
	log.SetOutput(f)

	app := tview.NewApplication()
	
	// Create a simple text view
	textView := tview.NewTextView().
		SetDynamicColors(true).
		SetText("Welcome to Tubes TUI\n\nPress Ctrl+C to exit")
	
	textView.SetBorder(true).SetTitle("Tubes")
	
	// Add some content
	fmt.Fprintf(textView, "\nThis is the working Tubes TUI application.")
	
	if err := app.SetRoot(textView, true).Run(); err != nil {
		log.Fatalf("Error running app: %v", err)
	}
}