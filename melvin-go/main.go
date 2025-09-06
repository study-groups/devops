package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/fatih/color"
)

// Command holds the details for a REPL command.
type Command struct {
	Name        string
	Description string
	Usage       string
	Handler     func(args []string)
}

// App holds the state of our application, including commands.
type App struct {
	Commands map[string]Command
}

// NewApp creates and initializes the MELVIN application.
func NewApp() *App {
	app := &App{
		Commands: make(map[string]Command),
	}
	app.registerCommands()
	return app
}

// registerCommands defines all the commands available in MELVIN.
func (a *App) registerCommands() {
	a.Commands["/help"] = Command{
		Name:        "/help",
		Description: "Displays help information for commands.",
		Usage:       "/help [command]",
		Handler:     a.handleHelp,
	}
	a.Commands["/youtube"] = Command{
		Name:        "/youtube",
		Description: "Generates a transcript from a YouTube video URL.",
		Usage:       "/youtube <url>",
		Handler:     a.handleYoutube,
	}
	a.Commands["/exit"] = Command{
		Name:        "/exit",
		Description: "Exits the MELVIN prompt.",
		Usage:       "/exit",
		Handler:     a.handleExit,
	}
	a.Commands["/clear"] = Command{
		Name:        "/clear",
		Description: "Clears the terminal screen.",
		Usage:       "/clear",
		Handler:     a.handleClear,
	}
}

// handleHelp provides contextual help for commands.
func (a *App) handleHelp(args []string) {
	cyan := color.New(color.FgCyan).SprintFunc()
	white := color.New(color.FgWhite).SprintFunc()
	yellow := color.New(color.FgYellow).SprintFunc()

	if len(args) == 0 {
		fmt.Printf("%s\n\n", yellow("MELVIN"))
		fmt.Printf("%s\n", white("Available commands:"))
		for _, cmd := range a.Commands {
			fmt.Printf("  %s - %s\n", cyan(cmd.Name), cmd.Description)
		}
		fmt.Printf("\n%s\n", white("Type /help [command] for more details."))
	} else {
		cmdName := "/" + args[0]
		cmd, ok := a.Commands[cmdName]
		if !ok {
			color.Red("Error: Unknown command '%s'", args[0])
			return
		}
		fmt.Printf("%s %s\n", yellow("Help for"), cyan(cmd.Name))
		fmt.Printf("  %s\n\n", cmd.Description)
		fmt.Printf("%s\n  %s\n", white("Usage:"), cmd.Usage)
	}
}

// handleYoutube is the placeholder for our youtube-flow.
func (a *App) handleYoutube(args []string) {
	if len(args) == 0 {
		color.Red("Usage: /youtube <url>")
		fmt.Println("Please provide a YouTube video URL.")
		return
	}
	url := args[0]
	color.Green("Fetching transcript for: %s", url)
	// --- Future Implementation ---
	// 1. Validate the URL.
	// 2. Use a library to fetch the video's transcript.
	//    (e.g., youtube-dl or a native Go library).
	// 3. Format and display the transcript.
	// ---------------------------
	fmt.Println(color.YellowString("\n[Placeholder: Transcript would be displayed here.]"))
}

// handleExit gracefully closes the application.
func (a *App) handleExit(args []string) {
	color.Yellow("MELVIN signing off. Goodbye!")
	os.Exit(0)
}

// handleClear clears the console screen.
func (a *App) handleClear(args []string) {
	fmt.Print("\033[H\033[2J")
}

// Run starts the REPL.
func (a *App) Run() {
	reader := bufio.NewScanner(os.Stdin)
	promptColor := color.New(color.FgMagenta).SprintFunc()
	logoColor := color.New(color.FgBlue, color.Bold).SprintFunc()

	fmt.Println(logoColor("MELVIN"))
	fmt.Println("Welcome! I am MELVIN. Type /help to see what I can do.")

	for {
		fmt.Printf("%s ", promptColor("MELVIN>"))
		if !reader.Scan() {
			break // Exit on EOF (Ctrl+D)
		}
		input := strings.TrimSpace(reader.Text())
		if input == "" {
			continue
		}

		parts := strings.Fields(input)
		cmdName := parts[0]
		args := parts[1:]

		if cmd, ok := a.Commands[cmdName]; ok {
			cmd.Handler(args)
		} else {
			if strings.HasPrefix(cmdName, "/") {
				color.Red("Error: Unknown command '%s'. Type /help for a list of commands.", cmdName)
			} else {
				// For now, non-command input gives a hint.
				// This could later be a channel for LLM input.
				fmt.Println(color.HiBlackString("Input received. To run a command, start with a '/'. (e.g., /help)"))
			}
		}
		fmt.Println() // Add a blank line for spacing
	}

	if err := reader.Err(); err != nil {
		fmt.Fprintln(os.Stderr, "Error reading input:", err)
	}
}

func main() {
	app := NewApp()
	app.Run()
}
