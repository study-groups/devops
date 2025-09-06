#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: MELVIN.txt
# notes:
#MULTICAT_END
Always output MULTICAT in a single fenced code block using Markdown triple backticks with `txt` as the language tag. 
Inside that block, include only properly formatted MULTICAT records:

#MULTICAT_START
# dir: ...
# file: ...
# notes:
#MULTICAT_END
<file contents>

Never insert stray commentary, prose, or text outside of this code fence.

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: go.mod
# notes:
#MULTICAT_END
module nodeholder/com/m

go 1.23.0

toolchain go1.24.7

require (
	github.com/bitly/go-simplejson v0.5.1 // indirect
	github.com/dlclark/regexp2 v1.11.5 // indirect
	github.com/dop251/goja v0.0.0-20250125213203-5ef83b82af17 // indirect
	github.com/go-sourcemap/sourcemap v2.1.4+incompatible // indirect
	github.com/google/pprof v0.0.0-20250208200701-d0013a598941 // indirect
	github.com/kkdai/youtube/v2 v2.10.4 // indirect
	golang.org/x/text v0.22.0 // indirect
)

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: main.go
# notes:
#MULTICAT_END
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/kkdai/youtube/v2"
)

type TranscriptResponse struct {
	Transcript string `json:"transcript"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var yidRx = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./static")))
	mux.HandleFunc("/api/transcript", getTranscriptHandler)

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	fmt.Println("Server starting on port 8080...")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("ListenAndServe: ", err)
	}
}

func getTranscriptHandler(w http.ResponseWriter, r *http.Request) {
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

	videoID, err := normalizeVideoID(raw)
	if err != nil {
		sendJSONError(w, "invalid videoID", http.StatusBadRequest)
		return
	}

	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "en"
	}

	var c youtube.Client

	v, err := c.GetVideo(videoID)
	if err != nil {
		log.Printf("GetVideo(%s) error: %v", videoID, err)
		sendJSONError(w, "failed to fetch video metadata", http.StatusBadGateway)
		return
	}

	tr, err := c.GetTranscript(v, lang)
	if err != nil {
		log.Printf("GetTranscript(%s,%s) error: %v", videoID, lang, err)
		sendJSONError(w, "transcript unavailable or disabled", http.StatusBadGateway)
		return
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

	w.Header().Set("Cache-Control", "public, max-age=120")
	sendJSONResponse(w, TranscriptResponse{Transcript: b.String()}, http.StatusOK)
}

func normalizeVideoID(input string) (string, error) {
	if yidRx.MatchString(input) {
		return input, nil
	}
	u, err := url.Parse(input)
	if err != nil || u.Host == "" {
		return "", errors.New("not a valid YouTube ID or URL")
	}
	host := strings.ToLower(u.Host)
	switch {
	case strings.HasSuffix(host, "youtube.com"):
		if id := u.Query().Get("v"); yidRx.MatchString(id) {
			return id, nil
		}
		if parts := strings.Split(strings.Trim(u.Path, "/"), "/"); len(parts) >= 2 && parts[0] == "shorts" && yidRx.MatchString(parts[1]) {
			return parts[1], nil
		}
	case strings.HasSuffix(host, "youtu.be"):
		id := strings.Trim(strings.TrimPrefix(u.Path, "/"), "/")
		if yidRx.MatchString(id) {
			return id, nil
		}
	}
	return "", errors.New("unable to extract video id")
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &wrapWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.String(), ww.status, time.Since(start).Truncate(time.Millisecond))
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

func sendJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

func sendJSONResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: main.go.orig
# notes:
#MULTICAT_END
#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: MELVIN.txt
# notes:
#MULTICAT_END
Always output MULTICAT in a single fenced code block using Markdown triple backticks with `txt` as the language tag. 
Inside that block, include only properly formatted MULTICAT records:

#MULTICAT_START
# dir: ...
# file: ...
# notes:
#MULTICAT_END
<file contents>

Never insert stray commentary, prose, or text outside of this code fence.

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: go.mod
# notes:
#MULTICAT_END
module nodeholder/com/m

go 1.23.0

toolchain go1.24.7

require (
	github.com/bitly/go-simplejson v0.5.1 // indirect
	github.com/dlclark/regexp2 v1.11.5 // indirect
	github.com/dop251/goja v0.0.0-20250125213203-5ef83b82af17 // indirect
	github.com/go-sourcemap/sourcemap v2.1.4+incompatible // indirect
	github.com/google/pprof v0.0.0-20250208200701-d0013a598941 // indirect
	github.com/kkdai/youtube/v2 v2.10.4 // indirect
	golang.org/x/text v0.22.0 // indirect
)

#MULTICAT_START
# dir: /Users/mricos/src/mricos/demos/melvin/old/go-youtube-transcriber
# file: main.go
# notes:
#MULTICAT_END
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/kkdai/youtube/v2"
)

type TranscriptResponse struct {
	Transcript string `json:"transcript"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var yidRx = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./static")))
	mux.HandleFunc("/api/transcript", getTranscriptHandler)

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	fmt.Println("Server starting on port 8080...")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("ListenAndServe: ", err)
	}
}

