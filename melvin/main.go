package main

import (
	"bufio"
	cryptoRand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/kkdai/youtube/v2"
)

/* =========================
   ANSI (color + dim status)
   ========================= */

const (
	clrReset  = "\x1b[0m"
	clrFaint  = "\x1b[2m"
	clrPrompt = "\x1b[36m" // cyan
	clrErr    = "\x1b[31m" // red
)

/* =========================
   Persistence Store
   ========================= */

type Store struct {
	Root string // MELVIN_DIR
}

func (s *Store) Ensure() error {
	if s.Root == "" {
		return errors.New("store root empty")
	}
	dirs := []string{
		s.Root,
		filepath.Join(s.Root, "data"),
		filepath.Join(s.Root, "transcripts"),
		filepath.Join(s.Root, "prefs"),
		filepath.Join(s.Root, "tags"),
		filepath.Join(s.Root, "modules"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) WriteJSON(path string, v any) error {
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetEscapeHTML(true)
	enc.SetIndent("", "")
	if err := enc.Encode(v); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func (s *Store) ReadJSON(path string, out any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}

func (s *Store) ModulePath(module, rel string) string {
	base := filepath.Join(s.Root, "modules", module)
	return filepath.Join(base, rel)
}

func (s *Store) prefsPath(module string) string {
	return filepath.Join(s.Root, "prefs", module+".json")
}

func (s *Store) PrefsGet(module, key string) (string, bool, error) {
	path := s.prefsPath(module)
	m := map[string]string{}
	if err := s.ReadJSON(path, &m); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", false, nil
		}
		return "", false, err
	}
	v, ok := m[key]
	return v, ok, nil
}

func (s *Store) PrefsSet(module, key, val string) error {
	path := s.prefsPath(module)
	m := map[string]string{}
	if _, err := os.Stat(path); err == nil {
		if err := s.ReadJSON(path, &m); err != nil {
			return err
		}
	}
	m[key] = val
	return s.WriteJSON(path, m)
}

func (s *Store) TagNote(tag, text string) (string, error) {
	if tag == "" {
		return "", errors.New("empty tag")
	}
	dir := filepath.Join(s.Root, "tags", tag)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	ts := time.Now().Unix()
	rnd := make([]byte, 3)
	_, _ = cryptoRand.Read(rnd)
	name := fmt.Sprintf("%d-%s.json", ts, hex.EncodeToString(rnd))
	path := filepath.Join(dir, name)
	rec := map[string]any{
		"ts":   ts,
		"tag":  tag,
		"text": text,
	}
	return path, s.WriteJSON(path, rec)
}

/* =========================
   Core runtime
   ========================= */

type Context struct {
	HTTPAddr string
	Mux      *http.ServeMux
	Logger   *log.Logger
	Vars     map[string]string
	YT       *youtube.Client
	Store    *Store
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
	mux.Handle("/", http.FileServer(http.Dir(m.staticDir)))
}

func (m *HTTPServerModule) Commands() map[string]CommandFunc {
	return map[string]CommandFunc{
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

type TranscriptRecord struct {
	TS    int64  `json:"ts"`
	ID    string `json:"id"`
	URL   string `json:"url"`
	Title string `json:"title"`
	Lang  string `json:"lang"`
	Text  string `json:"text"`
}

type YTTranscriberModule struct {
	defaultLang string
	yidRx       *regexp.Regexp
}

func (m *YTTranscriberModule) Name() string { return "yt-transcriber-module" }

func (m *YTTranscriberModule) Init(ctx *Context) error {
	m.defaultLang = getenv("MELVIN_DEFAULT_LANG", "en")
	m.yidRx = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	// HTTP routes with optional persistence
	ctx.Mux.HandleFunc("/api/transcript", func(w http.ResponseWriter, r *http.Request) {
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

		rec, err := m.fetchRecord(r.Context().Done(), ctx, videoID, lang)
		if err != nil {
			sendJSONError(w, err.Error(), http.StatusBadGateway)
			return
		}
		// optional store=1
		if r.URL.Query().Get("store") == "1" {
			_ = persistTranscript(ctx, rec)
		}
		w.Header().Set("Cache-Control", "public, max-age=120")
		sendJSONResponse(w, map[string]any{
			"ok":         true,
			"transcript": rec.Text,
			"meta":       rec,
		}, http.StatusOK)
	})
	return nil
}

func (m *YTTranscriberModule) HTTPRoutes(_ *http.ServeMux) {}

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
	rec, err := m.fetchRecord(nil, ctx, id, lang)
	if err != nil {
		return err
	}
	fmt.Println(rec.Text)
	if err := persistTranscript(ctx, rec); err != nil {
		return fmt.Errorf("persist: %w", err)
	}
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

func (m *YTTranscriberModule) fetchRecord(_ <-chan struct{}, ctx *Context, videoID, lang string) (*TranscriptRecord, error) {
	v, err := ctx.YT.GetVideo(videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch video metadata")
	}
	tr, err := ctx.YT.GetTranscript(v, lang)
	if err != nil {
		return nil, fmt.Errorf("transcript unavailable or disabled")
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
	url := "https://www.youtube.com/watch?v=" + videoID
	rec := &TranscriptRecord{
		TS:    time.Now().Unix(),
		ID:    videoID,
		URL:   url,
		Title: v.Title,
		Lang:  lang,
		Text:  b.String(),
	}
	return rec, nil
}

func persistTranscript(ctx *Context, rec *TranscriptRecord) error {
	dir := filepath.Join(ctx.Store.Root, "transcripts")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	path := filepath.Join(dir, fmt.Sprintf("%d.transcript", rec.TS))
	return ctx.Store.WriteJSON(path, rec)
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
   CLI / entry (+ slash commands)
   ========================= */

func main() {
	logger := log.New(os.Stdout, "", log.LstdFlags)

	// Insist on MELVIN_DIR
	root := os.Getenv("MELVIN_DIR")
	if root == "" {
		logger.Fatalf("MELVIN_DIR is required")
	}
	store := &Store{Root: root}
	if err := store.Ensure(); err != nil {
		logger.Fatalf("ensure store: %v", err)
	}

	mux := http.NewServeMux()
	ctx := &Context{
		HTTPAddr: getenv("MELVIN_HTTP_ADDR", ":8080"),
		Mux:      mux,
		Logger:   logger,
		Vars: map[string]string{
			"MELVIN_DIR": root,
		},
		YT:    &youtube.Client{},
		Store: store,
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

	// Slash commands
	slash := map[string]func(*Context, []string) error{
		"help": func(ctx *Context, _ []string) error {
			fmt.Println("slash commands: /help, /vars, /mods, /cmds, /pref get|set, /tag note")
			return nil
		},
		"vars": func(ctx *Context, _ []string) error {
			for k, v := range ctx.Vars {
				fmt.Printf("%s=%s\n", k, v)
			}
			return nil
		},
		"mods": func(_ *Context, _ []string) error {
			fmt.Println("modules:")
			for _, m := range modules {
				fmt.Printf("  %s\n", m.Name())
			}
			return nil
		},
		"cmds": func(_ *Context, _ []string) error {
			fmt.Println("commands:")
			for k := range dispatch {
				fmt.Printf("  %s\n", k)
			}
			return nil
		},
		"pref": func(ctx *Context, args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("usage: /pref get|set ...")
			}
			switch args[0] {
			case "get":
				if len(args) != 3 {
					return fmt.Errorf("usage: /pref get <module> <key>")
				}
				if v, ok, err := ctx.Store.PrefsGet(args[1], args[2]); err != nil {
					return err
				} else if !ok {
					fmt.Println("(unset)")
				} else {
					fmt.Println(v)
				}
				return nil
			case "set":
				if len(args) < 4 {
					return fmt.Errorf("usage: /pref set <module> <key> <value>")
				}
				val := strings.Join(args[3:], " ")
				return ctx.Store.PrefsSet(args[1], args[2], val)
			default:
				return fmt.Errorf("unknown /pref action")
			}
		},
		"tag": func(ctx *Context, args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("usage: /tag note <tag> <text...>")
			}
			switch args[0] {
			case "note":
				if len(args) < 3 {
					return fmt.Errorf("usage: /tag note <tag> <text...>")
				}
				tag := args[1]
				text := strings.Join(args[2:], " ")
				p, err := ctx.Store.TagNote(tag, text)
				if err != nil {
					return err
				}
				fmt.Println(p)
				return nil
			default:
				return fmt.Errorf("unknown /tag action")
			}
		},
	}

	// Modes
	if len(os.Args) > 1 && os.Args[1] != "repl" {
		// single-shot
		cmd := os.Args[1]
		args := os.Args[2:]
		if handler, ok := dispatch[cmd]; ok {
			if err := handler(ctx, args); err != nil {
				logger.Printf("error: %v", err)
				os.Exit(1)
			}
			return
		}
		if cmd == "serve" {
			if err := httpMod.start(ctx); err != nil {
				logger.Fatalf("serve: %v", err)
			}
			select {}
		}
		logger.Fatalf("unknown command: %s", cmd)
		return
	}

	// REPL + server
	if err := httpMod.start(ctx); err != nil {
		logger.Fatalf("serve: %v", err)
	}
	repl(ctx, dispatch, slash)
}

func repl(ctx *Context, dispatch map[string]CommandFunc, slash map[string]func(*Context, []string) error) {
	in := bufio.NewScanner(os.Stdin)
	fmt.Println("MELVIN REPL. Type 'help' or 'quit'. Slash commands start with '/'.")
	last := "ready"
	for {
		fmt.Print(clrPrompt + "melvin> " + clrReset)
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
		var err error
		start := time.Now()
		switch {
		case strings.HasPrefix(line, "/"):
			toks := splitArgs(strings.TrimPrefix(line, "/"))
			if len(toks) == 0 {
				err = nil
				break
			}
			name := toks[0]
			args := toks[1:]
			if fn, ok := slash[name]; ok {
				err = fn(ctx, args)
			} else {
				err = fmt.Errorf("unknown slash: /%s", name)
			}
		default:
			toks := splitArgs(line)
			name := toks[0]
			args := toks[1:]
			if fn, ok := dispatch[name]; ok {
				err = fn(ctx, args)
			} else {
				err = fmt.Errorf("unknown: %s", name)
			}
		}
		elapsed := time.Since(start).Truncate(time.Millisecond)
		if err != nil {
			fmt.Println(clrErr + "error: " + err.Error() + clrReset)
			last = "error"
		} else {
			last = "ok"
		}
		// status line (dim)
		fmt.Printf(clrFaint+"[%s] status=%s, took=%s"+clrReset+"\n", time.Now().Format(time.RFC3339), last, elapsed)
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

