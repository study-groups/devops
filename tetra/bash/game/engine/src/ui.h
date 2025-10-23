/*
 * ui.h - UI rendering and panel management
 */

#ifndef UI_H
#define UI_H

#include "types.h"
#include "layout.h"
#include <stdio.h>

/* UI state */
typedef struct {
    FILE *tty;
    LayoutManager layout;
    float cpu_usage_percent;
    int paused;
} UIContext;

/* Initialize UI context */
void ui_init(UIContext *ui, FILE *tty, int cols, int rows);

/* Update terminal size */
void ui_resize(UIContext *ui, int cols, int rows);

/* Clear screen */
void ui_clear_screen(UIContext *ui);

/* Draw all UI panels */
void ui_draw_panels(UIContext *ui, const Sprite *sprites, int sprite_count,
                    const GamepadState *gamepads, const Event *event_log,
                    int event_log_head, const PUID_Account *player_accounts,
                    const KeyboardState *kbd_state);

/* Draw individual panels */
void ui_draw_panel_debug(UIContext *ui, int sprite_count, int gamepad_connected);
void ui_draw_panel_event_log(UIContext *ui, const Event *event_log, int event_log_head,
                              const PUID_Account *player_accounts);
void ui_draw_panel_player_stats(UIContext *ui, const PUID_Account *player_accounts,
                                 const GamepadState *gamepads);
void ui_draw_panel_mapping(UIContext *ui, const KeyboardState *kbd_state,
                            const GamepadState *gamepads, const Sprite *sprites);
void ui_draw_panel_config(UIContext *ui);

/* Draw help overlay */
void ui_draw_help(UIContext *ui);

/* Draw pause indicator */
void ui_draw_pause_indicator(UIContext *ui);

/* Toggle panel visibility */
void ui_toggle_panel(UIContext *ui, PanelType panel);

/* Set CPU usage */
void ui_set_cpu_usage(UIContext *ui, float cpu_percent);

/* Set pause state */
void ui_set_paused(UIContext *ui, int paused);

#endif /* UI_H */
