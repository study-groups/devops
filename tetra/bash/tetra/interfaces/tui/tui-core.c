/*
 * tetra-tui-core.c - Event multiplexer for Tetra TUI
 *
 * Handles terminal setup, input multiplexing, and frame timing.
 * Spawns osc_listen for MIDI multicast input.
 * Outputs typed events to stdout for bash to process.
 *
 * Build: cc -O2 -o tui-core tui-core.c
 * Usage: ./tui-core [osc_listen_path]
 *
 * Events emitted:
 *   K:<key>     - Keyboard input (escape sequences preserved)
 *   M:<line>    - MIDI message from osc_listen
 *   F:          - Frame tick (60fps when idle)
 *   S:<w>x<h>   - Screen size (on start and SIGWINCH)
 *   Q:          - Quit signal received
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <termios.h>
#include <signal.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/select.h>
#include <sys/wait.h>
#include <sys/ioctl.h>
#include <time.h>

#define FRAME_US 16666  /* ~60fps */
#define KEY_BUF_SIZE 32
#define LINE_BUF_SIZE 2048
#define DEFAULT_OSC_LISTEN "osc_listen"

static struct termios orig_termios;
static volatile sig_atomic_t running = 1;
static volatile sig_atomic_t resize_pending = 0;
static int terminal_initialized = 0;
static pid_t osc_listen_pid = -1;
static int tty_fd = -1;  /* /dev/tty for keyboard input */

/* Restore terminal on exit */
static void restore_terminal(void) {
    if (terminal_initialized) {
        /* Show cursor, restore screen, reset attributes */
        write(tty_fd, "\033[?25h\033[?1049l\033[0m", 18);
        tcsetattr(tty_fd, TCSAFLUSH, &orig_termios);
        terminal_initialized = 0;
    }
    if (tty_fd >= 0 && tty_fd != STDIN_FILENO) {
        close(tty_fd);
        tty_fd = -1;
    }
}

/* Signal handlers */
static void handle_signal(int sig) {
    (void)sig;
    running = 0;
}

static void handle_winch(int sig) {
    (void)sig;
    resize_pending = 1;
}

/* Initialize terminal for raw input */
static int init_terminal(void) {
    struct termios raw;

    /* Open /dev/tty directly to bypass stdin redirection */
    tty_fd = open("/dev/tty", O_RDWR);
    if (tty_fd < 0) {
        perror("open /dev/tty");
        return -1;
    }

    if (tcgetattr(tty_fd, &orig_termios) < 0) {
        perror("tcgetattr");
        close(tty_fd);
        return -1;
    }

    raw = orig_termios;
    /* Raw mode: no echo, no canonical, no signals */
    raw.c_lflag &= ~(ECHO | ICANON | ISIG | IEXTEN);
    raw.c_iflag &= ~(IXON | ICRNL | BRKINT | INPCK | ISTRIP);
    raw.c_oflag &= ~(OPOST);
    raw.c_cflag |= CS8;
    raw.c_cc[VMIN] = 0;   /* Non-blocking */
    raw.c_cc[VTIME] = 0;

    if (tcsetattr(tty_fd, TCSAFLUSH, &raw) < 0) {
        perror("tcsetattr");
        close(tty_fd);
        return -1;
    }

    terminal_initialized = 1;
    atexit(restore_terminal);

    /* Alternate screen buffer, hide cursor */
    write(tty_fd, "\033[?1049h\033[?25l", 14);

    return 0;
}

/* Get terminal size */
static void get_terminal_size(int *width, int *height) {
    struct winsize ws;
    if (ioctl(tty_fd, TIOCGWINSZ, &ws) == 0) {
        *width = ws.ws_col;
        *height = ws.ws_row;
    } else {
        *width = 80;
        *height = 24;
    }
}

/* Spawn osc_listen and return read fd */
static int spawn_osc_listen(const char *path) {
    int pipefd[2];

    if (pipe(pipefd) < 0) {
        return -1;
    }

    pid_t pid = fork();
    if (pid < 0) {
        close(pipefd[0]);
        close(pipefd[1]);
        return -1;
    }

    if (pid == 0) {
        /* Child: run osc_listen */
        close(pipefd[0]);  /* Close read end */
        dup2(pipefd[1], STDOUT_FILENO);  /* Redirect stdout to pipe */
        close(pipefd[1]);

        /* Keep stderr for debugging (goes to parent's stderr) */

        /* Use execl with full path */
        execl(path, path, (char *)NULL);
        _exit(127);  /* exec failed */
    }

    /* Parent */
    close(pipefd[1]);  /* Close write end */
    osc_listen_pid = pid;

    /* Set non-blocking */
    int flags = fcntl(pipefd[0], F_GETFL, 0);
    fcntl(pipefd[0], F_SETFL, flags | O_NONBLOCK);

    return pipefd[0];
}

/* Cleanup osc_listen child */
static void cleanup_osc_listen(int fd) {
    if (fd >= 0) {
        close(fd);
    }
    if (osc_listen_pid > 0) {
        kill(osc_listen_pid, SIGTERM);
        waitpid(osc_listen_pid, NULL, WNOHANG);
        osc_listen_pid = -1;
    }
}

/* Read keyboard input, handle escape sequences */
static int read_keyboard(char *buf, size_t bufsize) {
    ssize_t n = read(tty_fd, buf, bufsize - 1);
    if (n <= 0) return 0;

    buf[n] = '\0';

    /* If escape, try to read more (arrow keys, etc) */
    if (n == 1 && buf[0] == '\033') {
        usleep(1000);  /* 1ms delay for escape sequence */
        ssize_t m = read(tty_fd, buf + 1, bufsize - 2);
        if (m > 0) {
            n += m;
            buf[n] = '\0';
        }
    }

    return (int)n;
}