func getTranscriptHandler(w http.ResponseWriter, r *http.Request) {
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

	videoID, err := normalizeVideoID(raw)
	if err != nil {
		sendJSONError(w, "invalid videoID", http.StatusBadRequest)
		return
	}

	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "en"
	}

	var c youtube.Client

	v, err := c.GetVideo(videoID)
	if err != nil {
		log.Printf("GetVideo(%s) error: %v", videoID, err)
		sendJSONError(w, "failed to fetch video metadata", http.StatusBadGateway)
		return
	}

	tr, err := c.GetTranscript(v, lang)
	if err != nil {
		log.Printf("GetTranscript(%s,%s) error: %v", videoID, lang, err)
		sendJSONError(w, "transcript unavailable or disabled", http.StatusBadGateway)
		return
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

	w.Header().Set("Cache-Control", "public, max-age=120")
	sendJSONResponse(w, TranscriptResponse{Transcript: b.String()}, http.StatusOK)
}

func normalizeVideoID(input string) (string, error) {
	if yidRx.MatchString(input) {
		return input, nil
	}
	u, err := url.Parse(input)
	if err != nil || u.Host == "" {
		return "", errors.New("not a valid YouTube ID or URL")
	}
	host := strings.ToLower(u.Host)
	switch {
	case strings.HasSuffix(host, "youtube.com"):
		if id := u.Query().Get("v"); yidRx.MatchString(id) {
			return id, nil
		}
		if parts := strings.Split(strings.Trim(u.Path, "/"), "/"); len(parts) >= 2 && parts[0] == "shorts" && yidRx.MatchString(parts[1]) {
			return parts[1], nil
		}
	case strings.HasSuffix(host, "youtu.be"):
		id := strings.Trim(strings.TrimPrefix(u.Path, "/"), "/")
		if yidRx.MatchString(id) {
			return id, nil
		}
	}
	return "", errors.New("unable to extract video id")
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &wrapWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.String(), ww.status, time.Since(start).Truncate(time.Millisecond))
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

func sendJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

func sendJSONResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

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
    // Get references to all the HTML elements we'll need to interact with.
    const urlInput = document.getElementById('youtube-url');
    const getBtn = document.getElementById('get-transcript-btn');
    const transcriptOutput = document.getElementById('transcript-output');
    const errorMessage = document.getElementById('error-message');
    const loader = document.getElementById('loader');
    const copyBtn = document.getElementById('copy-btn');

    // Add a click event listener to the 'Get Transcript' button.
    getBtn.addEventListener('click', fetchTranscript);

    // Add a keypress event listener to the URL input field to allow pressing Enter.
    urlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            fetchTranscript();
        }
    });
    
    // Add a click event listener to the 'Copy' button.
    copyBtn.addEventListener('click', copyTranscriptToClipboard);

    /**
     * Extracts the YouTube video ID from various URL formats.
     * @param {string} url - The full YouTube URL.
     * @returns {string|null} The video ID or null if not found.
     */
    function extractVideoID(url) {
        // This regular expression matches various YouTube URL formats.
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
        const matches = url.match(regex);
        return matches ? matches[1] : null;
    }

    /**
     * Main function to fetch the transcript from our Go backend.
     */
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
        
        // Reset the UI to a loading state.
        resetUI();
        loader.classList.remove('hidden');

        try {
            // Make a GET request to our backend API endpoint.
            const response = await fetch(`/api/transcript?videoID=${videoID}`);

            if (!response.ok) {
                // If the server response is not OK (e.g., 404, 500), handle the error.
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            
            const data = await response.json();
            
            // Display the fetched transcript.
            transcriptOutput.textContent = data.transcript;
            copyBtn.classList.remove('hidden');

        } catch (error) {
            showError(error.message);
        } finally {
            // Always hide the loader when the process is finished.
            loader.classList.add('hidden');
        }
    }
    
    /**
     * Copies the content of the transcript output to the user's clipboard.
     */
    function copyTranscriptToClipboard() {
        const textToCopy = transcriptOutput.textContent;
        if (!textToCopy) return;

        // Use the modern Clipboard API if available, with a fallback.
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy Text';
                }, 2000); // Reset text after 2 seconds
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                // Fallback for cases where clipboard API fails
                fallbackCopyText(textToCopy);
            });
        } else {
             // Fallback for older browsers
            fallbackCopyText(textToCopy);
        }
    }
    
    /**
     * A fallback function for copying text for older browsers.
     * @param {string} text - The text to copy.
     */
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy Text';
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }

        document.body.removeChild(textArea);
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to show.
     */
    function showError(message) {
        resetUI();
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    /**
     * Resets the UI elements to their initial state.
     */
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
/* General Body Styling */
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

/* Main Container */
.container {
    width: 100%;
    max-width: 800px;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 30px 40px;
    box-sizing: border-box;
}

/* Header Section */
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

/* Input Area */
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

/* Result Area */
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
    white-space: pre-wrap; /* Allows text to wrap */
    word-wrap: break-word;  /* Breaks long words */
    font-size: 15px;
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    color: #333;
}

