package tui

// UIConfig holds all visual configuration for the minimal interface
type UIConfig struct {
	// Input styling
	InputHasBorder   bool    `json:"input_has_border"`
	InputBorderColor string  `json:"input_border_color"`
	InputMargin      float64 `json:"input_margin"` // L/R margin as ratio of terminal width
	
	// Feedback area
	FeedbackHeight int `json:"feedback_height"`
	
	// Output scrolling
	MaxOutputLines    int  `json:"max_output_lines"`    // Maximum lines visible in output area
	OutputLinesKept   int  `json:"output_lines_kept"`   // Total lines kept in memory
	ScrollIndicators  bool `json:"scroll_indicators"`   // Show scroll position indicators
	
	// Colors (using lipgloss color names/numbers)
	FeedbackColor    string `json:"feedback_color"`
	OutputTextColor  string `json:"output_text_color"`
	ScrollIndicColor string `json:"scroll_indic_color"`
}

// DefaultUIConfig returns default configuration
func DefaultUIConfig() UIConfig {
	return UIConfig{
		InputHasBorder:    true,   // Enable borders by default
		InputBorderColor:  "240",  // Subtle gray
		InputMargin:       0.02,   // Small margin (2% of width on each side)
		
		FeedbackHeight:    1,     // Single line feedback
		
		MaxOutputLines:    20,    // 20 lines of output visible
		OutputLinesKept:   200,   // Keep 200 lines in memory
		ScrollIndicators:  true,  // Show scroll indicators
		
		FeedbackColor:     "243", // Muted gray
		OutputTextColor:   "15",  // White
		ScrollIndicColor:  "240", // Subtle gray
	}
}

// GetInputWidth calculates the usable width for input based on margins
func (ui *UIConfig) GetInputWidth(terminalWidth int) int {
	marginPixels := int(float64(terminalWidth) * ui.InputMargin)
	usableWidth := terminalWidth - (2 * marginPixels)
	
	// Ensure minimum width
	if usableWidth < 10 {
		usableWidth = 10
	}
	
	return usableWidth
}

// GetInputLeftMargin calculates the left margin in characters
func (ui *UIConfig) GetInputLeftMargin(terminalWidth int) int {
	return int(float64(terminalWidth) * ui.InputMargin)
}