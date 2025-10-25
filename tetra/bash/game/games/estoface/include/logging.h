/*
 * logging.h - Event logging system for Estoface
 * Similar to pulsar's event log with timestamps and color coding
 */

#ifndef ESTOFACE_LOGGING_H
#define ESTOFACE_LOGGING_H

#include <stdint.h>
#include <time.h>

#define MAX_EVENT_LOG 50
#define MAX_EVENT_DATA 128

/* Event types */
typedef enum {
    EVENT_SYSTEM,
    EVENT_INPUT,
    EVENT_PHONEME,
    EVENT_ANIMATION,
    EVENT_ERROR
} EventType;

/* Event structure */
typedef struct {
    EventType type;
    uint64_t timestamp_ns;
    char data[MAX_EVENT_DATA];
} Event;

/* Event log (circular buffer) */
typedef struct {
    Event events[MAX_EVENT_LOG];
    int head;  /* Next write position */
} EventLog;

/* Initialize event log */
void log_init(EventLog *log);

/* Log an event */
void log_event(EventLog *log, EventType type, const char *fmt, ...);

/* Get current time in nanoseconds */
uint64_t log_now_ns(void);

/* Get event type string */
const char* log_event_type_str(EventType type);

/* Get event type color */
const char* log_event_type_color(EventType type);

#endif /* ESTOFACE_LOGGING_H */
