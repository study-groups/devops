/*
 * ui.c - UI rendering and panel management
 */

#include "ui.h"
#include "utils.h"
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>

/* Initialize UI context */
void ui_init(UIContext *ui, FILE *tty, int cols, int rows) {
    memset(ui, 0, sizeof(UIContext));
    ui->tty = tty;
    layout_init(&ui->layout, cols, rows);
    ui->cpu_usage_percent = 0.0f;
    ui->paused = 0;
}

/* Update terminal size */
void ui_resize(UIContext *ui, int cols, int rows) {
    layout_resize(&ui->layout, cols, rows);
}

/* Clear screen */
void ui_clear_screen(UIContext *ui) {
    if (!ui->tty) return;
    fprintf(ui->tty, "\033[2J\033[H");
}

/* Draw all UI panels */
void ui_draw_panels(UIContext *ui, const Sprite *sprites, int max_sprite_count,
                    const GamepadState *gamepads, const Event *event_log,
                    int event_log_head, const PUID_Account *player_accounts,
                    const KeyboardState *kbd_state) {
    if (!ui->tty) return;

    int sprite_cnt = sprite_count_helper(sprites, max_sprite_count);
    int gamepad_connected = 1; /* Assume connected for now */

    /* Draw panels in order */
    ui_draw_panel_debug(ui, sprite_cnt, gamepad_connected);
    ui_draw_panel_event_log(ui, event_log, event_log_head, player_accounts);
    ui_draw_panel_player_stats(ui, player_accounts, gamepads);
    ui_draw_panel_mapping(ui, kbd_state, gamepads, sprites);
    ui_draw_panel_config(ui);

    /* Draw help overlay if active */
    if (ui->layout.show_help) {
        ui_draw_help(ui);
    }

    /* Draw pause indicator */
    if (ui->paused) {
        ui_draw_pause_indicator(ui);
    }

    fflush(ui->tty);
}

/* Draw panel 1: Debug Info */
void ui_draw_panel_debug(UIContext *ui, int sprite_count, int gamepad_connected) {
    if (!ui->tty) return;
    if (!ui->layout.panels[PANEL_DEBUG].visible) return;

    fprintf(ui->tty, "\033[1;1H\033[1;36m[PANEL 1: DEBUG]\033[0m");
    fprintf(ui->tty, "\033[2;1H Pulsars: %d | FPS: 60 | CPU: %5.1f%% | Gamepad: %s",
            sprite_count, ui->cpu_usage_percent, gamepad_connected ? "YES" : "NO");
    fprintf(ui->tty, "\033[3;1H Panels: 0x%02x | Help: h | Quit: q | Size: %dx%d",
            ui->layout.panel_flags, ui->layout.cols, ui->layout.rows);
}

/* Draw panel 2: Event Log (bottom, sticky) */
void ui_draw_panel_event_log(UIContext *ui, const Event *event_log, int event_log_head,
                              const PUID_Account *player_accounts) {
    if (!ui->tty) return;
    if (!ui->layout.panels[PANEL_EVENT_LOG].visible) return;

    const LayoutRegion *region = &ui->layout.panels[PANEL_EVENT_LOG];
    int log_lines = region->height;
    int start_row = region->y + 1; /* 1-indexed for ANSI */

    /* Display last N events in reverse chronological order */
    int displayed = 0;
    for (int i = 0; i < MAX_EVENT_LOG && displayed < log_lines; i++) {
        int idx = (event_log_head - 1 - i + MAX_EVENT_LOG) % MAX_EVENT_LOG;
        const Event *e = &event_log[idx];

        if (e->timestamp_ns == 0) continue;  /* Skip uninitialized */

        /* Format timestamp */
        time_t timestamp_sec = e->timestamp_ns / 1000000000;
        struct tm *tm_info = localtime(&timestamp_sec);
        char time_str[16];
        snprintf(time_str, sizeof(time_str), "%02d:%02d:%02d",
                 tm_info->tm_hour, tm_info->tm_min, tm_info->tm_sec);

        /* Get username */
        const char *username = (e->user_id < MAX_PLAYERS) ?
            player_accounts[e->user_id].username : "Unknown";

        int row = start_row + displayed;
        fprintf(ui->tty, "\033[%d;1H\033[K", row);  /* Clear line */
        fprintf(ui->tty, "\033[32m%-10s\033[0m \033[36m%-8s\033[0m %8s | %s",
                e->type, username, time_str, e->data);

        displayed++;
    }
}

