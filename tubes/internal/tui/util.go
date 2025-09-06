package tui

import "strings"

func joinLines(xs []string) string { return strings.Join(xs, "\n") }

func appendCapped(lines []string, s string, capN int) []string {
	lines = append(lines, s)
	if capN > 0 && len(lines) > capN {
		// drop oldest excess
		lines = lines[len(lines)-capN:]
	}
	return lines
}
