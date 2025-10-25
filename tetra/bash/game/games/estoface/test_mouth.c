/*
 * test_mouth.c - Test mouth rendering at different jaw openness values
 */

#include "mouth.h"
#include "state.h"
#include <stdio.h>

int main(void) {
    MouthBuffer buf;
    FacialState state;

    state_init(&state);

    printf("\nMouth Rendering Test\n");
    printf("====================\n\n");

    /* Test different jaw openness values */
    float jaw_values[] = {0.0f, 0.25f, 0.5f, 0.75f, 1.0f};

    for (int i = 0; i < 5; i++) {
        state.jaw_openness = jaw_values[i];

        printf("JAW OPENNESS: %.2f\n", jaw_values[i]);

        mouth_render(&buf, &state);

        for (int y = 0; y < MOUTH_HEIGHT; y++) {
            printf("%s\n", buf.grid[y]);
        }

        printf("\n");
    }

    return 0;
}
