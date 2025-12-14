# Makefile for gamepad tools

CC = cc
CFLAGS = -O3 -std=c99 -Wall -Wextra
SDL2_CFLAGS := $(shell sdl2-config --cflags 2>/dev/null || echo "-I/opt/homebrew/include/SDL2")
SDL2_LIBS := $(shell sdl2-config --libs 2>/dev/null || echo "-L/opt/homebrew/lib -lSDL2")

.PHONY: all clean check-sdl2

all: check-sdl2 sender

check-sdl2:
	@command -v sdl2-config >/dev/null 2>&1 || \
		(echo "ERROR: SDL2 not found. Install with: brew install sdl2" && exit 1)
	@echo "SDL2 found: $(shell sdl2-config --version)"

sender: sender.c
	$(CC) $(CFLAGS) $(SDL2_CFLAGS) -o sender sender.c $(SDL2_LIBS)
	@echo "Built: sender"

clean:
	rm -f sender
	@echo "Cleaned sender tool"

test: sender
	@echo "Testing gamepad detection..."
	@echo "Usage: ./sender /tmp/gamepad.sock [player_id]"