/* Draw panel 3: Player Stats */
void ui_draw_panel_player_stats(UIContext *ui, const PUID_Account *player_accounts,
                                 const GamepadState *gamepads) {
    if (!ui->tty) return;
    if (!ui->layout.panels[PANEL_PLAYER_STATS].visible) return;

    const LayoutRegion *region = &ui->layout.panels[PANEL_PLAYER_STATS];
    int start_x = region->x + 1; /* 1-indexed */

    fprintf(ui->tty, "\033[1;%dH\033[1;35m[PANEL 3: PLAYERS]\033[0m", start_x);

    int line = 2;
    for (int i = 0; i < MAX_PLAYERS && line < region->height; i++) {
        const PUID_Account *acc = &player_accounts[i];
        uint64_t last_input = gamepads[i].last_update_ns;
        const char *status = (last_input > 0 && (now_ns() - last_input) < 5000000000ULL) ?
                             "ACTIVE" : "idle";

        fprintf(ui->tty, "\033[%d;%dH\033[36m%s\033[0m %-6s", line++, start_x,
                acc->username, status);
        fprintf(ui->tty, "\033[%d;%dH  PUID: %016llx", line++, start_x,
                (unsigned long long)acc->puid);
        fprintf(ui->tty, "\033[%d;%dH  Score:%5d Tokens:%3d", line++, start_x,
                acc->score, acc->tokens);
        line++;
    }
}

/* Draw panel 4: Mapping Debug */
void ui_draw_panel_mapping(UIContext *ui, const KeyboardState *kbd_state,
                            const GamepadState *gamepads, const Sprite *sprites) {
    if (!ui->tty) return;
    if (!ui->layout.panels[PANEL_MAPPING].visible) return;

    const LayoutRegion *region = &ui->layout.panels[PANEL_MAPPING];
    int start_x = region->x + 2;
    int start_y = region->y + 1; /* 1-indexed */

    fprintf(ui->tty, "\033[%d;%dH\033[1;33m[PANEL 4: MAPPING]\033[0m", start_y, start_x);

    int line = start_y + 1;

    /* Keyboard state */
    fprintf(ui->tty, "\033[%d;%dH\033[36mKeyboard:\033[0m", line++, start_x);
    fprintf(ui->tty, "\033[%d;%dH  WASD: %d%d%d%d  IJKL: %d%d%d%d", line++, start_x,
        kbd_state->w, kbd_state->a, kbd_state->s, kbd_state->d,
        kbd_state->i, kbd_state->j, kbd_state->k, kbd_state->l);

    /* Gamepad axes */
    line++;
    fprintf(ui->tty, "\033[%d;%dH\033[36mGamepad Axes:\033[0m", line++, start_x);
    fprintf(ui->tty, "\033[%d;%dH  Left:  [%.2f, %.2f]", line++, start_x,
        gamepads[0].axes[0], gamepads[0].axes[1]);
    fprintf(ui->tty, "\033[%d;%dH  Right: [%.2f, %.2f]", line++, start_x,
        gamepads[0].axes[2], gamepads[0].axes[3]);

    /* Sprite positions */
    line++;
    fprintf(ui->tty, "\033[%d;%dH\033[36mSprite Positions:\033[0m", line++, start_x);
    for (int i = 0; i < MAX_SPRITES && i < 2 && line < region->y + region->height; i++) {
        if (sprites[i].active) {
            fprintf(ui->tty, "\033[%d;%dH  Sprite %d: (%d, %d)", line++, start_x,
                i, sprites[i].mx, sprites[i].my);
        }
    }
}

