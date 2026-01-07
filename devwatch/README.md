# Playwright Tests for Pixeljam Arcade

End-to-end tests for pixeljamarcade.com using Playwright.

## Setup

```bash
npm install
npx playwright install
```

## Required Environment

```bash
export PW_DIR="$HOME/pj/pw"   # Data directory for reports/results
```

Or source the TSM config:
```bash
source playwright.tsm
```

## Running Tests

```bash
# Run all tests against dev environment
PW_DIR=$HOME/pj/pw npx playwright test

# Run specific test file
npx playwright test tests/games.spec.js

# Run against specific environment
PLAYWRIGHT_TARGET_ENV=staging npx playwright test
PLAYWRIGHT_TARGET_ENV=prod npx playwright test

# Run headed (visible browser)
PLAYWRIGHT_HEADLESS=false npx playwright test

# Run with screenshots
TAKE_SCREENSHOTS=1 npx playwright test
```

## Test Files

| File | Purpose |
|------|---------|
| `tests/games.spec.js` | Smoke tests for game pages |
| `tests/game-flow.spec.js` | Navigation flow through games |
| `tests/metrics.spec.js` | Performance metrics (LCP, TTFB) |
| `tests/profiling.spec.js` | Detailed performance profiling |

## Target Environments

| Environment | URL |
|-------------|-----|
| `dev` | https://dev.pixeljamarcade.com |
| `staging` | https://staging.pixeljamarcade.com |
| `prod` | https://pixeljamarcade.com |
| `local` | http://localhost:9324 |

## Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PW_DIR` | (required) | Directory for reports, results, logs |
| `PLAYWRIGHT_TARGET_ENV` | `dev` | Target environment |
| `PLAYWRIGHT_HEADLESS` | `true` | Run headless |
| `TAKE_SCREENSHOTS` | - | Enable screenshots |
| `CAPTURE_TRACES` | - | Enable trace recording |

## Admin Server (Optional)

For a web UI to run tests:

```bash
node server/index.js
# Available at http://localhost:9324
```

## Project Structure

```
playwright/
├── playwright.config.js   # Playwright configuration
├── playwright.tsm         # TSM environment config
├── tests/                  # Test specs
├── reporters/              # Custom reporters
└── server/                 # Optional admin UI
```