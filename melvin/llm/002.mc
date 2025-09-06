#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: MELVIN.txt
# notes:
#MULTICAT_END
MELVIN MODULE SPEC v0.1

1) Runtime concepts
- Context: shared state injected into modules.
  struct Context {
    HTTPAddr string            // ":8080" by default
    Mux      *http.ServeMux    // shared HTTP mux
    Logger   *log.Logger
    Vars     map[string]string // string key/value config
    YT       *youtube.Client   // shared clients/utilities
  }

- Module interface:
  type Module interface {
    Name() string
    Init(ctx *Context) error           // register state, validate config
    HTTPRoutes(mux *http.ServeMux)     // register HTTP endpoints (optional)
    Commands() map[string]CommandFunc  // CLI commands (optional)
  }
  type CommandFunc func(ctx *Context, args []string) error

- Composition:
  main.go constructs Context, instantiates modules, runs:
    m.Init(ctx) -> m.HTTPRoutes(ctx.Mux) -> merge m.Commands() into dispatcher.

2) CLI (REPL and single-shot)
- Binary supports:
  a) Single-shot: melvin <command> [args...]
  b) REPL: melvin repl
     - Prompt: melvin> 
     - Built-ins: help, list, quit/exit
     - Command resolution: first token is command key registered by any module.

3) HTTP server lifecycle
- http-server-module owns the net/http.Server and starts it in a goroutine after all modules have attached routes.
- Context.Mux is the shared multiplexer; modules do not start listeners.

4) Config and env
- Values are read from environment with prefix MELVIN_ and injected into ctx.Vars:
  MELVIN_HTTP_ADDR (default ":8080")
  MELVIN_STATIC_DIR (default "./static")
  MELVIN_DEFAULT_LANG (default "en")

5) Error discipline
- Command funcs return error; dispatcher prints concise one-line diagnostics.
- HTTP handlers reply JSON:
  { "error": "<message>" } with appropriate status
  { "ok": true, ... } or domain payloads.

6) Modules in this example
- http-server-module
  Provides:
    - Static file server for MELVIN_STATIC_DIR at "/"
  Notes:
    - Does not own API routes; only serves and hosts mux.
- yt-transcriber-module
  Provides:
    - HTTP: GET /api/transcript?videoID=<id|url>&lang=<xx>
    - CLI:  transcribe <id|url> [--lang=<xx>]
      Prints plaintext transcript to stdout.

7) Minimal wire protocol for transcripts
- HTTP response: { "transcript": "<text>" }
- CLI stdout: plain text, no extra formatting.

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: go.mod
# notes:
#MULTICAT_END
module nodeholder/com/m

go 1.23.0

toolchain go1.24.7

require (
	github.com/kkdai/youtube/v2 v2.10.4
)

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: main.go
# notes:
#MULTICAT_END
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/kkdai/youtube/v2"
)

/* =========================
   Core runtime (Context, Module, CLI)
   ========================= */

type Context struct {
	HTTPAddr string
	Mux      *http.ServeMux
	Logger   *log.Logger
	Vars     map[string]string
	YT       *youtube.Client
}

type CommandFunc func(ctx *Context, args []string) error

