# Formant Synthesis Engine Makefile
#
# Build system for formant real-time audio synthesis engine
# Requires: PortAudio v19+, libm, pthreads

# Compiler and flags
CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -O3 -march=native -ffast-math
CFLAGS_DEBUG = -std=c11 -Wall -Wextra -g -O0 -DDEBUG
INCLUDES = -I./include
LIBS = -lportaudio -lm -lpthread

# Directories
SRC_DIR = src
INC_DIR = include
BIN_DIR = bin
OBJ_DIR = obj

# Target binary
TARGET = $(BIN_DIR)/formant

# Source files
SRCS = $(wildcard $(SRC_DIR)/*.c)
OBJS = $(patsubst $(SRC_DIR)/%.c,$(OBJ_DIR)/%.o,$(SRCS))

# Header files
HDRS = $(wildcard $(INC_DIR)/*.h)

# Platform detection
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
    # macOS
    CFLAGS += -I/opt/homebrew/include -I/usr/local/include
    LIBS += -L/opt/homebrew/lib -L/usr/local/lib
endif

# Default target
all: $(TARGET)

# Create directories
$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

# Build object files
$(OBJ_DIR)/%.o: $(SRC_DIR)/%.c $(HDRS) | $(OBJ_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# Link executable
$(TARGET): $(OBJS) | $(BIN_DIR)
	$(CC) $(OBJS) $(LIBS) -o $@
	@echo "Built: $(TARGET)"

# Debug build
debug: CFLAGS = $(CFLAGS_DEBUG)
debug: clean $(TARGET)

# Clean build artifacts
clean:
	rm -rf $(OBJ_DIR) $(BIN_DIR)
	@echo "Cleaned build artifacts"

# Install to tetra directory
install: $(TARGET)
	cp $(TARGET) $(TETRA_SRC)/bash/game/games/formant/bin/
	@echo "Installed to $(TETRA_SRC)/bash/game/games/formant/bin/"

# Run tests
test: $(TARGET)
	./test_formant.sh

# Check for PortAudio
check-deps:
	@echo "Checking dependencies..."
	@which pkg-config > /dev/null || (echo "ERROR: pkg-config not found" && exit 1)
	@pkg-config --exists portaudio-2.0 || (echo "ERROR: PortAudio not found. Install with: brew install portaudio" && exit 1)
	@echo "All dependencies found!"

# Help target
help:
	@echo "Formant Synthesis Engine Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all         - Build formant binary (default)"
	@echo "  debug       - Build with debug symbols"
	@echo "  clean       - Remove build artifacts"
	@echo "  install     - Install to TETRA_SRC directory"
	@echo "  test        - Run test suite"
	@echo "  check-deps  - Check for required dependencies"
	@echo "  help        - Show this help"
	@echo ""
	@echo "Dependencies:"
	@echo "  - PortAudio v19+ (brew install portaudio)"
	@echo "  - libm (math library)"
	@echo "  - pthreads"

.PHONY: all debug clean install test check-deps help
