#!/bin/bash

# Default site
SITE=${1:-"dev.pixeljamarcade.com"}

# Function to fetch HTTP headers
fetch_http_headers() {
  echo "Fetching HTTP headers for $1..."
  curl -s -I "http://$1"
}

# Function to fetch the HTML content
fetch_html_content() {
  echo "Fetching HTML content for $1..."
  curl -s "http://$1"
}

# Function to fetch site information
fetch_site_info() {
  echo "Fetching site information for $1..."
  curl -s "http://$1" | grep -E "<title>|<meta|<h1|<h2|<h3"
}

# Main execution
echo "Information for site: $SITE"
fetch_http_headers $SITE
fetch_html_content $SITE
fetch_site_info $SITE
