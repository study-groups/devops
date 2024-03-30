#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <linux/joystick.h>
#include <X11/Xlib.h>
#include <X11/extensions/XTest.h>

// alias b='gcc gp2.c -o gp2 -lX11 -lXtst'

// If getenv("GAMEPAD_INDEX") fails  
#define DEFAULT_GAMEPAD_INDEX 1

// Function to map the range of event 
// values to reasonable mouse simulation values
int map_value(int value) {
    return (value * 2) / 1024; // adjust as needed
}

void simulate_mouse_motion(int x, int y) {
    Display *display = XOpenDisplay(NULL);
    if (display == NULL) {
        fprintf(stderr, "Error: Unable to open X display.\n");
        exit(1);
    }

    XTestFakeRelativeMotionEvent(display, x, y, CurrentTime);
    XCloseDisplay(display);
}

void simulate_mouse_button_press() {
    Display *display = XOpenDisplay(NULL);
    if (display == NULL) {
        fprintf(stderr, "Error: Unable to open X display.\n");
        exit(1);
    }

    XTestFakeButtonEvent(display, 1, 1, CurrentTime);
    XTestFakeButtonEvent(display, 1, 0, CurrentTime);
    XCloseDisplay(display);
}

int main() {
    char device_path[20];

    char *gamepad_index_str = getenv("GAMEPAD_INDEX");
  	int gamepad_index = DEFAULT_GAMEPAD_INDEX;

    if (gamepad_index_str != NULL) {
        gamepad_index = atoi(gamepad_index_str);
    }

    snprintf(device_path, sizeof(device_path),
		 "/dev/input/js%d", gamepad_index);

    int fd = open(device_path, O_RDONLY);
    if (fd == -1) {
        perror("Error opening device");
        return 1;
    }

    struct js_event event;
    ssize_t bytes;

    while (1) {
        bytes = read(fd, &event, sizeof(event));
        if (bytes != sizeof(event)) {
            perror("Error reading event");
            close(fd);
            return 1;
        }

        printf("%d %d %d\n", event.type, event.number, event.value);
        switch (event.type) {
            case JS_EVENT_AXIS:
                if (event.number == 2) {
                    int x_motion = map_value(event.value);
                    simulate_mouse_motion(x_motion, 0);
                } else if (event.number == 3) {
                    int y_motion = map_value(event.value);
                    simulate_mouse_motion(0, y_motion);
                }
                break;
            case JS_EVENT_BUTTON:
                if (event.number == 1 && event.value == 1) {
                    simulate_mouse_button_press();
                }
                break;
            default:
                // Ignore other event types
                break;
        }
    }

    close(fd);
    return 0;
}
