/*
 * estoface.c - Main entry point and game loop
 */

#include "types.h"
#include "state.h"
#include "animation.h"
#include "input.h"
#include "render.h"
#include "phonemes.h"
#include "panels.h"
#include "logging.h"
#include "color.h"
#include "gamepad.h"
#include "sequence.h"
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/time.h>

/* Initialize engine context */
static void ctx_init(EstofaceContext *ctx) {
    memset(ctx, 0, sizeof(EstofaceContext));
    state_init(&ctx->current);
    anim_init(&ctx->anim);
    panels_init(ctx->panels);
    sequence_init(&ctx->sequence);
    ctx->mode = MODE_INTERACTIVE;  /* Start in interactive mode */
    ctx->running = 1;
    ctx->gamepad_enabled = 0;  /* Will be enabled if gamepad init succeeds */
    ctx->metronome_enabled = 0;
    ctx->metronome_bpm = 120.0f;
    log_init(&ctx->event_log);
    log_event(&ctx->event_log, EVENT_SYSTEM, "Estoface engine initialized");

    /* Try to initialize gamepad */
    const char *socket_path = "/tmp/estoface_gamepad.sock";
    if (gamepad_init(ctx, socket_path) == 0) {
        ctx->gamepad_enabled = 1;
        log_event(&ctx->event_log, EVENT_SYSTEM, "Gamepad initialized");
        fprintf(stderr, "Gamepad enabled: %s\n", socket_path);
    } else {
        fprintf(stderr, "Gamepad not available (keyboard only mode)\n");
    }
}

/* Get current time in seconds */
static float get_time_seconds(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec + tv.tv_usec / 1000000.0f;
}

/* Main loop */
static void main_loop(EstofaceContext *ctx, TerminalState *term) {
    /* Initial render */
    render_full(ctx);

    float last_time = get_time_seconds();
    float sequence_timer = 0.0f;

    while (ctx->running) {
        float current_time = get_time_seconds();
        float delta_time = current_time - last_time;
        last_time = current_time;

        /* Poll gamepad input */
        if (ctx->gamepad_enabled) {
            gamepad_poll(ctx);
            const GamepadState *gp = gamepad_get_state(ctx);

            /* Apply gamepad to face (if in interactive mode) */
            if (ctx->mode == MODE_INTERACTIVE || ctx->mode == MODE_SEQUENCE_RECORD) {
                gamepad_apply_to_face(gp, &ctx->current);
                gamepad_handle_dpad(gp, &ctx->current, 0.05f);
            }

            /* Handle recording toggle (button A) */
            static int prev_btn_a = 0;
            if ((gp->buttons & BTN_A) && !prev_btn_a) {
                if (ctx->mode == MODE_SEQUENCE_RECORD) {
                    /* Stop recording */
                    sequence_stop_recording(&ctx->sequence);
                    ctx->mode = MODE_INTERACTIVE;
                    log_event(&ctx->event_log, EVENT_SYSTEM, "Recording stopped");
                } else if (ctx->mode == MODE_INTERACTIVE) {
                    /* Start recording */
                    sequence_start_recording(&ctx->sequence);
                    ctx->mode = MODE_SEQUENCE_RECORD;
                    sequence_timer = 0.0f;
                    log_event(&ctx->event_log, EVENT_SYSTEM, "Recording started");
                }
            }
            prev_btn_a = (gp->buttons & BTN_A) ? 1 : 0;
        }

        /* Record sequence frame if recording */
        if (ctx->mode == MODE_SEQUENCE_RECORD) {
            sequence_timer += delta_time;
            sequence_record_frame(&ctx->sequence, &ctx->current, sequence_timer);
        }

        /* Update playback if playing */
        if (ctx->mode == MODE_SEQUENCE_PLAYBACK) {
            if (!sequence_update_playback(&ctx->sequence, delta_time, &ctx->current)) {
                /* Playback finished (and not looping) */
                ctx->mode = MODE_INTERACTIVE;
            }
        }

        /* Update animation frame */
        anim_update_frame(&ctx->current, &ctx->anim);

        /* Update panel animations */
        panels_update_animation(ctx->panels, delta_time);

        /* Render */
        render_full(ctx);

        /* Handle keyboard input */
        char key = input_read_key(term);
        if (key) {
            if (ctx->mode == MODE_INTERACTIVE || ctx->mode == MODE_SEQUENCE_RECORD) {
                input_handle_interactive(ctx, key);
            } else {
                /* Command mode */
                if (key == 'i') {
                    ctx->mode = MODE_INTERACTIVE;
                } else if (key == 'q') {
                    ctx->running = 0;
                }
            }
        }

        /* Sleep to maintain ~50fps */
        usleep(20000);  /* 20ms */
    }

    /* Cleanup gamepad */
    if (ctx->gamepad_enabled) {
        gamepad_cleanup(ctx);
    }
}

/* Print usage */
static void print_usage(const char *progname) {
    printf("\n");
    printf("%s╔════════════════════════════════════════════════╗%s\n", COLOR_HEADER, COLOR_RESET);
    printf("%s║  ⚡ ESTOFACE - Facial Animation System       ║%s\n", COLOR_HEADER, COLOR_RESET);
    printf("%s║     IPA Articulation & Speech Synthesis      ║%s\n", COLOR_HEADER, COLOR_RESET);
    printf("%s╚════════════════════════════════════════════════╝%s\n", COLOR_HEADER, COLOR_RESET);
    printf("\n");
    printf("%sUsage:%s %s [OPTIONS]\n\n", COLOR_LABEL, COLOR_RESET, progname);
    printf("%sOptions:%s\n", COLOR_LABEL, COLOR_RESET);
    printf("  %s-h, --help%s     Show this help\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %s-v, --version%s  Show version\n", COLOR_ACCENT, COLOR_RESET);
    printf("\n");
    printf("%sInteractive Mode Controls:%s\n", COLOR_LABEL, COLOR_RESET);
    printf("  %sW/S%s            Jaw control (close/open)\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %sI/K%s            Tongue height (up/down)\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %sJ/L%s            Tongue frontness (back/forward)\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %sU/O%s            Lip rounding/spreading\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %sR%s              Reset to neutral\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %s:%s              Enter command mode\n", COLOR_ACCENT, COLOR_RESET);
    printf("  %s1-5%s            Toggle info panels\n", COLOR_ACCENT, COLOR_RESET);
    printf("\n");
}

int main(int argc, char **argv) {
    /* Parse args */
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        }
        if (strcmp(argv[i], "-v") == 0 || strcmp(argv[i], "--version") == 0) {
            printf("%sEstoface v0.1.0%s\n", COLOR_SUCCESS, COLOR_RESET);
            return 0;
        }
    }
    
    /* Initialize context */
    EstofaceContext ctx;
    ctx_init(&ctx);
    
    /* Initialize terminal input */
    TerminalState term;
    if (input_init(&term) < 0) {
        fprintf(stderr, "%sError:%s Failed to initialize terminal\n", COLOR_DANGER, COLOR_RESET);
        log_event(&ctx.event_log, EVENT_ERROR, "Failed to initialize terminal");
        return 1;
    }
    log_event(&ctx.event_log, EVENT_SYSTEM, "Terminal initialized");
    
    /* Initialize rendering */
    render_init(&ctx.cols, &ctx.rows);
    
    /* Run main loop */
    main_loop(&ctx, &term);
    
    /* Cleanup */
    render_cleanup();
    input_cleanup(&term);
    
    return 0;
}
