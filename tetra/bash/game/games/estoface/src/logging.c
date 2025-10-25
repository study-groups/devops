/*
 * logging.c - Event logging implementation
 */

#include "logging.h"
#include "color.h"
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <sys/time.h>

/* Initialize event log */
void log_init(EventLog *log) {
    memset(log, 0, sizeof(EventLog));
    log->head = 0;
}

/* Get current time in nanoseconds */
uint64_t log_now_ns(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec * 1000000000ULL + (uint64_t)tv.tv_usec * 1000ULL;
}

/* Log an event */
void log_event(EventLog *log, EventType type, const char *fmt, ...) {
    Event *e = &log->events[log->head];

    e->type = type;
    e->timestamp_ns = log_now_ns();

    /* Format message */
    va_list args;
    va_start(args, fmt);
    vsnprintf(e->data, sizeof(e->data), fmt, args);
    va_end(args);

    /* Advance circular buffer */
    log->head = (log->head + 1) % MAX_EVENT_LOG;
}

/* Get event type string */
const char* log_event_type_str(EventType type) {
    switch (type) {
        case EVENT_SYSTEM:    return "SYSTEM";
        case EVENT_INPUT:     return "INPUT";
        case EVENT_PHONEME:   return "PHONEME";
        case EVENT_ANIMATION: return "ANIMATE";
        case EVENT_ERROR:     return "ERROR";
        default:              return "UNKNOWN";
    }
}

/* Get event type color */
const char* log_event_type_color(EventType type) {
    switch (type) {
        case EVENT_SYSTEM:    return COLOR_INFO;
        case EVENT_INPUT:     return COLOR_ACCENT;
        case EVENT_PHONEME:   return COLOR_SUCCESS;
        case EVENT_ANIMATION: return COLOR_WARNING;
        case EVENT_ERROR:     return COLOR_DANGER;
        default:              return COLOR_NEUTRAL;
    }
}
