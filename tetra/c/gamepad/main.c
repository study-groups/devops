#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <linux/joystick.h>
#include <time.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <gamepad_index>\n", argv[0]);
        return 1;
    }

    char device_path[20];
    snprintf(device_path, sizeof(device_path), "/dev/input/js%s", argv[1]);

    int fd = open(device_path, O_RDONLY);
    if (fd == -1) {
        perror("Error opening device");
        return 1;
    }

    struct js_event event;
    ssize_t bytes;

    struct timespec prev_time, curr_time;
    clock_gettime(CLOCK_MONOTONIC, &prev_time);

    while (1) {
        bytes = read(fd, &event, sizeof(event));
        if (bytes != sizeof(event)) {
            perror("Error reading event");
            close(fd);
            return 1;
        }

        clock_gettime(CLOCK_MONOTONIC, &curr_time);
        unsigned long delta_time_ms = (curr_time.tv_sec - prev_time.tv_sec) * 1000 +
                                      (curr_time.tv_nsec - prev_time.tv_nsec) / 1000000;

        printf("Delta Time: %lu ms\n", delta_time_ms);
        printf("Event Type: %u\n", event.type);
        printf("Event Value: %d\n", event.value);
        printf("Event Number: %u\n", event.number);
        printf("-----------------------------------\n");

        prev_time = curr_time;
    }

    close(fd);
    return 0;
}
