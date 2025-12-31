# Pulsar Game Engine Makefile
# Modular architecture with layout, UI, input, and rendering subsystems

CC = cc
CFLAGS = -O3 -std=c99 -Wall -Wextra -pedantic
LDFLAGS = -lm
SRC_DIR = src
BIN_DIR = bin
TARGET = $(BIN_DIR)/pulsar

# Source files - modular architecture
SOURCES = $(SRC_DIR)/pulsar.c \
          $(SRC_DIR)/layout.c \
          $(SRC_DIR)/ui.c \
          $(SRC_DIR)/input.c \
          $(SRC_DIR)/render.c \
          $(SRC_DIR)/utils.c \
          $(SRC_DIR)/toml.c \
          $(SRC_DIR)/tgp.c \
          $(SRC_DIR)/osc.c \
          $(SRC_DIR)/collision.c \
          $(SRC_DIR)/osc_send.c

# Object files
OBJECTS = $(SOURCES:.c=.o)

# Header dependencies
HEADERS = $(SRC_DIR)/types.h \
          $(SRC_DIR)/layout.h \
          $(SRC_DIR)/ui.h \
          $(SRC_DIR)/input.h \
          $(SRC_DIR)/render.h \
          $(SRC_DIR)/utils.h \
          $(SRC_DIR)/tgp.h \
          $(SRC_DIR)/osc.h \
          $(SRC_DIR)/collision.h \
          $(SRC_DIR)/osc_send.h

# Default target
all: $(TARGET)

# Create bin directory if needed
$(BIN_DIR):
	@mkdir -p $(BIN_DIR)

# Build pulsar binary
$(TARGET): $(OBJECTS) | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	@echo "Built: $(TARGET)"

# Compile object files with header dependencies
%.o: %.c $(HEADERS)
	$(CC) $(CFLAGS) -c $< -o $@

# Clean build artifacts
clean:
	rm -f $(TARGET) $(OBJECTS)
	@echo "Cleaned build artifacts"

# Install (copy to bin)
install: all
	@echo "Pulsar engine ready at $(TARGET)"

# Test the binary
test: $(TARGET)
	@echo "Testing Pulsar engine..."
	@echo "QUIT" | $(TARGET)

.PHONY: all clean install test
