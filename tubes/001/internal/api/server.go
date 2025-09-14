package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	
	"tubes/internal/codeintel"
	"tubes/internal/theme"
)

// Server provides HTTP API endpoints
type Server struct {
	httpServer *http.Server
	cursors    *codeintel.CursorDirectory
	styles     *theme.Styles
	port       string
}

// CommandRequest represents an incoming command request
type CommandRequest struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
}

// CommandResponse represents the response to a command
type CommandResponse struct {
	Ok     bool        `json:"ok"`
	Stdout string      `json:"stdout"`
	Stderr string      `json:"stderr"`
	Data   interface{} `json:"data"`
}

// NewServer creates a new API server
func NewServer(port string, cursors *codeintel.CursorDirectory) *Server {
	return &Server{
		cursors: cursors,
		styles:  theme.NewDefaultStyles(),
		port:    port,
	}
}

// GetPort returns the server port
func (s *Server) GetPort() string {
	return s.port
}

// Start starts the HTTP server
func (s *Server) Start() error {
	mux := http.NewServeMux()
	
	// API routes
	mux.HandleFunc("/api/command", s.handleCommand)
	mux.HandleFunc("/api/cursors", s.handleCursors)
	mux.HandleFunc("/api/multicursors", s.handleMultiCursors)
	mux.HandleFunc("/api/theme", s.handleTheme)
	mux.HandleFunc("/api/ui", s.handleUI)
	mux.HandleFunc("/api/status", s.handleStatus)
	
	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	
	// Root info
	mux.HandleFunc("/", s.handleRoot)
	
	s.httpServer = &http.Server{
		Addr:    ":" + s.port,
		Handler: s.corsMiddleware(s.logMiddleware(mux)),
	}
	
	log.Printf("API server starting on port %s", s.port)
	return s.httpServer.ListenAndServe()
}

// Stop stops the HTTP server
func (s *Server) Stop() error {
	if s.httpServer == nil {
		return nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	return s.httpServer.Shutdown(ctx)
}

// handleCommand processes command API requests
func (s *Server) handleCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req CommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	
	// Execute command
	result, err := s.executeCommand(req.Command, req.Args)
	
	response := CommandResponse{
		Ok:     err == nil,
		Stdout: result,
		Stderr: "",
		Data:   nil,
	}
	
	if err != nil {
		response.Stderr = err.Error()
	}
	
	s.respondJSON(w, response)
}

