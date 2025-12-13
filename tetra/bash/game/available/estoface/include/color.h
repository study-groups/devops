/*
 * color.h - ANSI color system for Estoface
 * Based on pulsar's valence-based color scheme
 */

#ifndef ESTOFACE_COLOR_H
#define ESTOFACE_COLOR_H

/* ANSI Escape sequences */
#define ESC "\x1b"
#define CSI ESC "["

/* Reset */
#define COLOR_RESET CSI "0m"

/* Foreground colors */
#define COLOR_BLACK   CSI "30m"
#define COLOR_RED     CSI "31m"
#define COLOR_GREEN   CSI "32m"
#define COLOR_YELLOW  CSI "33m"
#define COLOR_BLUE    CSI "34m"
#define COLOR_MAGENTA CSI "35m"
#define COLOR_CYAN    CSI "36m"
#define COLOR_WHITE   CSI "37m"

/* Bold colors */
#define COLOR_BOLD_BLACK   CSI "1;30m"
#define COLOR_BOLD_RED     CSI "1;31m"
#define COLOR_BOLD_GREEN   CSI "1;32m"
#define COLOR_BOLD_YELLOW  CSI "1;33m"
#define COLOR_BOLD_BLUE    CSI "1;34m"
#define COLOR_BOLD_MAGENTA CSI "1;35m"
#define COLOR_BOLD_CYAN    CSI "1;36m"
#define COLOR_BOLD_WHITE   CSI "1;37m"

/* Dim colors */
#define COLOR_DIM CSI "2m"

/* Semantic colors (following pulsar convention) */
#define COLOR_NEUTRAL  COLOR_WHITE         /* Default text */
#define COLOR_INFO     COLOR_CYAN          /* Informational */
#define COLOR_SUCCESS  COLOR_GREEN         /* Success/positive */
#define COLOR_WARNING  COLOR_YELLOW        /* Warning/caution */
#define COLOR_DANGER   COLOR_RED           /* Error/danger */
#define COLOR_ACCENT   COLOR_MAGENTA       /* Highlights/accents */

/* UI element colors */
#define COLOR_HEADER       COLOR_BOLD_CYAN
#define COLOR_LABEL        COLOR_CYAN
#define COLOR_VALUE        COLOR_WHITE
#define COLOR_IPA_SYMBOL   COLOR_BOLD_GREEN
#define COLOR_IPA_DESC     COLOR_GREEN
#define COLOR_PHONEME      COLOR_YELLOW
#define COLOR_ARTICULATOR  COLOR_MAGENTA
#define COLOR_STATUS_BAR   COLOR_CYAN
#define COLOR_MODE_ACTIVE  COLOR_BOLD_GREEN
#define COLOR_MODE_IDLE    COLOR_DIM

/* Valence enumeration (0-5, matching pulsar) */
typedef enum {
    VALENCE_NEUTRAL  = 0,
    VALENCE_INFO     = 1,
    VALENCE_SUCCESS  = 2,
    VALENCE_WARNING  = 3,
    VALENCE_DANGER   = 4,
    VALENCE_ACCENT   = 5
} ColorValence;

/* Get color string for valence level */
static inline const char* color_for_valence(ColorValence v) {
    switch (v) {
        case VALENCE_NEUTRAL:  return COLOR_NEUTRAL;
        case VALENCE_INFO:     return COLOR_INFO;
        case VALENCE_SUCCESS:  return COLOR_SUCCESS;
        case VALENCE_WARNING:  return COLOR_WARNING;
        case VALENCE_DANGER:   return COLOR_DANGER;
        case VALENCE_ACCENT:   return COLOR_ACCENT;
        default:               return COLOR_RESET;
    }
}

#endif /* ESTOFACE_COLOR_H */
