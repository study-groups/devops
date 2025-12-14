/*
 * gamepad.c - SDL2 gamepad reader for Pulsar engine
 * Reads gamepad input and writes to FIFO in text protocol format
 *
 * Compile: cc -o gamepad gamepad.c $(sdl2-config --cflags --libs)
 * Usage: ./gamepad /tmp/pulsar_input
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <SDL2/SDL.h>

#define MAX_GAMEPADS 4
#define AXIS_DEADZONE 0.15f
#define UPDATE_RATE_MS 16  /* ~60 FPS */

static volatile int running = 1;
static FILE *output = NULL;

/* Signal handler for clean shutdown */
static void handle_signal(int sig) {
    (void)sig;
    running = 0;
}

/* Clamp axis value to [-1.0, 1.0] and apply deadzone */
static float process_axis(float value) {
    if (value > -AXIS_DEADZONE && value < AXIS_DEADZONE) {
        return 0.0f;
    }

    /* Clamp to valid range */
    if (value < -1.0f) value = -1.0f;
    if (value > 1.0f) value = 1.0f;

    return value;
}

/* Write event to output (FIFO or stdout) */
static void write_event(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vfprintf(output, format, args);
    va_end(args);
    fflush(output);
}

int main(int argc, char *argv[]) {
    const char *fifo_path = NULL;
    SDL_GameController *controllers[MAX_GAMEPADS] = {NULL};
    int controller_count = 0;

    /* Parse arguments */
    if (argc > 1) {
        fifo_path = argv[1];
    }

    /* Setup signal handlers */
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    /* Open output (FIFO or stdout) */
    if (fifo_path) {
        output = fopen(fifo_path, "w");
        if (!output) {
            fprintf(stderr, "ERROR: Cannot open FIFO: %s\n", fifo_path);
            return 1;
        }
        fprintf(stderr, "Writing to FIFO: %s\n", fifo_path);
    } else {
        output = stdout;
        fprintf(stderr, "Writing to stdout (no FIFO specified)\n");
    }

    /* Initialize SDL */
    if (SDL_Init(SDL_INIT_GAMECONTROLLER) < 0) {
        fprintf(stderr, "ERROR: SDL_Init failed: %s\n", SDL_GetError());
        return 1;
    }

    fprintf(stderr, "SDL2 initialized\n");

    /* Load game controller database */
    SDL_GameControllerAddMappingsFromFile("gamecontrollerdb.txt");

    /* Scan for controllers */
    fprintf(stderr, "Scanning for game controllers...\n");
    for (int i = 0; i < SDL_NumJoysticks() && controller_count < MAX_GAMEPADS; i++) {
        if (SDL_IsGameController(i)) {
            SDL_GameController *controller = SDL_GameControllerOpen(i);
            if (controller) {
                controllers[controller_count] = controller;
                const char *name = SDL_GameControllerName(controller);
                fprintf(stderr, "  [%d] %s\n", controller_count, name ? name : "Unknown");
                controller_count++;
            }
        }
    }

    if (controller_count == 0) {
        fprintf(stderr, "WARNING: No game controllers found\n");
        fprintf(stderr, "  - Make sure gamepad is connected\n");
        fprintf(stderr, "  - Check with: system_profiler SPUSBDataType | grep -i game\n");
        /* Continue anyway for hot-plug support */
    } else {
        fprintf(stderr, "Found %d controller(s)\n", controller_count);
    }

    fprintf(stderr, "\nReading gamepad input (Ctrl+C to exit)...\n");

    /* Main loop */
    SDL_Event event;
    while (running) {
        /* Process events */
        while (SDL_PollEvent(&event)) {
            switch (event.type) {
                case SDL_QUIT:
                    running = 0;
                    break;

                case SDL_CONTROLLERAXISMOTION: {
                    /* Find controller index */
                    int player = -1;
                    for (int i = 0; i < controller_count; i++) {
                        if (controllers[i] &&
                            SDL_JoystickInstanceID(SDL_GameControllerGetJoystick(controllers[i])) == event.caxis.which) {
                            player = i;
                            break;
                        }
                    }

                    if (player >= 0) {
                        float value = event.caxis.value / 32767.0f;
                        value = process_axis(value);

                        /* Map SDL axis to protocol axis */
                        int axis = -1;
                        switch (event.caxis.axis) {
                            case SDL_CONTROLLER_AXIS_LEFTX:        axis = 0; break;
                            case SDL_CONTROLLER_AXIS_LEFTY:        axis = 1; break;
                            case SDL_CONTROLLER_AXIS_RIGHTX:       axis = 2; break;
                            case SDL_CONTROLLER_AXIS_RIGHTY:       axis = 3; break;
                            case SDL_CONTROLLER_AXIS_TRIGGERLEFT:  axis = 4; break;
                            case SDL_CONTROLLER_AXIS_TRIGGERRIGHT: axis = 5; break;
                        }

                        if (axis >= 0) {
                            write_event("AXIS %d %d %.3f\n", player, axis, value);
                        }
                    }
                    break;
                }

                case SDL_CONTROLLERBUTTONDOWN:
                case SDL_CONTROLLERBUTTONUP: {
                    /* Find controller index */
                    int player = -1;
                    for (int i = 0; i < controller_count; i++) {
                        if (controllers[i] &&
                            SDL_JoystickInstanceID(SDL_GameControllerGetJoystick(controllers[i])) == event.cbutton.which) {
                            player = i;
                            break;
                        }
                    }

                    if (player >= 0) {
                        int state = (event.type == SDL_CONTROLLERBUTTONDOWN) ? 1 : 0;
                        int button = event.cbutton.button;
                        write_event("BUTTON %d %d %d\n", player, button, state);
                    }
                    break;
                }

                case SDL_CONTROLLERDEVICEADDED: {
                    /* Hot-plug support */
                    int device_index = event.cdevice.which;
                    if (controller_count < MAX_GAMEPADS && SDL_IsGameController(device_index)) {
                        SDL_GameController *controller = SDL_GameControllerOpen(device_index);
                        if (controller) {
                            controllers[controller_count] = controller;
                            const char *name = SDL_GameControllerName(controller);
                            fprintf(stderr, "[HOT-PLUG] Added controller %d: %s\n",
                                    controller_count, name ? name : "Unknown");
                            controller_count++;
                        }
                    }
                    break;
                }

                case SDL_CONTROLLERDEVICEREMOVED: {
                    /* Hot-unplug support */
                    for (int i = 0; i < controller_count; i++) {
                        if (controllers[i] &&
                            SDL_JoystickInstanceID(SDL_GameControllerGetJoystick(controllers[i])) == event.cdevice.which) {
                            fprintf(stderr, "[HOT-PLUG] Removed controller %d\n", i);
                            SDL_GameControllerClose(controllers[i]);
                            controllers[i] = NULL;
                            break;
                        }
                    }
                    break;
                }
            }
        }

        SDL_Delay(UPDATE_RATE_MS);
    }

    /* Cleanup */
    fprintf(stderr, "\nShutting down...\n");
    for (int i = 0; i < controller_count; i++) {
        if (controllers[i]) {
            SDL_GameControllerClose(controllers[i]);
        }
    }

    SDL_Quit();

    if (output && output != stdout) {
        fclose(output);
    }

    return 0;
}
