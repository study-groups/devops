/*
 * Pulsar Engine - Modular terminal sprite engine
 * Main engine coordinator using modular components
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <math.h>
#include <fcntl.h>
#include <errno.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <sys/resource.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#include <sys/time.h>
#include <termios.h>

/* Module headers */
#include "types.h"
#include "layout.h"
#include "ui.h"
#include "input.h"
#include "render.h"
#include "utils.h"

/* ========================================================================
 * GLOBAL STATE
 * ======================================================================== */

/* Sprite pool */
static Sprite sprites[MAX_SPRITES];
static int next_id = 1;

/* Engine state */
static int running = 0;
static FILE *tty = NULL;
static volatile sig_atomic_t window_resized = 0;
static int command_check_interval = 10;  /* Check stdin every N frames (lower = more responsive, more flicker) */

/* Event log (shared with utils.c) */
Event event_log[MAX_EVENT_LOG];
int event_log_head = 0;

/* Player accounts (PUID system) */
static PUID_Account player_accounts[MAX_PLAYERS];

/* CPU usage tracking */
static struct rusage last_rusage;
static uint64_t last_wall_time_ns = 0;
static float cpu_usage_percent = 0.0f;

/* Module contexts */
static UIContext ui_ctx;
static InputManager input_mgr;
static RenderContext render_ctx;

/* Child process management */
static ChildProcess child_processes[MAX_CHILD_PROCESSES];
static int child_count = 0;

/* ========================================================================
 * SIGNAL HANDLERS
 * ======================================================================== */

/* Handle window resize signal */
static void sigwinch_handler(int sig) {
    (void)sig;
    window_resized = 1;
}

/* Check and handle terminal resize */
static void check_window_resize(void) {
    if (!window_resized) return;
    window_resized = 0;

    /* Get new terminal size - try tty first, then stderr */
    struct winsize ws;
    int fd = tty ? fileno(tty) : STDERR_FILENO;

    if (ioctl(fd, TIOCGWINSZ, &ws) == 0 && ws.ws_col > 0 && ws.ws_row > 0) {
        int new_cols = ws.ws_col;
        int new_rows = ws.ws_row;

        /* Only resize if dimensions actually changed */
        if (new_cols != ui_ctx.layout.cols || new_rows != ui_ctx.layout.rows) {
            /* Update layout and render context */
            ui_resize(&ui_ctx, new_cols, new_rows);
            render_resize(&render_ctx, new_cols, new_rows);

            /* Log resize event */
            char resize_msg[64];
            snprintf(resize_msg, sizeof(resize_msg), "Resized to %dx%d", new_cols, new_rows);
            log_event("SYSTEM", 0, resize_msg);

            /* Clear screen completely and reset cursor */
            if (tty) {
                fprintf(tty, "\033[2J");      /* Clear entire screen */
                fprintf(tty, "\033[3J");      /* Clear scrollback */
                fprintf(tty, "\033[H");       /* Home cursor */
                fprintf(tty, "\033[?25l");    /* Hide cursor */
                fflush(tty);
            }
        }
    }
}

/* ========================================================================
 * UTILITY FUNCTIONS
 * ======================================================================== */

/* Count active sprites (uses utils helper) */
static int sprite_count(void) {
    return sprite_count_helper(sprites, MAX_SPRITES);
}

/* Allocate a new sprite slot */
static int alloc_sprite(void) {
    for (int i = 0; i < MAX_SPRITES; i++) {
        if (!sprites[i].active) {
            sprites[i].active = 1;
            sprites[i].id = next_id++;
            return i;
        }
    }
    return -1;
}

/* Find sprite by ID */
static int find_sprite(int id) {
    for (int i = 0; i < MAX_SPRITES; i++) {
        if (sprites[i].active && sprites[i].id == id) {
            return i;
        }
    }
    return -1;
}

/* Initialize sprite array */
static void init_sprites(void) {
    memset(sprites, 0, sizeof(sprites));
}

/* Initialize event log */
static void init_event_log(void) {
    memset(event_log, 0, sizeof(event_log));
    event_log_head = 0;
}

/* Initialize player accounts with anonymous IDs */
static void init_player_accounts(void) {
    memset(player_accounts, 0, sizeof(player_accounts));
    uint64_t base_time = now_ns();
    for (int i = 0; i < MAX_PLAYERS; i++) {
        player_accounts[i].puid = base_time + i;
        player_accounts[i].score = 0;
        player_accounts[i].tokens = 0;
        player_accounts[i].credits = 0;
        snprintf(player_accounts[i].username, sizeof(player_accounts[i].username),
                 "Player%d", i);
        player_accounts[i].created_at = base_time;
    }
}

