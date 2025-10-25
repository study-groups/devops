/*
 * gamepad.c - Gamepad input with zone detection
 *
 * Implements natural discretization of analog sticks into 4x4 zones
 * for learning-based mouth articulation control
 */

#include "gamepad.h"
#include "state.h"
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <math.h>
#include <errno.h>

/* Internal state */
static int gamepad_socket = -1;
static GamepadState gamepad_state;

/* Zone boundaries */
static const float ZONE_BOUNDARIES[ZONE_COUNT + 1] = {
    -1.0f,   /* ZONE_NEG_FULL start */
    -0.5f,   /* ZONE_NEG_HALF start */
    0.0f,    /* ZONE_POS_HALF start */
    0.5f,    /* ZONE_POS_FULL start */
    1.0f     /* ZONE_POS_FULL end */
};

/* Initialize gamepad system */
int gamepad_init(EstofaceContext *ctx, const char *socket_path) {
    (void)ctx;  /* Context used for future expansion */

    memset(&gamepad_state, 0, sizeof(gamepad_state));

    /* Remove old socket if exists */
    unlink(socket_path);

    /* Create Unix domain datagram socket */
    gamepad_socket = socket(AF_UNIX, SOCK_DGRAM, 0);
    if (gamepad_socket < 0) {
        return -1;
    }

    /* Make non-blocking */
    int flags = fcntl(gamepad_socket, F_GETFL, 0);
    fcntl(gamepad_socket, F_SETFL, flags | O_NONBLOCK);

    /* Bind to socket path */
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, socket_path, sizeof(addr.sun_path) - 1);

    if (bind(gamepad_socket, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        close(gamepad_socket);
        gamepad_socket = -1;
        return -1;
    }

    /* Increase receive buffer */
    int rcvbuf = 256 * 1024;
    setsockopt(gamepad_socket, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof(rcvbuf));

    return 0;
}

/* Cleanup gamepad system */
void gamepad_cleanup(EstofaceContext *ctx) {
    (void)ctx;

    if (gamepad_socket >= 0) {
        close(gamepad_socket);
        gamepad_socket = -1;
    }
}

/* Convert raw axis value to zone index with hysteresis */
int gamepad_axis_to_zone(float axis, float prev_axis) {
    /* Apply deadzone */
    if (axis > -ZONE_DEADZONE && axis < ZONE_DEADZONE) {
        axis = 0.0f;
    }

    /* Clamp to [-1.0, 1.0] */
    if (axis < -1.0f) axis = -1.0f;
    if (axis > 1.0f) axis = 1.0f;

    /* Find zone */
    int zone = 0;
    for (int i = 0; i < ZONE_COUNT; i++) {
        if (axis >= ZONE_BOUNDARIES[i] && axis < ZONE_BOUNDARIES[i + 1]) {
            zone = i;
            break;
        }
    }

    /* Hysteresis: if close to boundary and previous was different zone */
    if (prev_axis != 0.0f) {
        int prev_zone = 0;
        for (int i = 0; i < ZONE_COUNT; i++) {
            if (prev_axis >= ZONE_BOUNDARIES[i] && prev_axis < ZONE_BOUNDARIES[i + 1]) {
                prev_zone = i;
                break;
            }
        }

        /* If near boundary, stick to previous zone */
        if (zone != prev_zone) {
            float dist_to_boundary = 999.0f;

            /* Check distance to all boundaries */
            for (int i = 1; i < ZONE_COUNT; i++) {
                float d = fabsf(axis - ZONE_BOUNDARIES[i]);
                if (d < dist_to_boundary) {
                    dist_to_boundary = d;
                }
            }

            /* If within hysteresis range, use previous zone */
            if (dist_to_boundary < ZONE_HYSTERESIS) {
                zone = prev_zone;
            }
        }
    }

    return zone;
}

