# TMC Makefile

CC = gcc
CFLAGS = -Wall -O2
LDFLAGS = -lportmidi -lpthread

TARGET = tmc
SRC = tmc.c

.PHONY: all clean install test help

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC) $(LDFLAGS)
	@echo ""
	@echo "✓ Built: $(TARGET)"
	@echo ""
	@echo "Test with: ./$(TARGET) -l"
	@echo ""

clean:
	rm -f $(TARGET)
	@echo "Cleaned build artifacts"

install:
	@echo "TMC is designed to run in place."
	@echo "Source midi.sh in your shell:"
	@echo "  source ~/tetra/bash/midi/midi.sh"

test:
	@echo "Testing tmc binary..."
	@./$(TARGET) -l || (echo "Build tmc first: make" && exit 1)

help:
	@echo "TMC Build System"
	@echo "================"
	@echo ""
	@echo "Targets:"
	@echo "  all     - Build tmc binary (default)"
	@echo "  clean   - Remove built files"
	@echo "  test    - Test tmc binary"
	@echo "  help    - Show this help"
	@echo ""
	@echo "Dependencies:"
	@echo "  macOS: brew install portmidi"
	@echo "  Linux: apt-get install libportmidi-dev"
	@echo ""
	@echo "Usage:"
	@echo "  make           # Build"
	@echo "  ./tmc -l       # List MIDI devices"
	@echo "  tmc help       # Show TMC help"