// handleCursors handles cursor API requests
func (s *Server) handleCursors(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Get all cursors in current multicursor
		mc := s.cursors.GetCurrentMultiCursor()
		if mc == nil {
			s.respondJSON(w, map[string]interface{}{
				"cursors": []interface{}{},
				"message": "No multicursor selected",
			})
			return
		}
		
		s.respondJSON(w, map[string]interface{}{
			"cursors":     mc.Cursors,
			"multicursor": mc.ID,
			"title":       mc.Title,
		})
		
	case http.MethodPost:
		// Create new cursor
		var cursor struct {
			FilePath  string `json:"file_path"`
			StartLine int    `json:"start_line"`
			EndLine   int    `json:"end_line"`
			Content   string `json:"content"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&cursor); err != nil {
			s.respondError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		
		newCursor := s.cursors.NewCursor(cursor.FilePath, cursor.StartLine, cursor.EndLine, cursor.Content)
		
		// Add to first available multicursor
		for mcID := range s.cursors.MultiCursors {
			s.cursors.AddCursorToMC(mcID, newCursor)
			s.respondJSON(w, map[string]interface{}{
				"cursor":      newCursor,
				"multicursor": mcID,
			})
			return
		}
		
		s.respondError(w, "No multicursor available", http.StatusBadRequest)
		
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleMultiCursors handles multicursor API requests
func (s *Server) handleMultiCursors(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Get all multicursors
		var multicursors []interface{}
		for id, mc := range s.cursors.MultiCursors {
			multicursors = append(multicursors, map[string]interface{}{
				"id":          id,
				"title":       mc.Title,
				"description": mc.Description,
				"cursor_count": len(mc.Cursors),
				"expanded":    mc.Expanded,
				"tags":        mc.Tags,
			})
		}
		
		s.respondJSON(w, map[string]interface{}{
			"multicursors": multicursors,
			"current":      s.cursors.CurrentMC,
		})
		
	case http.MethodPost:
		// Create new multicursor
		var req struct {
			Title       string `json:"title"`
			Description string `json:"description"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			s.respondError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		
		mc := s.cursors.NewMultiCursor(req.Title, req.Description)
		s.respondJSON(w, map[string]interface{}{
			"multicursor": mc,
		})
		
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleTheme handles theme API requests
func (s *Server) handleTheme(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		colors := theme.GetTcellColors()
		s.respondJSON(w, map[string]interface{}{
			"colors": map[string]string{
				"background": colors.Background.String(),
				"foreground": colors.Foreground.String(),
				"accent":     colors.Accent.String(),
				"muted":      colors.Muted.String(),
				"success":    colors.Success.String(),
				"warning":    colors.Warning.String(),
				"danger":     colors.Danger.String(),
				"border":     colors.Border.String(),
			},
			"preview": theme.PreviewOneLine(s.styles),
		})
		
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleUI handles UI design token requests
func (s *Server) handleUI(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.respondJSON(w, map[string]interface{}{
			"design_tokens": theme.GetDesignTokens(s.styles),
			"preview":       theme.Preview(s.styles),
			"palette":       theme.GetColorPalette(),
		})
		
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleStatus provides system status
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.respondJSON(w, map[string]interface{}{
		"status":           "running",
		"port":             s.port,
		"multicursors":     len(s.cursors.MultiCursors),
		"current_mc":       s.cursors.CurrentMC,
		"total_cursors":    s.getTotalCursorCount(),
		"server_time":      time.Now().UTC(),
	})
}

// handleRoot provides API documentation
func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	doc := map[string]interface{}{
		"name":    "Tubes API",
		"version": "1.0.0",
		"endpoints": map[string]string{
			"POST /api/command":       "Execute a command",
			"GET /api/cursors":        "Get cursors in current multicursor",
			"POST /api/cursors":       "Create a new cursor",
			"GET /api/multicursors":   "Get all multicursors",
			"POST /api/multicursors":  "Create a new multicursor", 
			"GET /api/theme":          "Get theme colors and preview",
			"GET /api/ui":             "Get UI design tokens",
			"GET /api/status":         "Get system status",
			"GET /health":             "Health check",
		},
	}
	
	s.respondJSON(w, doc)
}

// executeCommand executes a command and returns the result
func (s *Server) executeCommand(command string, args []string) (string, error) {
	switch command {
	case "/help":
		return `Available commands:
/help                    - Show this help
/mc new <title>          - Create new multicursor
/mc list                 - List all multicursors  
/cursor add <file:line>  - Add cursor to current multicursor
/cursor list             - List cursors in current multicursor
/ui tokens               - Show UI design tokens
/ui preview              - Show theme preview
/clear                   - Clear feedback area`, nil
		
	case "/mc":
		if len(args) == 0 {
			return "Usage: /mc new <title> | /mc list", nil
		}
		
		switch args[0] {
		case "list":
			var items []string
			for id, mc := range s.cursors.MultiCursors {
				items = append(items, fmt.Sprintf("%s: %s (%d cursors)", 
					id, mc.Title, len(mc.Cursors)))
			}
			if len(items) == 0 {
				return "No multicursors found", nil
			}
			return strings.Join(items, "\n"), nil
			
		case "new":
			if len(args) < 2 {
				return "Usage: /mc new <title>", nil
			}
			title := strings.Join(args[1:], " ")
			mc := s.cursors.NewMultiCursor(title, "Created via API")
			return fmt.Sprintf("Created multicursor: %s", mc.ID), nil
		}
		
	case "/ui":
		if len(args) == 0 {
			return theme.PreviewOneLine(s.styles), nil
		}
		
		switch args[0] {
		case "tokens":
			return theme.GetDesignTokens(s.styles), nil
		case "preview":
			return theme.Preview(s.styles), nil
		case "palette":
			return theme.GetColorPalette(), nil
		}
	}
	
	return fmt.Sprintf("Unknown command: %s", command), fmt.Errorf("unknown command")
}

// getTotalCursorCount returns the total number of cursors across all multicursors
func (s *Server) getTotalCursorCount() int {
	total := 0
	for _, mc := range s.cursors.MultiCursors {
		total += len(mc.Cursors)
	}
	return total
}

// respondJSON sends a JSON response
func (s *Server) respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// respondError sends an error response
func (s *Server) respondError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// corsMiddleware adds CORS headers
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

// logMiddleware logs requests
func (s *Server) logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}