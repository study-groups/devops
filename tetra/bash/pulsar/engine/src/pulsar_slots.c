/*
 * PULSAR Slot Engine - Multi-slot renderer for QUASAR integration
 *
 * Supports 256 concurrent match slots, each with independent:
 * - Screen dimensions
 * - Sprite pool
 * - Frame rate
 *
 * Protocol: stdin/stdout, slot-prefixed commands
 * Format: <slot> <COMMAND> [args...]\n
 *
 * Build: gcc -O2 -o pulsar_slots pulsar_slots.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

/* Constants */
#define MAX_SLOTS 256
#define MAX_SPRITES_PER_SLOT 64
#define MAX_COLS 200
#define MAX_ROWS 100
#define MAX_LINE 1024

/* Sprite state */
typedef struct {
    int active;
    int id;
    int mx, my;          /* microgrid position */
    int len0;            /* base arm length */
    int amp;             /* pulse amplitude */
    float freq;          /* pulse frequency Hz */
    float dtheta;        /* rotation rad/s */
    int valence;         /* color 0-5 */
    float theta;         /* current rotation */
    float phase;         /* current pulse phase */
} Sprite;

/* Slot - independent game context */
typedef struct {
    int active;
    int cols, rows;
    int fps;
    int next_sprite_id;
    Sprite sprites[MAX_SPRITES_PER_SLOT];
    char screen[MAX_ROWS][MAX_COLS + 1];  /* Frame buffer */
} Slot;

/* Global state */
static Slot slots[MAX_SLOTS];

/* Braille patterns for rendering */
static const char *BRAILLE_PATTERNS[] = {
    " ", "⠁", "⠂", "⠃", "⠄", "⠅", "⠆", "⠇",
    "⠈", "⠉", "⠊", "⠋", "⠌", "⠍", "⠎", "⠏",
    "⠐", "⠑", "⠒", "⠓", "⠔", "⠕", "⠖", "⠗",
    "⠘", "⠙", "⠚", "⠛", "⠜", "⠝", "⠞", "⠟",
    "⠠", "⠡", "⠢", "⠣", "⠤", "⠥", "⠦", "⠧",
    "⠨", "⠩", "⠪", "⠫", "⠬", "⠭", "⠮", "⠯",
    "⠰", "⠱", "⠲", "⠳", "⠴", "⠵", "⠶", "⠷",
    "⠸", "⠹", "⠺", "⠻", "⠼", "⠽", "⠾", "⠿"
};

/* Initialize all slots */
static void init_slots(void) {
    memset(slots, 0, sizeof(slots));
}

/* Find sprite by ID in a slot */
static int find_sprite(Slot *slot, int id) {
    for (int i = 0; i < MAX_SPRITES_PER_SLOT; i++) {
        if (slot->sprites[i].active && slot->sprites[i].id == id) {
            return i;
        }
    }
    return -1;
}

/* Allocate sprite in a slot */
static int alloc_sprite(Slot *slot) {
    for (int i = 0; i < MAX_SPRITES_PER_SLOT; i++) {
        if (!slot->sprites[i].active) {
            slot->sprites[i].active = 1;
            slot->sprites[i].id = slot->next_sprite_id++;
            return i;
        }
    }
    return -1;
}

/* Update sprites for delta time */
static void update_sprites(Slot *slot, float dt) {
    for (int i = 0; i < MAX_SPRITES_PER_SLOT; i++) {
        Sprite *s = &slot->sprites[i];
        if (!s->active) continue;

        s->theta += s->dtheta * dt;
        s->phase += s->freq * dt * 2.0f * M_PI;

        /* Keep angles in range */
        while (s->theta > M_PI) s->theta -= 2.0f * M_PI;
        while (s->theta < -M_PI) s->theta += 2.0f * M_PI;
        while (s->phase > M_PI) s->phase -= 2.0f * M_PI;
        while (s->phase < -M_PI) s->phase += 2.0f * M_PI;
    }
}

/* Render a pulsar sprite to screen buffer */
static void render_pulsar(Slot *slot, Sprite *s) {
    if (!s->active) return;

    /* Calculate pulsing arm length */
    float pulse = sinf(s->phase);
    int arm_len = s->len0 + (int)(s->amp * pulse);
    if (arm_len < 1) arm_len = 1;

    /* Draw 4 arms */
    for (int arm = 0; arm < 4; arm++) {
        float angle = s->theta + arm * M_PI / 2.0f;
        float dx = cosf(angle);
        float dy = sinf(angle);

        for (int r = 1; r <= arm_len; r++) {
            int px = s->mx + (int)(dx * r * 2);  /* *2 for aspect ratio */
            int py = s->my + (int)(dy * r);

            /* Convert to screen coordinates */
            int col = px / 2;
            int row = py / 4;

            if (col >= 0 && col < slot->cols && row >= 0 && row < slot->rows) {
                /* Use braille sub-pixel */
                int subx = px % 2;
                int suby = py % 4;
                int pattern = 1 << (suby + (subx ? 3 : 0));

                /* For simplicity, just mark with a character */
                slot->screen[row][col] = '*';
            }
        }
    }

    /* Draw center */
    int col = s->mx / 2;
    int row = s->my / 4;
    if (col >= 0 && col < slot->cols && row >= 0 && row < slot->rows) {
        slot->screen[row][col] = 'O';
    }
}