/* Calculate how centered we are in a zone (0.0 = edge, 1.0 = center) */
float gamepad_zone_confidence(float axis, int zone) {
    if (zone < 0 || zone >= ZONE_COUNT) return 0.0f;

    float zone_start = ZONE_BOUNDARIES[zone];
    float zone_end = ZONE_BOUNDARIES[zone + 1];
    float zone_center = (zone_start + zone_end) / 2.0f;
    float zone_width = zone_end - zone_start;

    /* Distance from center */
    float dist_from_center = fabsf(axis - zone_center);

    /* Confidence: 1.0 at center, 0.0 at edge */
    float confidence = 1.0f - (dist_from_center / (zone_width / 2.0f));

    /* Clamp */
    if (confidence < 0.0f) confidence = 0.0f;
    if (confidence > 1.0f) confidence = 1.0f;

    return confidence;
}

/* Update zone detection from raw axes */
void gamepad_update_zones(GamepadState *state) {
    /* Previous raw values for hysteresis */
    static float prev_left_x = 0.0f;
    static float prev_left_y = 0.0f;
    static float prev_right_x = 0.0f;
    static float prev_right_y = 0.0f;

    /* Save previous zones */
    state->prev_left_zone = state->left_zone;
    state->prev_right_zone = state->right_zone;

    /* Calculate new zones */
    int new_left_x = gamepad_axis_to_zone(state->left_x, prev_left_x);
    int new_left_y = gamepad_axis_to_zone(state->left_y, prev_left_y);
    int new_right_x = gamepad_axis_to_zone(state->right_x, prev_right_x);
    int new_right_y = gamepad_axis_to_zone(state->right_y, prev_right_y);

    /* Update left zone */
    state->left_zone.x = new_left_x;
    state->left_zone.y = new_left_y;
    state->left_zone.confidence = (gamepad_zone_confidence(state->left_x, new_left_x) +
                                    gamepad_zone_confidence(state->left_y, new_left_y)) / 2.0f;

    /* Update right zone */
    state->right_zone.x = new_right_x;
    state->right_zone.y = new_right_y;
    state->right_zone.confidence = (gamepad_zone_confidence(state->right_x, new_right_x) +
                                     gamepad_zone_confidence(state->right_y, new_right_y)) / 2.0f;

    /* Track zone stability */
    if (state->left_zone.x == state->prev_left_zone.x &&
        state->left_zone.y == state->prev_left_zone.y) {
        state->left_zone_frames++;
    } else {
        state->left_zone_frames = 0;
    }

    if (state->right_zone.x == state->prev_right_zone.x &&
        state->right_zone.y == state->prev_right_zone.y) {
        state->right_zone_frames++;
    } else {
        state->right_zone_frames = 0;
    }

    /* Mark as stable after 3 frames in same zone */
    state->left_zone.stable = (state->left_zone_frames >= 3);
    state->right_zone.stable = (state->right_zone_frames >= 3);

    /* Save current values for next frame */
    prev_left_x = state->left_x;
    prev_left_y = state->left_y;
    prev_right_x = state->right_x;
    prev_right_y = state->right_y;
}

/* Poll gamepad input (non-blocking) */
void gamepad_poll(EstofaceContext *ctx) {
    (void)ctx;

    if (gamepad_socket < 0) return;

    struct gp_msg msg;
    ssize_t n = recv(gamepad_socket, &msg, sizeof(msg), 0);

    if (n < 0) {
        if (errno != EAGAIN && errno != EWOULDBLOCK) {
            /* Real error */
        }
        return;
    }

    if (n != sizeof(msg)) return;
    if (msg.version != 1) return;
    if (msg.player_id != 0) return;  /* Only player 0 for now */

    /* Update raw axes (normalize from int16_t to float) */
    gamepad_state.left_x = (msg.n_axes > 0) ? (msg.axes[0] / 32767.0f) : 0.0f;
    gamepad_state.left_y = (msg.n_axes > 1) ? (msg.axes[1] / 32767.0f) : 0.0f;
    gamepad_state.right_x = (msg.n_axes > 2) ? (msg.axes[2] / 32767.0f) : 0.0f;
    gamepad_state.right_y = (msg.n_axes > 3) ? (msg.axes[3] / 32767.0f) : 0.0f;
    gamepad_state.left_trigger = (msg.n_axes > 4) ? ((msg.axes[4] + 32768) / 65535.0f) : 0.0f;
    gamepad_state.right_trigger = (msg.n_axes > 5) ? ((msg.axes[5] + 32768) / 65535.0f) : 0.0f;

    /* Update buttons */
    gamepad_state.buttons = msg.buttons;

    /* Update metadata */
    gamepad_state.last_seq = msg.seq;
    gamepad_state.last_update_ns = msg.t_mono_ns;

    /* Update zone detection */
    gamepad_update_zones(&gamepad_state);
}

