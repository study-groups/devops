/*
 * test_phoneme_sweep.c - Parameter sweep test for all phonemes
 *
 * Displays all 16 IPA phoneme presets with their side and front views
 * to verify visual accuracy of lip shapes, tongue positions, etc.
 */

#include <stdio.h>
#include <string.h>
#include "types.h"
#include "phonemes.h"
#include "mouth.h"

/* Print a side-by-side comparison of side and front views */
void print_phoneme_views(const PhonemePreset *preset) {
    if (!preset || !preset->symbol) return;

    MouthBuffer side_buf;
    FrontMouthBuffer front_buf;

    /* Render both views */
    mouth_render(&side_buf, &preset->state);
    mouth_render_front(&front_buf, &preset->state);

    /* Print header with phoneme info */
    printf("\n┌─────────────────────────────────────────────────────────────────────┐\n");
    printf("│ [%s] %s\n", preset->symbol, preset->description);
    printf("├─────────────────────────────────────────────────────────────────────┤\n");

    /* Print parameters */
    printf("│ Parameters:\n");
    printf("│   jaw_openness=%.2f  tongue_height=%.2f  tongue_frontness=%.2f\n",
           preset->state.jaw_openness,
           preset->state.tongue_height,
           preset->state.tongue_frontness);
    printf("│   lip_rounding=%.2f  lip_corner_height=%.2f\n",
           preset->state.lip_rounding,
           preset->state.lip_corner_height);
    printf("├─────────────────────────────────────────────────────────────────────┤\n");

    /* Print side view and front view side-by-side */
    printf("│ SIDE VIEW:                        FRONT VIEW:\n");

    int max_lines = MOUTH_HEIGHT > FRONT_MOUTH_HEIGHT ? MOUTH_HEIGHT : FRONT_MOUTH_HEIGHT;

    for (int i = 0; i < max_lines; i++) {
        printf("│ ");

        /* Print side view line */
        if (i < MOUTH_HEIGHT) {
            printf("%-28s", side_buf.grid[i]);
        } else {
            printf("%-28s", "");
        }

        printf("  ");

        /* Print front view line */
        if (i < FRONT_MOUTH_HEIGHT) {
            /* Center the front view */
            int padding = (28 - FRONT_MOUTH_WIDTH) / 2;
            for (int p = 0; p < padding; p++) printf(" ");
            printf("%s", front_buf.grid[i]);
        }

        printf("\n");
    }

    printf("└─────────────────────────────────────────────────────────────────────┘\n");
}

/* Print a summary table of all phonemes */
void print_summary_table(void) {
    printf("\n╔═══════════════════════════════════════════════════════════════════════╗\n");
    printf("║                  IPA VOWEL SPACE - 4x4 GRID SUMMARY                   ║\n");
    printf("╠═══════════════════════════════════════════════════════════════════════╣\n");
    printf("║ Symbol │ Description              │  Jaw │ TngH │ TngF │ Round │ Corner║\n");
    printf("╠════════╪══════════════════════════╪══════╪══════╪══════╪═══════╪═══════╣\n");

    /* Print all phonemes in grid order */
    for (int y = 0; y < 4; y++) {
        for (int x = 0; x < 4; x++) {
            const PhonemePreset *p = phoneme_get_by_zone(x, y);
            if (p && p->symbol) {
                printf("║   %-4s │ %-24s │ %.2f │ %.2f │ %.2f │  %.2f │  %.2f ║\n",
                       p->symbol,
                       p->description,
                       p->state.jaw_openness,
                       p->state.tongue_height,
                       p->state.tongue_frontness,
                       p->state.lip_rounding,
                       p->state.lip_corner_height);
            }
        }
        if (y < 3) {
            printf("╠════════╪══════════════════════════╪══════╪══════╪══════╪═══════╪═══════╣\n");
        }
    }

    printf("╚════════╧══════════════════════════╧══════╧══════╧══════╧═══════╧═══════╝\n");
}

/* Main test program */
int main(int argc, char **argv) {
    printf("╔═══════════════════════════════════════════════════════════════════════╗\n");
    printf("║              ESTOFACE PHONEME PARAMETER SWEEP TEST                    ║\n");
    printf("╚═══════════════════════════════════════════════════════════════════════╝\n");

    /* If argument provided, show only that phoneme */
    if (argc > 1) {
        const PhonemePreset *preset = phoneme_get_preset(argv[1]);
        if (preset) {
            print_phoneme_views(preset);
        } else {
            printf("\nError: Phoneme '%s' not found.\n", argv[1]);
            printf("\nAvailable phonemes:\n");
            phoneme_list_all();
            return 1;
        }
        return 0;
    }

    /* Show summary table first */
    print_summary_table();

    printf("\n\nPress ENTER to see detailed views of each phoneme...\n");
    getchar();

    /* Show detailed views for all phonemes in grid order */
    printf("\n\n");
    printf("═══════════════════════════════════════════════════════════════════════\n");
    printf("                        DETAILED PHONEME VIEWS\n");
    printf("═══════════════════════════════════════════════════════════════════════\n");

    /* Group by vowel height (rows) */
    const char *row_labels[] = {
        "HIGH/CLOSE VOWELS (tongue high)",
        "CLOSE-MID VOWELS",
        "OPEN-MID VOWELS",
        "LOW/OPEN VOWELS (tongue low, jaw open)"
    };

    for (int y = 0; y < 4; y++) {
        printf("\n\n╔═══════════════════════════════════════════════════════════════════════╗\n");
        printf("║ %s\n", row_labels[y]);
        printf("╚═══════════════════════════════════════════════════════════════════════╝\n");

        for (int x = 0; x < 4; x++) {
            const PhonemePreset *p = phoneme_get_by_zone(x, y);
            if (p && p->symbol) {
                print_phoneme_views(p);
            }
        }
    }

    /* Highlight key phonemes for rounded lips testing */
    printf("\n\n");
    printf("═══════════════════════════════════════════════════════════════════════\n");
    printf("            KEY ROUNDED LIP PHONEMES (Testing 'ooh' shapes)\n");
    printf("═══════════════════════════════════════════════════════════════════════\n");

    const char *rounded_phonemes[] = {"u", "o", "ɔ", "ʉ", "ɵ", NULL};

    for (int i = 0; rounded_phonemes[i] != NULL; i++) {
        const PhonemePreset *p = phoneme_get_preset(rounded_phonemes[i]);
        if (p) {
            print_phoneme_views(p);
        }
    }

    printf("\n\n═══════════════════════════════════════════════════════════════════════\n");
    printf("                         TEST COMPLETE\n");
    printf("═══════════════════════════════════════════════════════════════════════\n");
    printf("\nUsage: %s [phoneme]  - Show specific phoneme\n", argv[0]);
    printf("       %s            - Show all phonemes\n\n", argv[0]);

    return 0;
}
