/*
 * utils.c - Shared utility functions implementation
 */

#include "utils.h"
#include <time.h>
#include <string.h>

/* Global event log (shared with pulsar.c) */
extern Event event_log[MAX_EVENT_LOG];
extern int event_log_head;

/* Get monotonic time in nanoseconds */
uint64_t now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ULL + (uint64_t)ts.tv_nsec;
}

/* Log an event to the shared event log */
void log_event(const char *type, uint32_t user_id, const char *data) {
    Event *e = &event_log[event_log_head];
    strncpy(e->type, type, sizeof(e->type) - 1);
    e->type[sizeof(e->type) - 1] = '\0';
    e->user_id = user_id;
    e->timestamp_ns = now_ns();
    strncpy(e->data, data, sizeof(e->data) - 1);
    e->data[sizeof(e->data) - 1] = '\0';
    event_log_head = (event_log_head + 1) % MAX_EVENT_LOG;
}

/* Count active sprites in the given sprite array */
int sprite_count_helper(const Sprite *sprites, int max_sprites) {
    int count = 0;
    for (int i = 0; i < max_sprites; i++) {
        if (sprites[i].active) count++;
    }
    return count;
}