/* ========================================================================
 * PROCESS MANAGER - Child process tracking
 * ======================================================================== */

/* Spawn a child process and track it */
static pid_t spawn_child_process(const char *name, char *const argv[]) {
    if (child_count >= MAX_CHILD_PROCESSES) {
        fprintf(stderr, "ERROR: Maximum child processes reached\n");
        return -1;
    }

    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return -1;
    }

    if (pid == 0) {
        /* Child process - redirect stdout/stderr to /dev/null */
        int devnull = open("/dev/null", O_WRONLY);
        if (devnull >= 0) {
            dup2(devnull, STDOUT_FILENO);
            dup2(devnull, STDERR_FILENO);
            close(devnull);
        }
        execvp(argv[0], argv);
        perror("execvp");
        exit(1);
    }

    /* Parent - track the child */
    ChildProcess *proc = &child_processes[child_count++];
    proc->pid = pid;
    proc->active = 1;
    strncpy(proc->name, name, sizeof(proc->name) - 1);
    proc->name[sizeof(proc->name) - 1] = '\0';

    /* Build command string */
    proc->cmd[0] = '\0';
    for (int i = 0; argv[i] != NULL && i < 10; i++) {
        strncat(proc->cmd, argv[i], sizeof(proc->cmd) - strlen(proc->cmd) - 1);
        if (argv[i+1] != NULL) {
            strncat(proc->cmd, " ", sizeof(proc->cmd) - strlen(proc->cmd) - 1);
        }
    }

    char log_msg[128];
    snprintf(log_msg, sizeof(log_msg), "Spawned %s (PID: %d)", name, pid);
    log_event("SYSTEM", 0, log_msg);

    return pid;
}

/* Cleanup all child processes */
static void cleanup_child_processes(void) {
    for (int i = 0; i < child_count; i++) {
        if (child_processes[i].active && child_processes[i].pid > 0) {
            kill(child_processes[i].pid, SIGTERM);
            waitpid(child_processes[i].pid, NULL, WNOHANG);
            child_processes[i].active = 0;
        }
    }
}

/* Spawn gamepad sender process */
static pid_t spawn_gamepad_sender(const char *socket_path) {
    /* Check if sender exists */
    struct stat st;
    const char *sender_path = "gamepad/sender";
    if (stat(sender_path, &st) != 0) {
        fprintf(stderr, "WARNING: gamepad sender not found at %s\n", sender_path);
        return -1;
    }

    char *argv[] = {
        (char*)sender_path,
        (char*)socket_path,
        NULL
    };

    return spawn_child_process("gamepad_sender", argv);
}

/* ========================================================================
 * CPU USAGE TRACKING
 * ======================================================================== */

static void update_cpu_usage(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);

    uint64_t now = now_ns();
    uint64_t wall_delta_ns = now - last_wall_time_ns;

    if (wall_delta_ns > 0) {
        uint64_t user_delta_ns =
            (ru.ru_utime.tv_sec - last_rusage.ru_utime.tv_sec) * 1000000000ULL +
            (ru.ru_utime.tv_usec - last_rusage.ru_utime.tv_usec) * 1000ULL;
        uint64_t sys_delta_ns =
            (ru.ru_stime.tv_sec - last_rusage.ru_stime.tv_sec) * 1000000000ULL +
            (ru.ru_stime.tv_usec - last_rusage.ru_stime.tv_usec) * 1000ULL;

        cpu_usage_percent = 100.0f * (user_delta_ns + sys_delta_ns) / wall_delta_ns;
    }

    last_rusage = ru;
    last_wall_time_ns = now;

    ui_set_cpu_usage(&ui_ctx, cpu_usage_percent);
}

/* ========================================================================
 * SPRITE UPDATE
 * ======================================================================== */

static void update_sprites(float dt) {
    for (int i = 0; i < MAX_SPRITES; i++) {
        if (!sprites[i].active) continue;

        sprites[i].theta += sprites[i].dtheta * dt;
        sprites[i].phase += sprites[i].freq * dt * 2.0f * M_PI;

        /* Keep angles in range */
        while (sprites[i].theta > M_PI) sprites[i].theta -= 2.0f * M_PI;
        while (sprites[i].theta < -M_PI) sprites[i].theta += 2.0f * M_PI;
        while (sprites[i].phase > M_PI) sprites[i].phase -= 2.0f * M_PI;
        while (sprites[i].phase < -M_PI) sprites[i].phase += 2.0f * M_PI;
    }
}

