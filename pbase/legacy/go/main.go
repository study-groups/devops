package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

func main() {
	app := pocketbase.New()

	// Define the public directory for serving static files
	publicDir := defaultPublicDir()

	// Middleware to log incoming requests
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			// Add logging middleware to the router
			e.Router.GET("/*", func(w http.ResponseWriter, r *http.Request) {
				log.Printf("Incoming request: Method=%s, Path=%s, IP=%s",
					r.Method, r.URL.Path, r.RemoteAddr)
			})
			return e.Next()
		},
		Priority: 999,
	})

	// Serve static files from the public directory
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), true))
			}
			return e.Next()
		},
		Priority: 998,
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// Default public directory location
func defaultPublicDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		return "./pb_public"
	}
	return filepath.Join(os.Args[0], "../pb_public")
}
