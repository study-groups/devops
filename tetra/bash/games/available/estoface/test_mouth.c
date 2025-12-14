/*
 * test_mouth.c - Comprehensive mouth articulation test
 */

#include "mouth.h"
#include "state.h"
#include "phonemes.h"
#include <stdio.h>

static void print_separator(void) {
    printf("========================================\n");
}

static void test_phoneme_by_symbol(const char *symbol) {
    const PhonemePreset *phoneme = phoneme_get_preset(symbol);
    if (!phoneme) {
        printf("Phoneme '%s' not found\n", symbol);
        return;
    }

    /* Render front mouth */
    FrontMouthBuffer mouth_buf;
    mouth_render_front(&mouth_buf, &phoneme->state);

    printf("\n");
    print_separator();
    printf("PHONEME: [%s] - %s\n", phoneme->symbol, phoneme->description);
    print_separator();
    printf("  jaw=%.2f round=%.2f corner=%.2f tongue_h=%.2f tongue_f=%.2f\n",
           phoneme->state.jaw_openness, phoneme->state.lip_rounding,
           phoneme->state.lip_corner_height, phoneme->state.tongue_height,
           phoneme->state.tongue_frontness);
    printf("\nFRONT VIEW:\n");
    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        printf("  %s\n", mouth_buf.grid[y]);
    }
}

static void test_jaw_range(void) {
    printf("\n\n");
    print_separator();
    printf("JAW OPENNESS TEST (0.0 to 1.0 in 0.2 steps)\n");
    print_separator();

    for (float jaw = 0.0f; jaw <= 1.0f; jaw += 0.2f) {
        FacialState state;
        state_init(&state);
        state.jaw_openness = jaw;

        FrontMouthBuffer mouth_buf;
        mouth_render_front(&mouth_buf, &state);

        printf("\nJaw openness: %.2f\n", jaw);
        for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
            printf("  %s\n", mouth_buf.grid[y]);
        }
    }
}

static void test_rounding_range(void) {
    printf("\n\n");
    print_separator();
    printf("LIP ROUNDING TEST (jaw=0.4, rounding 0.0 to 1.0)\n");
    print_separator();

    for (float rounding = 0.0f; rounding <= 1.0f; rounding += 0.25f) {
        FacialState state;
        state_init(&state);
        state.jaw_openness = 0.4f;
        state.lip_rounding = rounding;

        FrontMouthBuffer mouth_buf;
        mouth_render_front(&mouth_buf, &state);

        printf("\nLip rounding: %.2f (jaw=0.4)\n", rounding);
        for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
            printf("  %s\n", mouth_buf.grid[y]);
        }
    }
}

static void test_specific_articulations(void) {
    printf("\n\n");
    print_separator();
    printf("SPECIFIC ARTICULATION TESTS\n");
    print_separator();

    /* Test "OOH" sound (rounded, moderately open) */
    printf("\n\"OOH\" sound (high rounding, moderate jaw):\n");
    FacialState state1;
    state_init(&state1);
    state1.jaw_openness = 0.4f;
    state1.lip_rounding = 0.9f;
    state1.lip_protrusion = 0.7f;

    FrontMouthBuffer mouth_buf1;
    mouth_render_front(&mouth_buf1, &state1);
    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        printf("  %s\n", mouth_buf1.grid[y]);
    }

    /* Test "AH" sound (wide open, neutral) */
    printf("\n\"AH\" sound (wide open, neutral):\n");
    FacialState state2;
    state_init(&state2);
    state2.jaw_openness = 0.9f;
    state2.lip_rounding = 0.3f;

    FrontMouthBuffer mouth_buf2;
    mouth_render_front(&mouth_buf2, &state2);
    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        printf("  %s\n", mouth_buf2.grid[y]);
    }

    /* Test "EE" sound (spread lips, closed jaw) */
    printf("\n\"EE\" sound (spread lips, closed jaw):\n");
    FacialState state3;
    state_init(&state3);
    state3.jaw_openness = 0.2f;
    state3.lip_rounding = 0.0f;
    state3.lip_corner_height = 0.8f;

    FrontMouthBuffer mouth_buf3;
    mouth_render_front(&mouth_buf3, &state3);
    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        printf("  %s\n", mouth_buf3.grid[y]);
    }
}

int main(int argc, char **argv) {
    (void)argc; (void)argv;  /* Unused */

    printf("ESTOFACE MOUTH ARTICULATION ANALYSIS\n");
    print_separator();

    /* Test key phonemes that represent different articulations */
    const char *test_phonemes[] = {
        "u",  /* Close back rounded - should show rounding */
        "i",  /* Close front unrounded - spread lips */
        "o",  /* Close-mid back rounded - moderate rounding */
        "e",  /* Close-mid front unrounded */
        "ɔ",  /* Open-mid back rounded */
        "ɛ",  /* Open-mid front unrounded */
        "ɑ",  /* Open back unrounded - wide open */
        "a",  /* Open front unrounded */
        NULL
    };

    printf("\n=== Testing Key IPA Phonemes ===\n");
    for (int i = 0; test_phonemes[i] != NULL; i++) {
        test_phoneme_by_symbol(test_phonemes[i]);
    }

    /* Test jaw range */
    test_jaw_range();

    /* Test rounding range */
    test_rounding_range();

    /* Test specific articulations */
    test_specific_articulations();

    printf("\n\nReview the output to check:\n");
    printf("  - OOH sounds (u, o) have visible rounding\n");
    printf("  - Lower jaw/mouth elements don't come too high\n");
    printf("  - All phoneme categories show distinct articulation\n\n");

    return 0;
}