/* ========================================================================
 * RENDERING
 * ======================================================================== */

static void render_frame(void) {
    /* Clear screen */
    ui_clear_screen(&ui_ctx);

    /* Render sprites in play area */
    LayoutRegion play_area = layout_get_play_area(&ui_ctx.layout);
    render_sprites(&render_ctx, sprites, MAX_SPRITES, &play_area);

    /* Draw UI panels */
    ui_draw_panels(&ui_ctx, sprites, sprite_count(),
                   input_mgr.gamepads, event_log, event_log_head,
                   player_accounts, &input_mgr.kbd_state);

    /* Draw pause indicator if paused */
    if (ui_ctx.paused) {
        ui_draw_pause_indicator(&ui_ctx);
    }

    /* Flush output */
    fflush(tty);
}

/* ========================================================================
 * INPUT HANDLING
 * ======================================================================== */

/* Try to read a command from stdin (non-blocking)
 * Returns: command string if available, NULL otherwise */
static char* try_read_command(void) {
    static char buffer[1024];

    /* Check if data available without blocking */
    fd_set readfds;
    struct timeval timeout = {0, 0};  /* Don't wait */

    FD_ZERO(&readfds);
    FD_SET(STDIN_FILENO, &readfds);

    int ready = select(STDIN_FILENO + 1, &readfds, NULL, NULL, &timeout);

    if (ready > 0 && FD_ISSET(STDIN_FILENO, &readfds)) {
        /* Data available, try to read */
        if (fgets(buffer, sizeof(buffer), stdin)) {
            buffer[strcspn(buffer, "\n")] = 0;  /* Remove newline */
            if (strlen(buffer) > 0) {
                return buffer;
            }
        }
    }

    return NULL;
}

static void handle_input(void) {
    /* Poll gamepad input */
    input_poll_gamepad(&input_mgr);

    /* Update keyboard->gamepad simulation */
    input_update_keyboard_simulation(&input_mgr);

    /* Read keyboard input */
    char c = input_read_keyboard(&input_mgr);
    if (c == 0) return;

    /* Process key actions */
    if (c == 'q' || c == 'Q' || c == 27) {  /* q or ESC */
        running = 0;
    } else if (c == 'h' || c == 'H' || c == '?') {
        ui_ctx.layout.show_help = !ui_ctx.layout.show_help;
    } else if (c == 'p' || c == 'P') {
        ui_ctx.paused = !ui_ctx.paused;
    } else if (c >= '1' && c <= '3') {
        int panel = c - '1';
        layout_toggle_panel(&ui_ctx.layout, (PanelType)panel);
    } else if (c == '4') {
        layout_toggle_panel(&ui_ctx.layout, PANEL_MAPPING);
    } else if (c >= '5' && c <= '8') {
        /* Future panels */
    } else if (c == '9') {
        layout_toggle_panel(&ui_ctx.layout, PANEL_CONFIG);
    } else if (c == '0') {
        /* Clear all panels */
        ui_ctx.layout.panel_flags = 0;
        ui_ctx.layout.show_help = 0;
        ui_ctx.layout.show_config = 0;
        ui_ctx.layout.show_mapping = 0;
        layout_update_regions(&ui_ctx.layout);
    }

    /* Process key for input manager (WASD, etc.) */
    input_process_key(&input_mgr, c);
}

/* ========================================================================
 * COMMAND PROCESSING
 * ======================================================================== */