/* Draw panel 9: Configuration (tabbed view) */
void ui_draw_panel_config(UIContext *ui) {
    if (!ui->tty) return;
    if (!ui->layout.panels[PANEL_CONFIG].visible) return;

    const LayoutRegion *region = &ui->layout.panels[PANEL_CONFIG];
    int start_x = region->x + 1;
    int start_y = region->y + 1;

    /* Draw border */
    fprintf(ui->tty, "\033[1;36m");  /* Cyan */
    for (int y = 0; y < region->height; y++) {
        fprintf(ui->tty, "\033[%d;%dH", start_y + y, start_x);
        if (y == 0 || y == region->height - 1) {
            for (int x = 0; x < region->width; x++) fprintf(ui->tty, "=");
        } else {
            fprintf(ui->tty, "|");
            fprintf(ui->tty, "\033[%d;%dH|", start_y + y, start_x + region->width - 1);
        }
    }

    /* Draw title with tab indicator */
    int line = start_y + 2;
    fprintf(ui->tty, "\033[%d;%dH\033[1;33m=== CONFIGURATION (TAB 9) ===\033[0m",
            line++, start_x + 3);
    line++;

    /* Environment */
    fprintf(ui->tty, "\033[%d;%dH\033[1;32mEnvironment:\033[0m", line++, start_x + 3);
    const char *game_src = getenv("GAME_SRC");
    const char *tetra_src = getenv("TETRA_SRC");
    fprintf(ui->tty, "\033[%d;%dH  GAME_SRC:  %s", line++, start_x + 3,
            game_src ? game_src : "(not set)");
    fprintf(ui->tty, "\033[%d;%dH  TETRA_SRC: %s", line++, start_x + 3,
            tetra_src ? tetra_src : "(not set)");
    line++;

    /* Config files */
    fprintf(ui->tty, "\033[%d;%dH\033[1;32mConfig Files:\033[0m", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  game.toml:     bash/game/config/game.toml",
            line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  controls.toml: bash/game/config/controls.toml",
            line++, start_x + 3);
    line++;

    /* Layout info */
    fprintf(ui->tty, "\033[%d;%dH\033[1;32mLayout:\033[0m", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  Terminal: %d x %d", line++, start_x + 3,
            ui->layout.cols, ui->layout.rows);
    fprintf(ui->tty, "\033[%d;%dH  Play Area: %dx%d at (%d,%d)", line++, start_x + 3,
            ui->layout.play_area.width, ui->layout.play_area.height,
            ui->layout.play_area.x, ui->layout.play_area.y);
    line++;

    /* Controls */
    fprintf(ui->tty, "\033[%d;%dH\033[1;32mControls:\033[0m", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  1-3: Toggle panels | 4: Mapping | 9: This view",
            line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  h: Help | p: Pause | q: Quit", line++, start_x + 3);
    line++;

    fprintf(ui->tty, "\033[%d;%dH\033[90mPress 9 again to close this tab\033[0m",
            line++, start_x + 3);

    fprintf(ui->tty, "\033[0m");
}

/* Draw help overlay */
void ui_draw_help(UIContext *ui) {
    if (!ui->tty) return;

    int hud_width = (ui->layout.cols * 80) / 100;
    int hud_height = (ui->layout.rows * 80) / 100;
    int start_x = (ui->layout.cols - hud_width) / 2;
    int start_y = (ui->layout.rows - hud_height) / 2;

    /* Draw border */
    fprintf(ui->tty, "\033[1;37m");  /* Bright white */
    for (int y = start_y; y < start_y + hud_height; y++) {
        fprintf(ui->tty, "\033[%d;%dH", y + 1, start_x + 1);
        if (y == start_y || y == start_y + hud_height - 1) {
            for (int x = 0; x < hud_width; x++) fprintf(ui->tty, "=");
        } else {
            fprintf(ui->tty, "|");
            fprintf(ui->tty, "\033[%d;%dH|", y + 1, start_x + hud_width);
        }
    }

    /* Draw help text */
    int line = start_y + 2;
    fprintf(ui->tty, "\033[%d;%dH\033[1;36mPLASMA FIELD - Controls\033[0m",
            line++, start_x + 3);
    line++;
    fprintf(ui->tty, "\033[%d;%dH\033[33mKEYBOARD:\033[0m", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  Q - Quit", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  H - Toggle this help", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  P - Pause/Resume", line++, start_x + 3);
    line++;
    fprintf(ui->tty, "\033[%d;%dH\033[33mPANELS (resizable):\033[0m", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  1 - Debug info (top)", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  2 - Event log (bottom, sticky)", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  3 - Player stats (right)", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  4 - Mapping debug (left)", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  9 - Configuration tab (center)", line++, start_x + 3);
    line++;
    fprintf(ui->tty, "\033[%d;%dH\033[33mGAMEPAD:\033[0m", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  WASD simulates left stick", line++, start_x + 3);
    fprintf(ui->tty, "\033[%d;%dH  IJKL simulates right stick", line++, start_x + 3);

    fprintf(ui->tty, "\033[0m");
}

/* Draw pause indicator */
void ui_draw_pause_indicator(UIContext *ui) {
    if (!ui->tty) return;

    int status_y = ui->layout.rows;
    int status_x = ui->layout.cols - 30;
    if (status_x < 1) status_x = 1;

    fprintf(ui->tty, "\033[%d;%dH\033[1;31m⏸  PAUSED  \033[90m[p]resume\033[0m",
            status_y, status_x);
}

/* Toggle panel visibility */
void ui_toggle_panel(UIContext *ui, PanelType panel) {
    layout_toggle_panel(&ui->layout, panel);
}

/* Set CPU usage */
void ui_set_cpu_usage(UIContext *ui, float cpu_percent) {
    ui->cpu_usage_percent = cpu_percent;
}

/* Set pause state */
void ui_set_paused(UIContext *ui, int paused) {
    ui->paused = paused;
}