/* Render slot to screen buffer */
static void render_slot(Slot *slot) {
    /* Clear screen buffer */
    for (int r = 0; r < slot->rows; r++) {
        memset(slot->screen[r], ' ', slot->cols);
        slot->screen[r][slot->cols] = '\0';
    }

    /* Draw border */
    for (int c = 0; c < slot->cols; c++) {
        slot->screen[0][c] = '=';
        slot->screen[slot->rows - 1][c] = '=';
    }
    for (int r = 0; r < slot->rows; r++) {
        slot->screen[r][0] = '|';
        slot->screen[r][slot->cols - 1] = '|';
    }

    /* Render all sprites */
    for (int i = 0; i < MAX_SPRITES_PER_SLOT; i++) {
        if (slot->sprites[i].active) {
            render_pulsar(slot, &slot->sprites[i]);
        }
    }
}

/* Output rendered frame */
static void output_frame(Slot *slot) {
    for (int r = 0; r < slot->rows; r++) {
        printf("%s\n", slot->screen[r]);
    }
    printf("END_FRAME\n");
    fflush(stdout);
}

/* Count active sprites in slot */
static int sprite_count(Slot *slot) {
    int count = 0;
    for (int i = 0; i < MAX_SPRITES_PER_SLOT; i++) {
        if (slot->sprites[i].active) count++;
    }
    return count;
}