static void process_command(char *line) {
    char cmd[64];
    sscanf(line, "%s", cmd);

    if (strcmp(cmd, "INIT") == 0) {
        int c, r;
        if (sscanf(line, "INIT %d %d", &c, &r) == 2) {
            ui_resize(&ui_ctx, c, r);
            render_resize(&render_ctx, c, r);
        }
        printf("OK INIT\n");
        fflush(stdout);

    } else if (strcmp(cmd, "SPAWN_PULSAR") == 0) {
        int mx, my, len0, amp, valence;
        float freq, dtheta;

        if (sscanf(line, "SPAWN_PULSAR %d %d %d %d %f %f %d",
                   &mx, &my, &len0, &amp, &freq, &dtheta, &valence) == 7) {
            int idx = alloc_sprite();
            if (idx >= 0) {
                sprites[idx].mx = mx;
                sprites[idx].my = my;
                sprites[idx].len0 = len0;
                sprites[idx].amp = amp;
                sprites[idx].freq = freq;
                sprites[idx].dtheta = dtheta;
                sprites[idx].valence = valence;
                sprites[idx].theta = 0;
                sprites[idx].phase = 0;

                printf("ID %d\n", sprites[idx].id);
                fflush(stdout);
            } else {
                printf("ERR SPRITE_LIMIT\n");
                fflush(stdout);
            }
        } else {
            printf("ERR INVALID_PARAMS\n");
            fflush(stdout);
        }

    } else if (strcmp(cmd, "SET") == 0) {
        int id;
        char key[64], value[64];

        if (sscanf(line, "SET %d %s %s", &id, key, value) == 3) {
            int idx = find_sprite(id);
            if (idx >= 0) {
                if (strcmp(key, "mx") == 0) sprites[idx].mx = atoi(value);
                else if (strcmp(key, "my") == 0) sprites[idx].my = atoi(value);
                else if (strcmp(key, "dtheta") == 0) sprites[idx].dtheta = atof(value);
                else if (strcmp(key, "freq") == 0) sprites[idx].freq = atof(value);

                printf("OK SET\n");
            } else {
                printf("ERR SPRITE_NOT_FOUND\n");
            }
            fflush(stdout);
        } else {
            printf("ERR INVALID_PARAMS\n");
            fflush(stdout);
        }

    } else if (strcmp(cmd, "KILL") == 0) {
        int id;
        if (sscanf(line, "KILL %d", &id) == 1) {
            int idx = find_sprite(id);
            if (idx >= 0) {
                sprites[idx].active = 0;
                printf("OK KILL %d\n", id);
            } else {
                printf("ERR SPRITE_NOT_FOUND\n");
            }
            fflush(stdout);
        }

    } else if (strcmp(cmd, "RUN") == 0) {
        int fps = 60;
        sscanf(line, "RUN %d", &fps);

        /* Try to open TTY for output, fall back to stderr if not available */
        tty = fopen("/dev/tty", "w");
        if (!tty) {
            /* No /dev/tty available, use stderr (which bash can redirect to the terminal) */
            tty = fdopen(dup(STDERR_FILENO), "w");
            if (!tty) {
                printf("ERR CANNOT_OPEN_OUTPUT\n");
                fflush(stdout);
                return;
            }
        }

        /* Set TTY in UI context */
        ui_ctx.tty = tty;

        /* Initialize modules */
        if (input_init(&input_mgr) < 0) {
            printf("ERR CANNOT_INIT_INPUT\n");
            fflush(stdout);
            fclose(tty);
            tty = NULL;
            ui_ctx.tty = NULL;
            return;
        }

        /* Get ACTUAL terminal size from the system */
        int cols = ui_ctx.layout.cols;
        int rows = ui_ctx.layout.rows;

        struct winsize ws;
        if (ioctl(fileno(tty), TIOCGWINSZ, &ws) == 0 && ws.ws_col > 0 && ws.ws_row > 0) {
            cols = ws.ws_col;
            rows = ws.ws_row;
            /* Update UI with actual terminal size */
            ui_resize(&ui_ctx, cols, rows);
        }

        /* Initialize render context */
        render_init(&render_ctx, tty, cols, rows);

        running = 1;

        /* Setup SIGWINCH handler for terminal resize */
        struct sigaction sa;
        sa.sa_handler = sigwinch_handler;
        sigemptyset(&sa.sa_mask);
        sa.sa_flags = SA_RESTART;
        sigaction(SIGWINCH, &sa, NULL);

        /* Enable raw mode */
        input_enable_raw_mode(&input_mgr);

        /* Clear screen and hide cursor */
        fprintf(tty, "\033[2J\033[H");  /* Clear screen */
        fprintf(tty, "\033[?25l");       /* Hide cursor */
        fflush(tty);

        /* Initialize CPU tracking */
        getrusage(RUSAGE_SELF, &last_rusage);
        last_wall_time_ns = now_ns();
        cpu_usage_percent = 0.0f;

        /* DON'T send OK RUN - we'll send OK RUN_COMPLETE when done */

        /* Main loop */
        struct timespec frame_time;
        frame_time.tv_sec = 0;
        frame_time.tv_nsec = 1000000000L / fps;

        int frame_count = 0;
        uint64_t last_frame_time = now_ns();

        while (running) {
            /* Check for window resize */
            check_window_resize();

            /* Calculate delta time */
            uint64_t current_time = now_ns();
            float dt = (current_time - last_frame_time) / 1000000000.0f;
            last_frame_time = current_time;

            /* Check for live commands from stdin (throttled to reduce flicker)
             * Interval configurable via SET_COMMAND_RATE command */
            if (frame_count % command_check_interval == 0) {
                char *cmd = try_read_command();
                if (cmd) {
                    /* Process safe commands during RUN */
                    /* Ignore: QUIT, RUN, INIT (dangerous during animation) */
                    if (strncmp(cmd, "QUIT", 4) != 0 &&
                        strncmp(cmd, "RUN", 3) != 0 &&
                        strncmp(cmd, "INIT", 4) != 0) {
                        process_command(cmd);
                    }
                }
            }

            /* Handle input */
            handle_input();

            /* Update sprites if not paused */
            if (!ui_ctx.paused) {
                update_sprites(dt);
            }

            /* Update CPU usage periodically */
            if (++frame_count % 10 == 0) {
                update_cpu_usage();
            }

            /* Render */
            render_frame();

            /* Frame rate control */
            nanosleep(&frame_time, NULL);
        }

        /* Cleanup */
        input_disable_raw_mode(&input_mgr);

        if (tty) {
            fprintf(tty, "\033[?25h");  /* Show cursor */
            fprintf(tty, "\033[2J\033[H");  /* Clear screen */
            fprintf(tty, "\033[0m");     /* Reset colors */
            fflush(tty);
            fclose(tty);
            tty = NULL;
        }
        ui_ctx.tty = NULL;

        /* Send completion signal to bash */
        printf("OK RUN_COMPLETE\n");
        fflush(stdout);

        input_cleanup(&input_mgr);

        /* Exit after RUN completes - don't go back to command loop */
        cleanup_child_processes();
        exit(0);

    } else if (strcmp(cmd, "SET_COMMAND_RATE") == 0) {
        int rate;
        if (sscanf(line, "SET_COMMAND_RATE %d", &rate) == 1) {
            if (rate >= 1 && rate <= 60) {
                command_check_interval = rate;
                printf("OK SET_COMMAND_RATE %d\n", rate);
            } else {
                printf("ERR INVALID_RATE (must be 1-60)\n");
            }
        } else {
            printf("ERR INVALID_PARAMS\n");
        }
        fflush(stdout);

    } else if (strcmp(cmd, "QUERY") == 0) {
        char path[256];
        if (sscanf(line, "QUERY %s", path) == 1) {
            if (strncmp(path, "sprites.", 8) == 0) {
                char *rest = path + 8;
                if (strcmp(rest, "count") == 0) {
                    printf("VALUE %s %d\n", path, sprite_count());
                } else if (strncmp(rest, "id[", 3) == 0) {
                    int id;
                    sscanf(rest, "id[%d]", &id);
                    int idx = find_sprite(id);
                    if (idx >= 0) {
                        printf("VALUE %s exists\n", path);
                    } else {
                        printf("VALUE %s none\n", path);
                    }
                }
            } else if (strncmp(path, "gamepad.", 8) == 0) {
                char *rest = path + 8;
                int player;
                if (sscanf(rest, "%d.", &player) == 1 && player >= 0 && player < MAX_PLAYERS) {
                    rest = strchr(rest, '.') + 1;
                    if (strncmp(rest, "axes[", 5) == 0) {
                        int axis;
                        sscanf(rest, "axes[%d]", &axis);
                        if (axis >= 0 && axis < AXES_MAX) {
                            printf("VALUE %s %f\n", path, input_mgr.gamepads[player].axes[axis]);
                        }
                    } else if (strcmp(rest, "buttons") == 0) {
                        printf("VALUE %s %u\n", path, input_mgr.gamepads[player].buttons);
                    }
                }
            }
            fflush(stdout);
        }

    } else if (strcmp(cmd, "EXPORT_STATE") == 0) {
        printf("version = \"1.0.0\"\n");
        printf("timestamp = %ld\n", time(NULL));
        printf("\n[world]\n");
        printf("width = %d\n", ui_ctx.layout.cols * 2);
        printf("height = %d\n", ui_ctx.layout.rows * 4);
        printf("\n");

        for (int i = 0; i < MAX_SPRITES; i++) {
            if (sprites[i].active) {
                printf("[[pulsars]]\n");
                printf("id = %d\n", sprites[i].id);
                printf("center_x = %d\n", sprites[i].mx);
                printf("center_y = %d\n", sprites[i].my);
                printf("angular_velocity = %f\n", sprites[i].dtheta);
                printf("pulse_frequency = %f\n", sprites[i].freq);
                printf("theta = %f\n", sprites[i].theta);
                printf("phase = %f\n", sprites[i].phase);
                printf("\n");
            }
        }
        printf("END_STATE\n");
        fflush(stdout);

    } else if (strcmp(cmd, "LIST_PULSARS") == 0) {
        for (int i = 0; i < MAX_SPRITES; i++) {
            if (sprites[i].active) {
                printf("%d\n", sprites[i].id);
            }
        }
        printf("END_LIST\n");
        fflush(stdout);

    } else if (strcmp(cmd, "OPEN_SOCKET") == 0) {
        char path[256];
        if (sscanf(line, "OPEN_SOCKET %s", path) == 1) {
            /* Spawn gamepad sender */
            pid_t sender_pid = spawn_gamepad_sender(path);

            if (sender_pid > 0) {
                usleep(200000);  /* 200ms for sender to initialize */
            }

            /* Open socket in input manager */
            if (input_open_gamepad_socket(&input_mgr, path) >= 0) {
                printf("OK SOCKET_OPENED %s sender_pid=%d\n", path, sender_pid);
            } else {
                printf("ERROR SOCKET_OPEN_FAILED %s\n", path);
            }
            fflush(stdout);
        }

    } else if (strcmp(cmd, "RENDER") == 0) {
        render_frame();
        printf("OK RENDER\n");
        fflush(stdout);

    } else if (strcmp(cmd, "QUIT") == 0) {
        running = 0;
        cleanup_child_processes();
        printf("OK QUIT\n");
        fflush(stdout);
        exit(0);
    }
}