type Module interface {
	Name() string
	Init(ctx *Context) error
	HTTPRoutes(mux *http.ServeMux)
	Commands() map[string]CommandFunc
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

/* =========================
   http-server-module
   ========================= */

type HTTPServerModule struct {
	staticDir string
	server    *http.Server
}

func (m *HTTPServerModule) Name() string { return "http-server-module" }

func (m *HTTPServerModule) Init(ctx *Context) error {
	m.staticDir = getenv("MELVIN_STATIC_DIR", "./static")
	ctx.Logger.Printf("[%s] static dir: %s", m.Name(), m.staticDir)
	return nil
}

func (m *HTTPServerModule) HTTPRoutes(mux *http.ServeMux) {
	// Serve static UI
	mux.Handle("/", http.FileServer(http.Dir(m.staticDir)))
}

func (m *HTTPServerModule) Commands() map[string]CommandFunc {
	return map[string]CommandFunc{
		// health probes and server info
		"serve-info": func(ctx *Context, args []string) error {
			fmt.Printf("http.addr=%s\n", ctx.HTTPAddr)
			fmt.Printf("static.dir=%s\n", m.staticDir)
			return nil
		},
	}
}

func (m *HTTPServerModule) start(ctx *Context) error {
	m.server = &http.Server{
		Addr:              ctx.HTTPAddr,
		Handler:           logRequests(ctx.Logger, ctx.Mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		ctx.Logger.Printf("[http] listening on %s", ctx.HTTPAddr)
		if err := m.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			ctx.Logger.Fatalf("ListenAndServe: %v", err)
		}
	}()
	return nil
}

/* =========================
   yt-transcriber-module
   ========================= */

type YTTranscriberModule struct {
	defaultLang string
	yidRx       *regexp.Regexp
}

func (m *YTTranscriberModule) Name() string { return "yt-transcriber-module" }

func (m *YTTranscriberModule) Init(ctx *Context) error {
	m.defaultLang = getenv("MELVIN_DEFAULT_LANG", "en")
	m.yidRx = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	return nil
}

func (m *YTTranscriberModule) HTTPRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/transcript", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			sendJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		raw := r.URL.Query().Get("videoID")
		if raw == "" {
			sendJSONError(w, "videoID query parameter is required", http.StatusBadRequest)
			return
		}
		videoID, err := m.normalizeVideoID(raw)
		if err != nil {
			sendJSONError(w, "invalid videoID", http.StatusBadRequest)
			return
		}
		lang := r.URL.Query().Get("lang")
		if lang == "" {
			lang = m.defaultLang
		}

		trText, err := m.fetchTranscript(r.Context(), videoID, lang)
		if err != nil {
			sendJSONError(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=120")
		sendJSONResponse(w, map[string]string{"transcript": trText}, http.StatusOK)
	})
}

func (m *YTTranscriberModule) Commands() map[string]CommandFunc {
	return map[string]CommandFunc{
		"transcribe": m.cmdTranscribe,
	}
}

func (m *YTTranscriberModule) cmdTranscribe(ctx *Context, args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: transcribe <id|url> [--lang=<xx>]")
	}
	target := args[0]
	lang := m.defaultLang
	for _, a := range args[1:] {
		if strings.HasPrefix(a, "--lang=") {
			lang = strings.TrimPrefix(a, "--lang=")
		}
	}
	id, err := m.normalizeVideoID(target)
	if err != nil {
		return fmt.Errorf("invalid videoID: %w", err)
	}
	text, err := m.fetchTranscript(nil, id, lang)
	if err != nil {
		return err
	}
	fmt.Println(text)
	return nil
}

func (m *YTTranscriberModule) normalizeVideoID(input string) (string, error) {
	if m.yidRx.MatchString(input) {
		return input, nil
	}
	u, err := url.Parse(input)
	if err != nil || u.Host == "" {
		return "", errors.New("not a valid YouTube ID or URL")
	}
	host := strings.ToLower(u.Host)
	switch {
	case strings.HasSuffix(host, "youtube.com"):
		if id := u.Query().Get("v"); m.yidRx.MatchString(id) {
			return id, nil
		}
		if parts := strings.Split(strings.Trim(u.Path, "/"), "/"); len(parts) >= 2 && parts[0] == "shorts" && m.yidRx.MatchString(parts[1]) {
			return parts[1], nil
		}
	case strings.HasSuffix(host, "youtu.be"):
		id := strings.Trim(strings.TrimPrefix(u.Path, "/"), "/")
		if m.yidRx.MatchString(id) {
			return id, nil
		}
	}
	return "", errors.New("unable to extract video id")
}

func (m *YTTranscriberModule) fetchTranscript(_ any, videoID, lang string) (string, error) {
	var c youtube.Client
	v, err := c.GetVideo(videoID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch video metadata")
	}
	tr, err := c.GetTranscript(v, lang)
	if err != nil {
		return "", fmt.Errorf("transcript unavailable or disabled")
	}
	var b strings.Builder
	for _, e := range tr {
		if t := strings.TrimSpace(e.Text); t != "" {
			if b.Len() > 0 {
				b.WriteByte(' ')
			}
			b.WriteString(t)
		}
	}
	return b.String(), nil
}

/* =========================
   HTTP helpers
   ========================= */

func logRequests(l *log.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &wrapWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		l.Printf("%s %s %d %s", r.Method, r.URL.String(), ww.status, time.Since(start).Truncate(time.Millisecond))
	})
}

type wrapWriter struct {
	http.ResponseWriter
	status int
}

func (w *wrapWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

type errorResponse struct {
	Error string `json:"error"`
}

func sendJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(errorResponse{Error: message})
}

func sendJSONResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

/* =========================
   CLI / entry
   ========================= */

func main() {
	logger := log.New(os.Stdout, "", log.LstdFlags)
	mux := http.NewServeMux()
	ctx := &Context{
		HTTPAddr: getenv("MELVIN_HTTP_ADDR", ":8080"),
		Mux:      mux,
		Logger:   logger,
		Vars:     map[string]string{},
		YT:       &youtube.Client{},
	}

	// Instantiate modules
	httpMod := &HTTPServerModule{}
	ytMod := &YTTranscriberModule{}
	modules := []Module{httpMod, ytMod}

	// Init + attach routes
	for _, m := range modules {
		if err := m.Init(ctx); err != nil {
			logger.Fatalf("init %s: %v", m.Name(), err)
		}
		m.HTTPRoutes(ctx.Mux)
	}

	// Build command dispatcher
	dispatch := map[string]CommandFunc{
		"help": func(ctx *Context, args []string) error {
			fmt.Println("builtins: help, list, quit")
			fmt.Println("commands:")
			seen := map[string]struct{}{}
			for _, m := range modules {
				for k := range m.Commands() {
					if _, ok := seen[k]; !ok {
						fmt.Printf("  %s\n", k)
						seen[k] = struct{}{}
					}
				}
			}
			return nil
		},
		"list": func(ctx *Context, args []string) error {
			for _, m := range modules {
				fmt.Println(m.Name())
			}
			return nil
		},
	}

	for _, m := range modules {
		for k, fn := range m.Commands() {
			dispatch[k] = fn
		}
	}

	// Flags: default mode runs server + REPL if "repl" is requested or no args; single-shot if command provided.
	if len(os.Args) > 1 && os.Args[1] != "repl" {
		// single-shot: melvin <command> [args...]
		cmd := os.Args[1]
		args := os.Args[2:]
		if handler, ok := dispatch[cmd]; ok {
			if err := handler(ctx, args); err != nil {
				logger.Printf("error: %v", err)
				os.Exit(1)
			}
			return
		}
		// allow "serve" to just start server and block
		if cmd == "serve" {
			if err := httpMod.start(ctx); err != nil {
				logger.Fatalf("serve: %v", err)
			}
			select {}
		}
		logger.Fatalf("unknown command: %s", cmd)
		return
	}

	// REPL + server in background
	if err := httpMod.start(ctx); err != nil {
		logger.Fatalf("serve: %v", err)
	}
	repl(ctx, dispatch)
}

func repl(ctx *Context, dispatch map[string]CommandFunc) {
	in := bufio.NewScanner(os.Stdin)
	fmt.Println("MELVIN REPL. Type 'help' or 'quit'.")
	for {
		fmt.Print("melvin> ")
		if !in.Scan() {
			return
		}
		line := strings.TrimSpace(in.Text())
		if line == "" {
			continue
		}
		if line == "quit" || line == "exit" {
			return
		}
		toks := splitArgs(line)
		cmd := toks[0]
		args := toks[1:]
		if handler, ok := dispatch[cmd]; ok {
			if err := handler(ctx, args); err != nil {
				fmt.Printf("error: %v\n", err)
			}
			continue
		}
		fmt.Printf("unknown: %s\n", cmd)
	}
}

// splitArgs: simple shell-like split supporting quoted segments.
func splitArgs(s string) []string {
	var out []string
	var b strings.Builder
	quote := byte(0)
	escaped := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if escaped {
			b.WriteByte(c)
			escaped = false
			continue
		}
		if c == '\\' {
			escaped = true
			continue
		}
		if quote == 0 && (c == '"' || c == '\'') {
			quote = c
			continue
		}
		if quote != 0 {
			if c == quote {
				quote = 0
				continue
			}
			b.WriteByte(c)
			continue
		}
		if c == ' ' || c == '\t' {
			if b.Len() > 0 {
				out = append(out, b.String())
				b.Reset()
			}
			continue
		}
		b.WriteByte(c)
	}
	if b.Len() > 0 {
		out = append(out, b.String())
	}
	return out
}

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: main.go.orig
# notes:
#MULTICAT_END
// placeholder retained to mark prior CLI entrypoint existence.
// The new main.go reintroduces a REPL and command dispatch as described in MELVIN.txt.

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber/static
# file: index.html
# notes:
#MULTICAT_END
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Go YouTube Transcriber</title>
    <link rel="stylesheet" href="style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header>
            <h1>YouTube Video Transcriber</h1>
            <p>Enter a YouTube video URL below to get its transcript.</p>
        </header>

        <div class="input-area">
            <input type="text" id="youtube-url" placeholder="e.g., https://www.youtube.com/watch?v=8enXRDlWguU">
            <button id="get-transcript-btn">Get Transcript</button>
        </div>

        <div class="result-area">
            <div id="loader" class="hidden"></div>
            <div id="error-message" class="hidden"></div>
            <div class="transcript-container">
                <button id="copy-btn" class="hidden">Copy Text</button>
                <pre id="transcript-output"></pre>
            </div>
        </div>

        <footer>
            <p>Powered by <a href="https://golang.org/" target="_blank">Go</a></p>
        </footer>
    </div>

    <script src="script.js"></script>
