/*
 * flaxd - Flax Graphics Co-processor
 *
 * Fast terminal rendering daemon for the Flax game engine.
 * Receives commands via stdin, renders to terminal.
 *
 * Build: gcc -O3 -o flaxd flaxd.c
 * Usage: flaxd < command_fifo
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdint.h>
#include <unistd.h>
#include <termios.h>
#include <sys/ioctl.h>
#include <sys/time.h>
#include <sys/select.h>
#include <signal.h>
#include <fcntl.h>
#include <errno.h>
#include <time.h>

/* ------------------------------------------------------------------------- */
/* Configuration                                                             */
/* ------------------------------------------------------------------------- */

#define MAX_SPRITES     256
#define MAX_BUFFER      (1024 * 1024)  /* 1MB buffer */
#define MAX_CMD_LEN     4096
#define MAX_CONTENT     8192

/* ------------------------------------------------------------------------- */
/* Data Structures                                                           */
/* ------------------------------------------------------------------------- */

typedef struct {
    int id;
    int x, y;
    int w, h;
    int z;
    int visible;
    int color;
    char content[MAX_CONTENT];
} Sprite;

typedef struct {
    /* Terminal state */
    struct termios orig_termios;
    int rows, cols;
    int raw_mode;

    /* Render buffer */
    char buffer[MAX_BUFFER];
    size_t buf_pos;

    /* Sprites */
    Sprite sprites[MAX_SPRITES];
    int sprite_count;
    int next_sprite_id;

    /* Timing */
    double target_fps;
    double tick_ms;
    uint64_t frame;
    struct timeval frame_start;
    double last_frame_time;
    double actual_fps;
    int fps_counter;
    time_t fps_time;

    /* Flags */
    int running;
    int debug;
} FlaxState;

static FlaxState G;  /* Global state */

/* ------------------------------------------------------------------------- */
/* Terminal Control                                                          */
/* ------------------------------------------------------------------------- */

static void term_get_size(int *rows, int *cols) {
    struct winsize ws;
    if (ioctl(STDOUT_FILENO, TIOCGWINSZ, &ws) == 0) {
        *rows = ws.ws_row;
        *cols = ws.ws_col;
    } else {
        *rows = 24;
        *cols = 80;
    }
}

static void term_raw_mode(void) {
    if (G.raw_mode) return;

    tcgetattr(STDIN_FILENO, &G.orig_termios);

    struct termios raw = G.orig_termios;
    raw.c_lflag &= ~(ECHO | ICANON);
    raw.c_cc[VMIN] = 0;
    raw.c_cc[VTIME] = 0;

    tcsetattr(STDIN_FILENO, TCSAFLUSH, &raw);
    G.raw_mode = 1;
}

static void term_restore(void) {
    if (!G.raw_mode) return;
    tcsetattr(STDIN_FILENO, TCSAFLUSH, &G.orig_termios);
    G.raw_mode = 0;
}

/* ------------------------------------------------------------------------- */
/* Buffer Operations                                                         */
/* ------------------------------------------------------------------------- */

static inline void buf_clear(void) {
    G.buf_pos = 0;
}

static inline void buf_add(const char *s) {
    size_t len = strlen(s);
    if (G.buf_pos + len < MAX_BUFFER) {
        memcpy(G.buffer + G.buf_pos, s, len);
        G.buf_pos += len;
    }
}

static inline void buf_addf(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    int len = vsnprintf(G.buffer + G.buf_pos, MAX_BUFFER - G.buf_pos, fmt, args);
    va_end(args);
    if (len > 0) G.buf_pos += len;
}

static void buf_flush(void) {
    if (G.buf_pos > 0) {
        write(STDOUT_FILENO, G.buffer, G.buf_pos);
        G.buf_pos = 0;
    }
}

static void buf_goto(int row, int col) {
    buf_addf("\033[%d;%dH", row, col);
}

static void buf_color(int c) {
    buf_addf("\033[38;5;%dm", c);
}

static void buf_bg(int c) {
    buf_addf("\033[48;5;%dm", c);
}

static void buf_reset(void) {
    buf_add("\033[0m");
}

static void buf_cursor_hide(void) {
    buf_add("\033[?25l");
}

