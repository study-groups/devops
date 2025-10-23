# Estovox Facial Animation Engine Makefile
#
# Build system for real-time facial animation and IPA articulation

# Compiler and flags
CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -O3 -march=native
CFLAGS_DEBUG = -std=c11 -Wall -Wextra -g -O0 -DDEBUG
INCLUDES = -I./include
LIBS = -lm

# Directories
SRC_DIR = src
INC_DIR = include
BIN_DIR = bin
OBJ_DIR = obj

# Target binary
TARGET = $(BIN_DIR)/estovox

# Source files
SRCS = $(wildcard $(SRC_DIR)/*.c)
OBJS = $(patsubst $(SRC_DIR)/%.c,$(OBJ_DIR)/%.o,$(SRCS))

# Header files
HDRS = $(wildcard $(INC_DIR)/*.h)

# Platform detection
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
    # macOS - no special flags needed for terminal I/O
    CFLAGS += -D_DARWIN_C_SOURCE
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

# Run estovox
run: $(TARGET)
	$(TARGET)

# Help target
help:
	@echo "Estovox Facial Animation Engine"
	@echo ""
	@echo "Targets:"
	@echo "  all     - Build estovox binary (default)"
	@echo "  debug   - Build with debug symbols"
	@echo "  clean   - Remove build artifacts"
	@echo "  run     - Build and run estovox"
	@echo "  help    - Show this help"

.PHONY: all debug clean run help
