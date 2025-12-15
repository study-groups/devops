# midi_bridge Makefile
# Build the low-latency C bridge for MIDI + Gamepad

CC = clang
CFLAGS = -std=c11 -Wall -Wextra -O3 -march=native -D_DARWIN_C_SOURCE
SDL_FLAGS = $(shell pkg-config --cflags --libs sdl2)
FRAMEWORKS = -framework CoreMIDI -framework CoreFoundation

.PHONY: all clean

all: midi_bridge

midi_bridge: midi_bridge.c
	$(CC) $(CFLAGS) -o $@ $< $(SDL_FLAGS) $(FRAMEWORKS)
	@echo "Built: midi_bridge"
	@echo "Usage: ./midi_bridge -g -M -v"

clean:
	rm -f midi_bridge

install: midi_bridge
	cp midi_bridge $(HOME)/tetra/bin/

.PHONY: install