</body>
</html>

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber/static
# file: script.js
# notes:
#MULTICAT_END
// Wait for the HTML document to be fully loaded before running the script.
document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('youtube-url');
    const getBtn = document.getElementById('get-transcript-btn');
    const transcriptOutput = document.getElementById('transcript-output');
    const errorMessage = document.getElementById('error-message');
    const loader = document.getElementById('loader');
    const copyBtn = document.getElementById('copy-btn');

    getBtn.addEventListener('click', fetchTranscript);
    urlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') fetchTranscript();
    });
    copyBtn.addEventListener('click', copyTranscriptToClipboard);

    function extractVideoID(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
        const matches = url.match(regex);
        return matches ? matches[1] : null;
    }

    async function fetchTranscript() {
        const url = urlInput.value.trim();
        if (!url) {
            showError('Please enter a YouTube URL.');
            return;
        }
        const videoID = extractVideoID(url);
        if (!videoID) {
            showError('Could not find a valid YouTube video ID in the URL.');
            return;
        }
        resetUI();
        loader.classList.remove('hidden');
        try {
            const response = await fetch(`/api/transcript?videoID=${videoID}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            const data = await response.json();
            transcriptOutput.textContent = data.transcript;
            copyBtn.classList.remove('hidden');
        } catch (error) {
            showError(error.message);
        } finally {
            loader.classList.add('hidden');
        }
    }

    function copyTranscriptToClipboard() {
        const textToCopy = transcriptOutput.textContent;
        if (!textToCopy) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy Text'; }, 2000);
            }).catch(() => fallbackCopyText(textToCopy));
        } else {
            fallbackCopyText(textToCopy);
        }
    }

    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy Text'; }, 2000);
        } catch (_) {}
        document.body.removeChild(textArea);
    }

    function showError(message) {
        resetUI();
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function resetUI() {
        errorMessage.classList.add('hidden');
        transcriptOutput.textContent = '';
        copyBtn.classList.add('hidden');
    }
});

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber/static
# file: style.css
# notes:
#MULTICAT_END
body {
    font-family: 'Inter', sans-serif;
    background-color: #f0f2f5;
    color: #333;
    margin: 0;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
}
.container {
    width: 100%;
    max-width: 800px;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 30px 40px;
    box-sizing: border-box;
}
header {
    text-align: center;
    margin-bottom: 30px;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 20px;
}
header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    color: #1a1a1a;
}
header p {
    margin-top: 8px;
    color: #666;
    font-size: 16px;
}
.input-area {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
}
#youtube-url {
    flex-grow: 1;
    padding: 12px 15px;
    border: 1px solid #ccc;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s, box-shadow 0.3s;
}
#youtube-url:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}
#get-transcript-btn {
    padding: 12px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.2s;
}
#get-transcript-btn:hover {
    background-color: #0056b3;
}
#get-transcript-btn:active {
    transform: scale(0.98);
}
.result-area {
    position: relative;
    min-height: 100px;
}
.transcript-container {
    position: relative;
}
#transcript-output {
    background-color: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 20px;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 15px;
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    color: #333;
}
#copy-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.3s, background-color 0.3s;
}
.transcript-container:hover #copy-btn { opacity: 1; }
#copy-btn:hover { background-color: #5a6268; }
#loader {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin: 30px auto;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
#error-message {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
}
.hidden { display: none !important; }
footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    font-size: 14px;
    color: #888;
}
footer a { color: #007bff; text-decoration: none; }
footer a:hover { text-decoration: underline; }