/* ========================================================================
 * MAIN
 * ======================================================================== */

int main(int argc, char **argv) {
    /* Set unbuffered I/O */
    setbuf(stdin, NULL);
    setbuf(stdout, NULL);

    /* Initialize */
    init_sprites();
    init_event_log();
    init_player_accounts();

    /* Initialize UI context with default size */
    ui_init(&ui_ctx, NULL, 80, 24);

    /* Log system startup */
    log_event("SYSTEM", 0, "Engine initialized");

    /* Check if running in standalone mode (if stdin is a terminal) */
    if (isatty(STDIN_FILENO) || (argc > 1 && strcmp(argv[1], "--standalone") == 0)) {
        /* Standalone mode: auto-detect terminal size and run immediately */
        struct winsize ws;
        int cols = 80, rows = 24;
        if (ioctl(STDOUT_FILENO, TIOCGWINSZ, &ws) == 0 && ws.ws_col > 0 && ws.ws_row > 0) {
            cols = ws.ws_col;
            rows = ws.ws_row;
        }

        /* Simulate INIT and RUN commands */
        char init_cmd[64], run_cmd[64];
        snprintf(init_cmd, sizeof(init_cmd), "INIT %d %d", cols, rows);
        snprintf(run_cmd, sizeof(run_cmd), "RUN 60");

        process_command(init_cmd);
        process_command(run_cmd);

        /* process_command(RUN) calls exit(0), so we never get here */
    }

    /* Command mode: wait for commands via stdin */
    fprintf(stderr, "\n");
    fprintf(stderr, "  ╔═══════════════════════════════════════╗\n");
    fprintf(stderr, "  ║   ⚡ PULSAR ENGINE v1.0              ║\n");
    fprintf(stderr, "  ║   Terminal Sprite Animation System   ║\n");
    fprintf(stderr, "  ╚═══════════════════════════════════════╝\n");
    fprintf(stderr, "\n");
    fprintf(stderr, "  Ready for Engine Protocol commands.\n");
    fprintf(stderr, "  Pipe scripts: cat scene.pql | pulsar\n");
    fprintf(stderr, "\n");

    printf("OK READY\n");
    fflush(stdout);

    char line[1024];
    while (fgets(line, sizeof(line), stdin)) {
        /* Remove newline */
        line[strcspn(line, "\n")] = 0;

        if (strlen(line) > 0) {
            process_command(line);
        }
    }

    /* Cleanup */
    cleanup_child_processes();

    return 0;
}
