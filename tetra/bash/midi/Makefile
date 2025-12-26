# midi tools Makefile
# Build the low-latency C bridge for MIDI + Gamepad and OSC listener

CC = clang
CFLAGS = -std=c11 -Wall -Wextra -O3 -march=native -D_DARWIN_C_SOURCE
CFLAGS_SIMPLE = -O2 -Wall -Wextra
SDL_FLAGS = $(shell pkg-config --cflags --libs sdl2)
FRAMEWORKS = -framework CoreMIDI -framework CoreFoundation

.PHONY: all clean install

all: midi_bridge osc_listen

midi_bridge: midi_bridge.c
	$(CC) $(CFLAGS) -o $@ $< $(SDL_FLAGS) $(FRAMEWORKS)
	@echo "Built: midi_bridge"
	@echo "Usage: ./midi_bridge -g -M -v"

osc_listen: osc_listen.c
	$(CC) $(CFLAGS_SIMPLE) -o $@ $<
	@echo "Built: osc_listen"
	@echo "Usage: ./osc_listen [-p PORT] [-m MULTICAST] [-v]"

clean:
	rm -f midi_bridge osc_listen

install: midi_bridge osc_listen
	cp midi_bridge osc_listen $(HOME)/tetra/bin/
