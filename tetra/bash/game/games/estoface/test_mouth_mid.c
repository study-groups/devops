#include "mouth.h"
#include "state.h"
#include <stdio.h>

int main(void) {
    MouthBuffer buf;
    FacialState state;
    state_init(&state);
    
    float jaw_vals[] = {0.0f, 0.3f, 0.5f, 0.7f, 1.0f};
    
    for (int i = 0; i < 5; i++) {
        state.jaw_openness = jaw_vals[i];
        printf("JAW: %.1f\n", jaw_vals[i]);
        mouth_render(&buf, &state);
        for (int y = 0; y < MOUTH_HEIGHT; y++) {
            printf("[%s]\n", buf.grid[y]);
        }
        printf("\n");
    }
    
    return 0;
}
