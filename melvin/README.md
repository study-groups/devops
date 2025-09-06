# Go YouTube Transcriber

This is a simple web application built with Go that allows users to fetch the transcript of any YouTube video.

## Features

-   Simple, clean user interface.
-   Fetches and displays video transcripts given a YouTube video URL.
-   Backend built with Go's standard library.
-   Frontend built with HTML, CSS, and vanilla JavaScript.

## How It Works

The application uses the `youtube-transcript` library to scrape the transcript data that YouTube makes available for videos. The Go backend provides an API endpoint that takes a YouTube video ID, fetches the transcript, and returns it as JSON. The frontend calls this API and displays the result.

## Prerequisites

-   [Go](https://golang.org/doc/install) (version 1.18 or higher recommended)
-   A modern web browser

## Setup & Running the Application

1.  **Create the directory structure:** Create a main folder (e.g., `go-youtube-transcriber`) and a subfolder inside it named `static`.
    ```
    go-youtube-transcriber/
    ├── main.go
    └── static/
        ├── index.html
        ├── style.css
        └── script.js
    ```

2.  **Save the files:** Place each file from this document into its correct location in the directory structure.

3.  **Download Go dependencies:** Open your terminal in the main project directory (`go-youtube-transcriber`) and run the following command to download the necessary transcript library:
    ```sh
    go get [github.com/youtubedl-go/youtube-transcript](https://github.com/youtubedl-go/youtube-transcript)
    ```

4.  **Run the Go server:** In the same terminal, run the `main.go` file:
    ```sh
    go run main.go
    ```

5.  **Open the application:** You should see a message in your terminal saying `Server starting on port 8080...`. Open your web browser and navigate to:
    [http://localhost:8080](http://localhost:8080)

## API Endpoint

-   **GET `/api/transcript`**
    -   **Query Parameter:** `videoID` (string, required) - The ID of the YouTube video.
    -   **Success Response (200 OK):**
        ```json
        {
          "transcript": "The full transcript text..."
        }
        ```
    -   **Error Response (400/500):**
        ```json
        {
          "error": "A description of the error."
        }
        ```

