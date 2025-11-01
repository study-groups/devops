# Demo 010 - ARCHIVED

**Archived Date:** 2025-11-01
**Reason:** Superseded by Demo 014 and unified bash/tui library

## Why Archived

Demo 010 was an early TUI framework foundation that explored:
- Color system with distance-based verb×noun coloring
- Component-based architecture
- Handler registry pattern
- Double buffering
- Event system

However, **Demo 014** represents a more complete, modern implementation that:
- Uses the production-ready TCurses library (v1.0.0)
- Has fixed terminal input handling
- Includes BPM-synchronized animation
- Features a modular actions system
- Provides better REPL integration

## What Replaced It

- **TUI Library:** `bash/tui/` (consolidated from bash/tcurses + demo 014)
- **Color System:** `bash/color/` (already extracted)
- **REPL System:** `bash/repl/` (universal REPL)
- **Reference Demo:** `demo/basic/014/`

## Historical Value

This demo remains archived as a reference for:
- Early TUI architecture evolution
- Handler registry patterns
- Component composition approach

## Migration Path

If you were using demo 010 code:
1. Use `bash/tui/` for TUI primitives (screen, input, buffer, animation)
2. Use `bash/color/` for color system
3. Use `bash/repl/` for REPL interfaces
4. Reference `demo/basic/014/` for complete examples
