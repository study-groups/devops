#include "mouth.h"
#include "state.h"
#include <stdio.h>

int main(void) {
    MouthBuffer buf;
    FacialState state;
    state_init(&state);
    
    printf("JAW CLOSED (0.0 - W all the way):\n");
    state.jaw_openness = 0.0f;
    mouth_render(&buf, &state);
    for (int y = 0; y < MOUTH_HEIGHT; y++) {
        printf("[%s]\n", buf.grid[y]);
    }
    
    printf("\nJAW OPEN (1.0 - S all the way):\n");
    state.jaw_openness = 1.0f;
    mouth_render(&buf, &state);
    for (int y = 0; y < MOUTH_HEIGHT; y++) {
        printf("[%s]\n", buf.grid[y]);
    }
    
    return 0;
}
