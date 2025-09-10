package tui

import (
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/glamour"
)

// MarkdownRenderer handles rendering markdown content with syntax highlighting
type MarkdownRenderer struct {
	renderer *glamour.TermRenderer
	width    int
}

// NewMarkdownRenderer creates a new markdown renderer with the specified width
func NewMarkdownRenderer(width int) (*MarkdownRenderer, error) {
	// Configure glamour with appropriate settings for TUI
	renderer, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(width-4), // Account for padding
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create markdown renderer: %w", err)
	}
	
	return &MarkdownRenderer{
		renderer: renderer,
		width:    width,
	}, nil
}

// RenderFile renders a markdown file and returns the formatted output
func (mr *MarkdownRenderer) RenderFile(filePath string) (string, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file %s: %w", filePath, err)
	}
	
	return mr.RenderString(string(content))
}

// RenderString renders markdown content from a string
func (mr *MarkdownRenderer) RenderString(content string) (string, error) {
	if mr.renderer == nil {
		return "", fmt.Errorf("markdown renderer not initialized")
	}
	
	rendered, err := mr.renderer.Render(content)
	if err != nil {
		return "", fmt.Errorf("failed to render markdown: %w", err)
	}
	
	return rendered, nil
}

// UpdateWidth updates the renderer width for responsive rendering
func (mr *MarkdownRenderer) UpdateWidth(width int) error {
	// Recreate renderer with new width
	renderer, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(width-4),
	)
	if err != nil {
		return fmt.Errorf("failed to update renderer width: %w", err)
	}
	
	mr.renderer = renderer
	mr.width = width
	return nil
}

// IsMarkdownFile checks if a file path has a markdown extension
func IsMarkdownFile(filePath string) bool {
	lower := strings.ToLower(filePath)
	return strings.HasSuffix(lower, ".md") || strings.HasSuffix(lower, ".markdown")
}

// RenderFileWithFallback attempts to render as markdown, falls back to plain text
func (mr *MarkdownRenderer) RenderFileWithFallback(filePath string) (string, bool) {
	// If it's not a markdown file, return plain text
	if !IsMarkdownFile(filePath) {
		if content, err := os.ReadFile(filePath); err == nil {
			return string(content), false
		}
		return fmt.Sprintf("Error reading file: %s", filePath), false
	}
	
	// Attempt markdown rendering
	if rendered, err := mr.RenderFile(filePath); err == nil {
		return rendered, true
	}
	
	// Fall back to plain text
	if content, err := os.ReadFile(filePath); err == nil {
		return string(content), false
	}
	
	return fmt.Sprintf("Error reading file: %s", filePath), false
}

// GetPreview generates a preview of markdown content (first few lines)
func (mr *MarkdownRenderer) GetPreview(content string, maxLines int) string {
	lines := strings.Split(content, "\n")
	
	previewLines := maxLines
	if len(lines) < previewLines {
		previewLines = len(lines)
	}
	
	preview := strings.Join(lines[:previewLines], "\n")
	
	// Try to render the preview
	if rendered, err := mr.RenderString(preview); err == nil {
		return rendered
	}
	
	// Fall back to plain text preview
	return preview
}

// ExtractTitle attempts to extract the title from markdown content
func ExtractTitle(content string) string {
	lines := strings.Split(content, "\n")
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		
		// Look for H1 headers
		if strings.HasPrefix(line, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "#"))
		}
		
		// Look for setext-style headers
		if len(lines) > 1 {
			for i, currentLine := range lines[:len(lines)-1] {
				nextLine := lines[i+1]
				if strings.TrimSpace(nextLine) != "" && 
				   (strings.HasPrefix(nextLine, "===") || strings.HasPrefix(nextLine, "---")) {
					return strings.TrimSpace(currentLine)
				}
			}
		}
	}
	
	// No title found
	return ""
}

// FormatCodeBlock formats a code block with syntax highlighting
func (mr *MarkdownRenderer) FormatCodeBlock(code, language string) (string, error) {
	// Create a markdown code block
	markdown := fmt.Sprintf("```%s\n%s\n```", language, code)
	
	return mr.RenderString(markdown)
}

// StripMarkdown removes markdown formatting and returns plain text
func StripMarkdown(content string) string {
	lines := strings.Split(content, "\n")
	var plainLines []string
	
	for _, line := range lines {
		// Remove headers
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			line = strings.TrimSpace(strings.TrimLeft(line, "#"))
		}
		
		// Remove emphasis markers (basic cleanup)
		line = strings.ReplaceAll(line, "**", "")
		line = strings.ReplaceAll(line, "*", "")
		line = strings.ReplaceAll(line, "__", "")
		line = strings.ReplaceAll(line, "_", "")
		line = strings.ReplaceAll(line, "`", "")
		
		plainLines = append(plainLines, line)
	}
	
	return strings.Join(plainLines, "\n")
}

// RenderWithHighlights renders markdown and highlights specific lines
func (mr *MarkdownRenderer) RenderWithHighlights(content string, highlightLines []int) (string, error) {
	// First render the content normally
	rendered, err := mr.RenderString(content)
	if err != nil {
		return "", err
	}
	
	// Split into lines for highlighting
	lines := strings.Split(rendered, "\n")
	
	// Apply highlights (simple approach - could be enhanced)
	for i, lineNum := range highlightLines {
		if lineNum > 0 && lineNum <= len(lines) {
			// Add highlight markers (could use ANSI colors)
			lines[lineNum-1] = "> " + lines[lineNum-1]
		}
		_ = i // Prevent unused variable error
	}
	
	return strings.Join(lines, "\n"), nil
}