# Flax Engine - Build C accelerator

CC = gcc
CFLAGS = -O3 -Wall -Wextra -std=c11
SRCDIR = src
BINDIR = bin

.PHONY: all clean install

all: $(BINDIR)/flaxd

$(BINDIR)/flaxd: $(SRCDIR)/flaxd.c | $(BINDIR)
	$(CC) $(CFLAGS) -o $@ $<

$(BINDIR):
	mkdir -p $(BINDIR)

clean:
	rm -rf $(BINDIR)

install: $(BINDIR)/flaxd
	@echo "flaxd built at $(BINDIR)/flaxd"
	@echo "Flax will auto-detect and use it when available"

# Debug build
debug: CFLAGS = -g -Wall -Wextra -std=c11 -DDEBUG
debug: clean $(BINDIR)/flaxd

# Run tests
test: $(BINDIR)/flaxd
	@echo "Testing flaxd..."
	@echo -e "INIT\nSIZE\nTEXT:5:10:46:Hello World\nFLUSH\nCLEANUP\nQUIT" | ./$(BINDIR)/flaxd