/* Copy Button */
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

.transcript-container:hover #copy-btn {
    opacity: 1;
}

#copy-btn:hover {
    background-color: #5a6268;
}

/* Loader Animation */
#loader {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin: 30px auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Error Message Styling */
#error-message {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
}

/* Utility 'hidden' class */
.hidden {
    display: none !important;
}

/* Footer Styling */
footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    font-size: 14px;
    color: #888;
}

footer a {
    color: #007bff;
    text-decoration: none;
}

footer a:hover {
    text-decoration: underline;
}



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
    // Get references to all the HTML elements we'll need to interact with.
    const urlInput = document.getElementById('youtube-url');
    const getBtn = document.getElementById('get-transcript-btn');
    const transcriptOutput = document.getElementById('transcript-output');
    const errorMessage = document.getElementById('error-message');
    const loader = document.getElementById('loader');
    const copyBtn = document.getElementById('copy-btn');

    // Add a click event listener to the 'Get Transcript' button.
    getBtn.addEventListener('click', fetchTranscript);

    // Add a keypress event listener to the URL input field to allow pressing Enter.
    urlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            fetchTranscript();
        }
    });
    
    // Add a click event listener to the 'Copy' button.
    copyBtn.addEventListener('click', copyTranscriptToClipboard);

    /**
     * Extracts the YouTube video ID from various URL formats.
     * @param {string} url - The full YouTube URL.
     * @returns {string|null} The video ID or null if not found.
     */
    function extractVideoID(url) {
        // This regular expression matches various YouTube URL formats.
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
        const matches = url.match(regex);
        return matches ? matches[1] : null;
    }

    /**
     * Main function to fetch the transcript from our Go backend.
     */
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
        
        // Reset the UI to a loading state.
        resetUI();
        loader.classList.remove('hidden');

        try {
            // Make a GET request to our backend API endpoint.
            const response = await fetch(`/api/transcript?videoID=${videoID}`);

            if (!response.ok) {
                // If the server response is not OK (e.g., 404, 500), handle the error.
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            
            const data = await response.json();
            
            // Display the fetched transcript.
            transcriptOutput.textContent = data.transcript;
            copyBtn.classList.remove('hidden');

        } catch (error) {
            showError(error.message);
        } finally {
            // Always hide the loader when the process is finished.
            loader.classList.add('hidden');
        }
    }
    
    /**
     * Copies the content of the transcript output to the user's clipboard.
     */
    function copyTranscriptToClipboard() {
        const textToCopy = transcriptOutput.textContent;
        if (!textToCopy) return;

        // Use the modern Clipboard API if available, with a fallback.
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy Text';
                }, 2000); // Reset text after 2 seconds
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                // Fallback for cases where clipboard API fails
                fallbackCopyText(textToCopy);
            });
        } else {
             // Fallback for older browsers
            fallbackCopyText(textToCopy);
        }
    }
    
    /**
     * A fallback function for copying text for older browsers.
     * @param {string} text - The text to copy.
     */
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy Text';
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }

        document.body.removeChild(textArea);
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to show.
     */
    function showError(message) {
        resetUI();
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    /**
     * Resets the UI elements to their initial state.
     */
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
/* General Body Styling */
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

/* Main Container */
.container {
    width: 100%;
    max-width: 800px;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 30px 40px;
    box-sizing: border-box;
}

/* Header Section */
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

/* Input Area */
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

/* Result Area */
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
    white-space: pre-wrap; /* Allows text to wrap */
    word-wrap: break-word;  /* Breaks long words */
    font-size: 15px;
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    color: #333;
}

/* Copy Button */
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

.transcript-container:hover #copy-btn {
    opacity: 1;
}

#copy-btn:hover {
    background-color: #5a6268;
}

/* Loader Animation */
#loader {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin: 30px auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Error Message Styling */
#error-message {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
}

/* Utility 'hidden' class */
.hidden {
    display: none !important;
}

/* Footer Styling */
footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    font-size: 14px;
    color: #888;
}

footer a {
    color: #007bff;
    text-decoration: none;
}

footer a:hover {
    text-decoration: underline;
}


