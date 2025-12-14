#include <stdio.h>
#include <math.h>
#include "include/types.h"
#include "include/mouth.h"

void print_mouth_test(float jaw_openness, float lip_rounding) {
    FacialState state = {0};
    state.jaw_openness = jaw_openness;
    state.lip_rounding = lip_rounding;
    state.lip_corner_height = 0.5f;
    state.lip_protrusion = 0.5f;
    state.tongue_height = 0.5f;
    state.tongue_frontness = 0.5f;
    state.eye_l_openness = 0.7f;
    state.eye_r_openness = 0.7f;
    state.eyebrow_l_height = 0.5f;
    state.eyebrow_r_height = 0.5f;

    printf("\n=== JAW:%.1f RND:%.1f ===\n", jaw_openness, lip_rounding);

    // Sample at different x positions
    printf("X pos: ");
    for (int i = 0; i <= 10; i++) {
        float x = i / 10.0f;
        printf("%4.1f ", x);
    }
    printf("\n");

    printf("Upper: ");
    for (int i = 0; i <= 10; i++) {
        float x = i / 10.0f;
        float y = mouth_upper_lip(x, &state);
        printf("%4.2f ", y);
    }
    printf("\n");

    printf("Lower: ");
    for (int i = 0; i <= 10; i++) {
        float x = i / 10.0f;
        float y = mouth_lower_lip(x, &state);
        printf("%4.2f ", y);
    }
    printf("\n");

    // Render the actual mouth buffer
    FrontMouthBuffer buf;
    mouth_render_front(&buf, &state);

    printf("\nRendered:\n");
    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        printf("%s\n", buf.grid[y]);
    }
}

int main() {
    printf("Testing lip curves - neutral_center should be 0.5\n");
    printf("Upper lip should have LOWER y values (toward top of screen)\n");
    printf("Lower lip should have HIGHER y values (toward bottom of screen)\n");

    // Test closed mouth
    print_mouth_test(0.0f, 0.0f);

    // Test open mouth
    print_mouth_test(0.7f, 0.0f);

    // Test rounded mouth
    print_mouth_test(0.3f, 0.8f);

    return 0;
}
