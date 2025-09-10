package tui

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func (m *Model) startServerCmd() tea.Cmd {
	return func() tea.Msg {
		mux := http.NewServeMux()

		logServer := func(msg string) {
			ts := time.Now().Format("15:04:05")
			m.enqueueLog(logToLeft, fmt.Sprintf("[%s] %s", ts, msg))
		}
		logMain := func(msg string) {
			m.enqueueLog(logToRight, msg)
		}

		mux.HandleFunc("/api/list", func(w http.ResponseWriter, r *http.Request) {
			logServer("GET /api/list")
			w.Header().Set("Content-Type", "application/json")
			desc := "N/A"
			if c, ok := m.commands["/api"]; ok && c.Executor != nil {
				if d, err := c.Executor(m, nil); err == nil {
					desc = d
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"description": desc})
		})

		mux.HandleFunc("/fzf/api", func(w http.ResponseWriter, r *http.Request) {
			logServer("GET /fzf/api")
			w.Header().Set("Content-Type", "application/json")
			info, _ := getFZFInfo(m, nil)
			_ = json.NewEncoder(w).Encode(map[string]string{"description": info})
		})

		mux.HandleFunc("/log", func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
				return
			}
			var body struct {
				Message string `json:"message"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "Invalid JSON", http.StatusBadRequest)
				return
			}
			logServer(fmt.Sprintf("POST /log - msg: '%s'", body.Message))
			logMain("[API] " + body.Message)
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "logged"})
		})

		m.httpServer = &http.Server{
			Addr:    ":" + m.apiPort,
			Handler: mux,
		}

		// Run server; block here without affecting UI (Cmd runs in its own goroutine).
		if err := m.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("API server failed: %v", err)
		}
		return nil
	}
}

func (m *Model) shutdownServerCmd() tea.Cmd {
	return func() tea.Msg {
		if m.httpServer != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = m.httpServer.Shutdown(ctx)
		}
		return nil
	}
}
