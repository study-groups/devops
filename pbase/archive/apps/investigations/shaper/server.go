package main

import (
	"log"
	"net/http"
	"os"
	"strings"
)

func mustReadFile(name string) string {
	data, err := os.ReadFile(name)
	if err != nil {
		log.Fatal(err)
	}
	return string(data)
}

func main() {
	subsData := mustReadFile("sub.vars")
	base := mustReadFile("index.html")

	subs := map[string]string{}
	for _, line := range strings.Split(subsData, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		subs[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		mod := base
		for k, v := range subs {
			mod = strings.ReplaceAll(mod, k, v)
		}
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(mod))
	})

	log.Fatal(http.ListenAndServe(":8000", nil))
}