/* Get current gamepad state */
const GamepadState* gamepad_get_state(const EstofaceContext *ctx) {
    (void)ctx;
    return &gamepad_state;
}

/* Apply gamepad zones to facial state */
void gamepad_apply_to_face(const GamepadState *gp, FacialState *face) {
    /* Left stick controls tongue (4x4 = 16 positions) */
    /* Map zone X to tongue frontness, zone Y to tongue height */

    /* Zone to parameter mapping (0-3 -> 0.0-1.0) */
    float tongue_frontness_targets[4] = {0.1f, 0.4f, 0.6f, 0.9f};
    float tongue_height_targets[4] = {0.1f, 0.4f, 0.6f, 0.9f};

    /* Right stick controls jaw/lips (4x4 = 16 positions) */
    /* Map zone X to lip rounding, zone Y to jaw openness */
    float lip_rounding_targets[4] = {0.0f, 0.3f, 0.6f, 0.9f};
    float jaw_openness_targets[4] = {0.9f, 0.6f, 0.3f, 0.1f};  /* Inverted Y */

    /* Apply left stick to tongue */
    if (gp->left_zone.stable) {
        face->tongue_frontness = tongue_frontness_targets[gp->left_zone.x];
        face->tongue_height = tongue_height_targets[gp->left_zone.y];
    }

    /* Apply right stick to jaw/lips */
    if (gp->right_zone.stable) {
        face->lip_rounding = lip_rounding_targets[gp->right_zone.x];
        face->jaw_openness = jaw_openness_targets[gp->right_zone.y];
    }

    /* Triggers for additional control */
    if (gp->left_trigger > 0.5f) {
        face->lip_protrusion = gp->left_trigger;
    }

    if (gp->right_trigger > 0.5f) {
        face->lip_compression = gp->right_trigger;
    }
}

/* Handle D-pad for fine parameter adjustment */
void gamepad_handle_dpad(const GamepadState *gp, FacialState *face, float delta) {
    /* D-pad UP: increase lip protrusion */
    if (gp->buttons & BTN_DPAD_UP) {
        face->lip_protrusion = state_clamp(face->lip_protrusion + delta);
    }

    /* D-pad DOWN: decrease lip protrusion */
    if (gp->buttons & BTN_DPAD_DOWN) {
        face->lip_protrusion = state_clamp(face->lip_protrusion - delta);
    }

    /* D-pad LEFT: toggle tongue grooved */
    static int prev_left = 0;
    if ((gp->buttons & BTN_DPAD_LEFT) && !prev_left) {
        face->tongue_grooved = (face->tongue_grooved > 0.5f) ? 0.0f : 1.0f;
    }
    prev_left = (gp->buttons & BTN_DPAD_LEFT) ? 1 : 0;

    /* D-pad RIGHT: toggle velum */
    static int prev_right = 0;
    if ((gp->buttons & BTN_DPAD_RIGHT) && !prev_right) {
        face->velum_lowered = (face->velum_lowered > 0.5f) ? 0.0f : 1.0f;
    }
    prev_right = (gp->buttons & BTN_DPAD_RIGHT) ? 1 : 0;
}
