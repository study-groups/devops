# PULSAR Slot Engine Makefile

CC = gcc
CFLAGS = -O2 -Wall -Wextra
LDFLAGS = -lm

SRC_DIR = src
BIN_DIR = bin

# Slot engine (256 concurrent matches, stdin/stdout protocol)
TARGET = $(BIN_DIR)/pulsar_slots
SOURCE = $(SRC_DIR)/pulsar_slots.c

.PHONY: all clean

all: $(TARGET)

$(BIN_DIR):
	@mkdir -p $(BIN_DIR)

$(TARGET): $(SOURCE) | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
	@echo "Built: $@"

clean:
	rm -f $(TARGET)

test: $(TARGET)
	@echo "Testing pulsar_slots..."
	@echo "PING" | $(TARGET) 2>/dev/null | grep -q "PONG" && echo "PING: OK" || echo "PING: FAIL"
	@echo -e "0 INIT 60 24 15\nSLOTS\nQUIT" | $(TARGET) 2>/dev/null | head -5