static void buf_cursor_show(void) {
    buf_add("\033[?25h");
}

static void buf_screen_clear(void) {
    buf_add("\033[2J");
}

static void buf_alt_screen(void) {
    buf_add("\033[?1049h");
}

static void buf_main_screen(void) {
    buf_add("\033[?1049l");
}

/* ------------------------------------------------------------------------- */
/* Sprite Management                                                         */
/* ------------------------------------------------------------------------- */

static Sprite* sprite_find(int id) {
    for (int i = 0; i < G.sprite_count; i++) {
        if (G.sprites[i].id == id) return &G.sprites[i];
    }
    return NULL;
}

static int sprite_create(void) {
    if (G.sprite_count >= MAX_SPRITES) return -1;

    Sprite *s = &G.sprites[G.sprite_count++];
    s->id = ++G.next_sprite_id;
    s->x = 1;
    s->y = 1;
    s->w = 0;
    s->h = 0;
    s->z = 0;
    s->visible = 1;
    s->color = 0;
    s->content[0] = '\0';

    return s->id;
}

static void sprite_delete(int id) {
    for (int i = 0; i < G.sprite_count; i++) {
        if (G.sprites[i].id == id) {
            memmove(&G.sprites[i], &G.sprites[i+1],
                    (G.sprite_count - i - 1) * sizeof(Sprite));
            G.sprite_count--;
            return;
        }
    }
}

static void sprites_clear(void) {
    G.sprite_count = 0;
    G.next_sprite_id = 0;
}

/* Compare sprites by z-order for qsort */
static int sprite_cmp(const void *a, const void *b) {
    return ((Sprite*)a)->z - ((Sprite*)b)->z;
}

static void sprites_render(void) {
    /* Sort by z-order */
    qsort(G.sprites, G.sprite_count, sizeof(Sprite), sprite_cmp);

    /* Render each visible sprite */
    for (int i = 0; i < G.sprite_count; i++) {
        Sprite *s = &G.sprites[i];
        if (!s->visible || s->content[0] == '\0') continue;

        if (s->color > 0) buf_color(s->color);

        /* Render line by line */
        int row = s->y;
        const char *p = s->content;
        while (*p) {
            buf_goto(row, s->x);
            while (*p && *p != '\n') {
                char c[2] = {*p++, '\0'};
                buf_add(c);
            }
            if (*p == '\n') p++;
            row++;
        }

        if (s->color > 0) buf_reset();
    }
}

/* ------------------------------------------------------------------------- */
/* Debug Overlay                                                             */
/* ------------------------------------------------------------------------- */

static void render_debug(void) {
    buf_goto(1, 1);
    buf_color(226);
    buf_addf("FPS:%d Frame:%llu Time:%.1fms Sprites:%d Buf:%zu",
             (int)G.actual_fps, (unsigned long long)G.frame, G.last_frame_time,
             G.sprite_count, G.buf_pos);
    buf_reset();
}

/* ------------------------------------------------------------------------- */
/* Timing                                                                    */
/* ------------------------------------------------------------------------- */

static double get_time_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec * 1000.0 + tv.tv_usec / 1000.0;
}

static void update_fps(void) {
    time_t now = time(NULL);
    G.fps_counter++;
    if (now > G.fps_time) {
        G.actual_fps = G.fps_counter;
        G.fps_counter = 0;
        G.fps_time = now;
    }
}

/* ------------------------------------------------------------------------- */
/* Command Processing                                                        */
/* ------------------------------------------------------------------------- */

