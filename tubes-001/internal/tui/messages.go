package tui

// Periodic UI tick to drain queued logs without blocking input.
type tickMsg struct{}

// Structured log entry from background goroutines.
type logTarget int

const (
	logToLeft logTarget = iota
	logToRight
)

type logEntry struct {
	target  logTarget
	content string
}

// serverLogMsg/mainLogMsg kept for compatibility, but no longer used by server.go.
// They are still handled in view.go to avoid breaking external senders.
type serverLogMsg struct{ content string }
type mainLogMsg struct{ content string }
