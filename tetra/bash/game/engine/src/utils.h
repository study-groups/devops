/*
 * utils.h - Shared utility functions
 */

#ifndef UTILS_H
#define UTILS_H

#include "types.h"
#include <stdint.h>

/* Time utilities */
uint64_t now_ns(void);

/* Event logging */
void log_event(const char *type, uint32_t user_id, const char *data);

/* Sprite counting */
int sprite_count_helper(const Sprite *sprites, int max_sprites);

#endif /* UTILS_H */