/* Process a command */
static void process_command(char *line) {
    char cmd[64];
    int slot_num = -1;

    /* Try to parse slot prefix */
    if (sscanf(line, "%d %s", &slot_num, cmd) == 2) {
        /* Slot-prefixed command */
        char *args = line;
        /* Skip slot number and command */
        while (*args && *args != ' ') args++;  /* skip slot */
        while (*args == ' ') args++;           /* skip spaces */
        while (*args && *args != ' ') args++;  /* skip command */
        while (*args == ' ') args++;           /* skip spaces */

        if (slot_num < 0 || slot_num >= MAX_SLOTS) {
            printf("ERR INVALID_SLOT\n");
            fflush(stdout);
            return;
        }

        Slot *slot = &slots[slot_num];

        if (strcmp(cmd, "INIT") == 0) {
            int cols, rows, fps;
            if (sscanf(args, "%d %d %d", &cols, &rows, &fps) == 3) {
                if (cols > 0 && cols <= MAX_COLS && rows > 0 && rows <= MAX_ROWS) {
                    slot->active = 1;
                    slot->cols = cols;
                    slot->rows = rows;
                    slot->fps = fps;
                    slot->next_sprite_id = 1;
                    memset(slot->sprites, 0, sizeof(slot->sprites));
                    printf("OK\n");
                } else {
                    printf("ERR INVALID_DIMENSIONS\n");
                }
            } else {
                printf("ERR INVALID_PARAMS\n");
            }

        } else if (strcmp(cmd, "DESTROY") == 0) {
            slot->active = 0;
            printf("OK\n");

        } else if (strcmp(cmd, "FPS") == 0) {
            int fps;
            if (sscanf(args, "%d", &fps) == 1 && fps > 0) {
                slot->fps = fps;
                printf("OK\n");
            } else {
                printf("ERR INVALID_FPS\n");
            }

        } else if (strcmp(cmd, "SPAWN") == 0) {
            if (!slot->active) {
                printf("ERR SLOT_NOT_INIT\n");
            } else {
                char type[32];
                int x, y;
                float param1 = 0, param2 = 0;
                int valence = 1;

                int n = sscanf(args, "%s %d %d %f %f %d", type, &x, &y, &param1, &param2, &valence);
                if (n >= 3) {
                    int idx = alloc_sprite(slot);
                    if (idx >= 0) {
                        Sprite *s = &slot->sprites[idx];
                        s->mx = x;
                        s->my = y;
                        s->len0 = (param1 > 0) ? (int)param1 : 5;
                        s->amp = 3;
                        s->freq = 1.0f;
                        s->dtheta = (n >= 5) ? param2 : 0.1f;
                        s->valence = valence;
                        s->theta = 0;
                        s->phase = 0;
                        printf("OK %d\n", s->id);
                    } else {
                        printf("ERR SPRITE_LIMIT\n");
                    }
                } else {
                    printf("ERR INVALID_PARAMS\n");
                }
            }

        } else if (strcmp(cmd, "SET") == 0) {
            if (!slot->active) {
                printf("ERR SLOT_NOT_INIT\n");
            } else {
                int id;
                char key[32], value[64];
                if (sscanf(args, "%d %s %s", &id, key, value) == 3) {
                    int idx = find_sprite(slot, id);
                    if (idx >= 0) {
                        Sprite *s = &slot->sprites[idx];
                        if (strcmp(key, "mx") == 0) s->mx = atoi(value);
                        else if (strcmp(key, "my") == 0) s->my = atoi(value);
                        else if (strcmp(key, "dtheta") == 0) s->dtheta = atof(value);
                        else if (strcmp(key, "freq") == 0) s->freq = atof(value);
                        else if (strcmp(key, "len0") == 0) s->len0 = atoi(value);
                        else if (strcmp(key, "amp") == 0) s->amp = atoi(value);
                        printf("OK\n");
                    } else {
                        printf("ERR SPRITE_NOT_FOUND\n");
                    }
                } else {
                    printf("ERR INVALID_PARAMS\n");
                }
            }

        } else if (strcmp(cmd, "KILL") == 0) {
            if (!slot->active) {
                printf("ERR SLOT_NOT_INIT\n");
            } else {
                int id;
                if (sscanf(args, "%d", &id) == 1) {
                    int idx = find_sprite(slot, id);
                    if (idx >= 0) {
                        slot->sprites[idx].active = 0;
                        printf("OK\n");
                    } else {
                        printf("ERR SPRITE_NOT_FOUND\n");
                    }
                } else {
                    printf("ERR INVALID_PARAMS\n");
                }
            }

        } else if (strcmp(cmd, "TICK") == 0) {
            if (!slot->active) {
                printf("ERR SLOT_NOT_INIT\n");
            } else {
                int ms;
                if (sscanf(args, "%d", &ms) == 1) {
                    float dt = ms / 1000.0f;
                    update_sprites(slot, dt);
                    printf("OK\n");
                } else {
                    printf("ERR INVALID_PARAMS\n");
                }
            }

        } else if (strcmp(cmd, "RENDER") == 0) {
            if (!slot->active) {
                printf("ERR SLOT_NOT_INIT\n");
            } else {
                render_slot(slot);
                output_frame(slot);
            }

        } else if (strcmp(cmd, "LIST") == 0) {
            if (!slot->active) {
                printf("ERR SLOT_NOT_INIT\n");
            } else {
                for (int i = 0; i < MAX_SPRITES_PER_SLOT; i++) {
                    Sprite *s = &slot->sprites[i];
                    if (s->active) {
                        printf("%d pulsar %d %d\n", s->id, s->mx, s->my);
                    }
                }
                printf("END\n");
            }

        } else {
            printf("ERR UNKNOWN_COMMAND\n");
        }

    } else if (sscanf(line, "%s", cmd) == 1) {
        /* Global command (no slot prefix) */

        if (strcmp(cmd, "PING") == 0) {
            printf("PONG\n");

        } else if (strcmp(cmd, "QUIT") == 0) {
            printf("OK\n");
            fflush(stdout);
            exit(0);

        } else if (strcmp(cmd, "SLOTS") == 0) {
            for (int i = 0; i < MAX_SLOTS; i++) {
                if (slots[i].active) {
                    printf("%d %d %d\n", i, slots[i].fps, sprite_count(&slots[i]));
                }
            }
            printf("END\n");

        } else {
            printf("ERR UNKNOWN_COMMAND\n");
        }
    }

    fflush(stdout);
}

/* Main */
int main(int argc, char **argv) {
    (void)argc;
    (void)argv;

    /* Unbuffered I/O */
    setbuf(stdin, NULL);
    setbuf(stdout, NULL);

    /* Initialize */
    init_slots();

    /* Banner to stderr (not protocol) */
    fprintf(stderr, "PULSAR Slot Engine v2.0 - 256 slots, stdin/stdout protocol\n");

    /* Ready signal */
    printf("OK READY\n");
    fflush(stdout);

    /* Command loop */
    char line[MAX_LINE];
    while (fgets(line, sizeof(line), stdin)) {
        /* Remove newline */
        line[strcspn(line, "\n")] = 0;

        if (strlen(line) > 0) {
            process_command(line);
        }
    }

    return 0;
}