/* Read line from pipe - simple version using getline-style */
static int read_pipe_line(int fd, char *buf, size_t bufsize) {
    static char pbuf[4096];  /* Larger buffer */
    static size_t pbuf_len = 0;

    /* Try to read more data */
    if (pbuf_len < sizeof(pbuf) - 1) {
        ssize_t n = read(fd, pbuf + pbuf_len, sizeof(pbuf) - pbuf_len - 1);
        if (n > 0) {
            pbuf_len += n;
            pbuf[pbuf_len] = '\0';
        } else if (n == 0) {
            return -1;  /* EOF - osc_listen died */
        } else if (errno != EAGAIN && errno != EWOULDBLOCK) {
            return -1;  /* Error */
        }
    }

    /* Look for newline */
    char *nl = memchr(pbuf, '\n', pbuf_len);
    if (nl) {
        size_t line_len = nl - pbuf;
        if (line_len >= bufsize) line_len = bufsize - 1;
        memcpy(buf, pbuf, line_len);
        buf[line_len] = '\0';

        /* Shift buffer - calculate remaining safely */
        size_t consumed = (nl - pbuf) + 1;
        if (consumed <= pbuf_len) {
            size_t remaining = pbuf_len - consumed;
            if (remaining > 0) {
                memmove(pbuf, nl + 1, remaining);
            }
            pbuf_len = remaining;
        } else {
            pbuf_len = 0;  /* Safety: clear buffer */
        }

        return (int)line_len;
    }

    return 0;  /* No complete line yet */
}

/* Get current time in microseconds */
static long long now_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000000LL + ts.tv_nsec / 1000;
}

/* Escape special characters for output */
static void print_escaped(const char *prefix, const char *data, size_t len) {
    printf("%s:", prefix);
    for (size_t i = 0; i < len; i++) {
        unsigned char c = data[i];
        if (c == '\n') {
            printf("\\n");
        } else if (c == '\r') {
            printf("\\r");
        } else if (c == '\\') {
            printf("\\\\");
        } else if (c < 32 || c == 127) {
            printf("\\x%02x", c);
        } else {
            putchar(c);
        }
    }
    putchar('\n');
    fflush(stdout);
}

int main(int argc, char *argv[]) {
    const char *osc_path = (argc > 1) ? argv[1] : NULL;
    int midi_fd = -1;
    int midi_enabled = 0;
    char key_buf[KEY_BUF_SIZE];
    char line_buf[LINE_BUF_SIZE];
    int width, height;
    long long last_frame = 0;

    /* Setup signal handlers */
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    signal(SIGWINCH, handle_winch);
    signal(SIGPIPE, SIG_IGN);
    signal(SIGCHLD, SIG_IGN);  /* Don't trap on child exit */

    /* Initialize terminal */
    if (init_terminal() < 0) {
        fprintf(stderr, "Failed to initialize terminal\n");
        return 1;
    }

    /* Output initial size */
    get_terminal_size(&width, &height);
    printf("S:%dx%d\n", width, height);
    fflush(stdout);

    /* Spawn osc_listen for MIDI multicast (optional) */
    if (osc_path && access(osc_path, X_OK) == 0) {
        midi_fd = spawn_osc_listen(osc_path);
        midi_enabled = (midi_fd >= 0);
    }

    /* Main event loop */
    while (running) {
        fd_set read_fds;
        struct timeval tv;
        int max_fd = tty_fd;
        long long now = now_us();
        long long until_frame = FRAME_US - (now - last_frame);

        if (until_frame < 0) until_frame = 0;
        if (until_frame > FRAME_US) until_frame = FRAME_US;

        tv.tv_sec = until_frame / 1000000;
        tv.tv_usec = until_frame % 1000000;

        FD_ZERO(&read_fds);
        FD_SET(tty_fd, &read_fds);
        if (midi_fd >= 0) {
            FD_SET(midi_fd, &read_fds);
            if (midi_fd > max_fd) max_fd = midi_fd;
        }

        int ready = select(max_fd + 1, &read_fds, NULL, NULL, &tv);

        /* Handle resize */
        if (resize_pending) {
            resize_pending = 0;
            get_terminal_size(&width, &height);
            printf("S:%dx%d\n", width, height);
            fflush(stdout);
        }

        if (ready < 0) {
            if (errno == EINTR) continue;
            break;
        }

        /* Keyboard input */
        if (FD_ISSET(tty_fd, &read_fds)) {
            int n = read_keyboard(key_buf, sizeof(key_buf));
            if (n > 0) {
                /* Check for quit key */
                if (n == 1 && (key_buf[0] == 'q' || key_buf[0] == 'Q')) {
                    running = 0;
                    break;
                }
                print_escaped("K", key_buf, n);
            }
        }

        /* MIDI from osc_listen pipe */
        if (midi_fd >= 0 && FD_ISSET(midi_fd, &read_fds)) {
            int n;
            while ((n = read_pipe_line(midi_fd, line_buf, sizeof(line_buf))) > 0) {
                /* Emit all non-empty lines */
                if (line_buf[0] != '\0') {
                    printf("M:%s\n", line_buf);
                    fflush(stdout);
                }
            }
            if (n < 0 && midi_enabled) {
                /* osc_listen died, try to respawn */
                cleanup_osc_listen(midi_fd);
                midi_fd = spawn_osc_listen(osc_path);
            }
        }

        /* Update frame timer (no output - just for select timing) */
        now = now_us();
        if (now - last_frame >= FRAME_US) {
            last_frame = now;
        }
    }

    /* Cleanup */
    printf("Q:\n");
    fflush(stdout);

    cleanup_osc_listen(midi_fd);
    restore_terminal();
    return 0;
}