static void process_command(char *cmd) {
    char *args[16];
    int argc = 0;

    /* Parse command:arg1:arg2:... */
    char *p = strtok(cmd, ":");
    while (p && argc < 16) {
        args[argc++] = p;
        p = strtok(NULL, ":");
    }

    if (argc == 0) return;

    const char *op = args[0];

    /* Buffer operations */
    if (strcmp(op, "CLR") == 0) {
        buf_clear();
        printf("OK\n");
    }
    else if (strcmp(op, "FLUSH") == 0) {
        if (G.debug) render_debug();
        buf_flush();
        G.frame++;
        update_fps();

        double now = get_time_ms();
        G.last_frame_time = now - G.frame_start.tv_sec * 1000.0 - G.frame_start.tv_usec / 1000.0;
        gettimeofday(&G.frame_start, NULL);

        printf("OK\n");
    }
    else if (strcmp(op, "HOME") == 0) {
        buf_add("\033[H");
        printf("OK\n");
    }
    else if (strcmp(op, "GOTO") == 0 && argc >= 3) {
        buf_goto(atoi(args[1]), atoi(args[2]));
        printf("OK\n");
    }

    /* Drawing */
    else if (strcmp(op, "TEXT") == 0 && argc >= 5) {
        int row = atoi(args[1]);
        int col = atoi(args[2]);
        int color = atoi(args[3]);
        buf_goto(row, col);
        if (color > 0) buf_color(color);
        buf_add(args[4]);
        if (color > 0) buf_reset();
        printf("OK\n");
    }
    else if (strcmp(op, "RECT") == 0 && argc >= 6) {
        int row = atoi(args[1]);
        int col = atoi(args[2]);
        int w = atoi(args[3]);
        int h = atoi(args[4]);
        int color = atoi(args[5]);

        if (color > 0) buf_color(color);

        /* Top */
        buf_goto(row, col);
        buf_add("┌");
        for (int i = 0; i < w-2; i++) buf_add("─");
        buf_add("┐");

        /* Sides */
        for (int i = 1; i < h-1; i++) {
            buf_goto(row+i, col);
            buf_add("│");
            buf_goto(row+i, col+w-1);
            buf_add("│");
        }

        /* Bottom */
        buf_goto(row+h-1, col);
        buf_add("└");
        for (int i = 0; i < w-2; i++) buf_add("─");
        buf_add("┘");

        if (color > 0) buf_reset();
        printf("OK\n");
    }

    /* Colors */
    else if (strcmp(op, "FG") == 0 && argc >= 2) {
        buf_color(atoi(args[1]));
        printf("OK\n");
    }
    else if (strcmp(op, "BG") == 0 && argc >= 2) {
        buf_bg(atoi(args[1]));
        printf("OK\n");
    }
    else if (strcmp(op, "RESET") == 0) {
        buf_reset();
        printf("OK\n");
    }

    /* Sprites */
    else if (strcmp(op, "SCREATE") == 0) {
        int id = sprite_create();
        printf("OK:%d\n", id);
    }
    else if (strcmp(op, "STEXT") == 0 && argc >= 7) {
        int id = sprite_create();
        Sprite *s = sprite_find(id);
        if (s) {
            s->y = atoi(args[1]);
            s->x = atoi(args[2]);
            s->z = atoi(args[3]);
            s->color = atoi(args[4]);
            strncpy(s->content, args[5], MAX_CONTENT-1);
            s->w = strlen(args[5]);
            s->h = 1;
        }
        printf("OK:%d\n", id);
    }
    else if (strcmp(op, "SMOVE") == 0 && argc >= 4) {
        Sprite *s = sprite_find(atoi(args[1]));
        if (s) {
            s->y = atoi(args[2]);
            s->x = atoi(args[3]);
        }
        printf("OK\n");
    }
    else if (strcmp(op, "SZ") == 0 && argc >= 3) {
        Sprite *s = sprite_find(atoi(args[1]));
        if (s) s->z = atoi(args[2]);
        printf("OK\n");
    }
    else if (strcmp(op, "SSHOW") == 0 && argc >= 2) {
        Sprite *s = sprite_find(atoi(args[1]));
        if (s) s->visible = 1;
        printf("OK\n");
    }
    else if (strcmp(op, "SHIDE") == 0 && argc >= 2) {
        Sprite *s = sprite_find(atoi(args[1]));
        if (s) s->visible = 0;
        printf("OK\n");
    }
    else if (strcmp(op, "SCONTENT") == 0 && argc >= 3) {
        Sprite *s = sprite_find(atoi(args[1]));
        if (s) {
            /* TODO: base64 decode for newlines */
            strncpy(s->content, args[2], MAX_CONTENT-1);
        }
        printf("OK\n");
    }
    else if (strcmp(op, "SDELETE") == 0 && argc >= 2) {
        sprite_delete(atoi(args[1]));
        printf("OK\n");
    }
    else if (strcmp(op, "SCLEAR") == 0) {
        sprites_clear();
        printf("OK\n");
    }
    else if (strcmp(op, "SRENDER") == 0) {
        sprites_render();
        printf("OK\n");
    }

    /* Screen control */
    else if (strcmp(op, "INIT") == 0) {
        term_raw_mode();
        term_get_size(&G.rows, &G.cols);
        buf_alt_screen();
        buf_cursor_hide();
        buf_screen_clear();
        buf_flush();
        gettimeofday(&G.frame_start, NULL);
        G.fps_time = time(NULL);
        printf("OK\n");
    }
    else if (strcmp(op, "CLEANUP") == 0) {
        buf_clear();
        buf_cursor_show();
        buf_reset();
        buf_main_screen();
        buf_flush();
        term_restore();
        printf("OK\n");
    }
    else if (strcmp(op, "SIZE") == 0) {
        term_get_size(&G.rows, &G.cols);
        printf("OK:%d:%d\n", G.rows, G.cols);
    }

    /* Timing */
    else if (strcmp(op, "FPS") == 0 && argc >= 2) {
        G.target_fps = atof(args[1]);
        G.tick_ms = 1000.0 / G.target_fps;
        printf("OK\n");
    }
    else if (strcmp(op, "FRAME") == 0) {
        printf("OK:%llu\n", (unsigned long long)G.frame);
    }
    else if (strcmp(op, "METRICS") == 0) {
        printf("OK:%.1f:%.1f:%d:%zu\n",
               G.actual_fps, G.last_frame_time,
               G.sprite_count, G.buf_pos);
    }
    else if (strcmp(op, "DEBUG") == 0 && argc >= 2) {
        G.debug = atoi(args[1]);
        printf("OK\n");
    }

    /* Input */
    else if (strcmp(op, "KEY") == 0) {
        int timeout_ms = argc >= 2 ? atoi(args[1]) : 0;

        fd_set fds;
        struct timeval tv;
        FD_ZERO(&fds);
        FD_SET(STDIN_FILENO, &fds);
        tv.tv_sec = timeout_ms / 1000;
        tv.tv_usec = (timeout_ms % 1000) * 1000;

        if (select(STDIN_FILENO + 1, &fds, NULL, NULL, &tv) > 0) {
            char c;
            if (read(STDIN_FILENO, &c, 1) == 1) {
                printf("OK:%c\n", c);
            } else {
                printf("OK:\n");
            }
        } else {
            printf("OK:\n");
        }
    }

    /* Quit */
    else if (strcmp(op, "QUIT") == 0) {
        G.running = 0;
        printf("OK\n");
    }

    else {
        printf("ERR:Unknown command: %s\n", op);
    }

    fflush(stdout);
}

/* ------------------------------------------------------------------------- */
/* Signal Handling                                                           */
/* ------------------------------------------------------------------------- */

static void handle_signal(int sig) {
    (void)sig;
    G.running = 0;
}

/* ------------------------------------------------------------------------- */
/* Main                                                                      */
/* ------------------------------------------------------------------------- */

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;

    /* Initialize state */
    memset(&G, 0, sizeof(G));
    G.running = 1;
    G.target_fps = 30;
    G.tick_ms = 33.3;

    /* Setup signal handlers */
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    signal(SIGPIPE, SIG_IGN);

    /* Make stdin non-blocking for command reading */
    int flags = fcntl(STDIN_FILENO, F_GETFL, 0);
    fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);

    fprintf(stderr, "flaxd started\n");

    /* Main loop - read commands from stdin */
    char cmd[MAX_CMD_LEN];
    while (G.running) {
        if (fgets(cmd, sizeof(cmd), stdin)) {
            /* Remove newline */
            cmd[strcspn(cmd, "\n")] = '\0';
            if (cmd[0]) {
                process_command(cmd);
            }
        } else {
            /* No input, small sleep to avoid busy loop */
            usleep(1000);
            clearerr(stdin);
        }
    }

    /* Cleanup */
    if (G.raw_mode) {
        buf_cursor_show();
        buf_reset();
        buf_main_screen();
        buf_flush();
        term_restore();
    }

    fprintf(stderr, "flaxd stopped\n");
    return 0;
}
