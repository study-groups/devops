#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

typedef enum { SVG, PATH, OTHER } LineType;

typedef struct LineNode {
    LineType type;
    int length;
    struct LineNode *next;
} LineNode;

// Function prototypes
LineType getLineType(const char *line);
LineNode *createNode(LineType type, int length);
void insertNode(LineNode **head, LineType type, int length);
void reportSummary(LineNode *head);

int main() {
    char line[32000];
    LineNode *head = NULL;

    while (fgets(line, sizeof(line), stdin)) {
        printf("%s",line);
        LineType type = getLineType(line);
        int length = strlen(line) - 1; // Adjust for newline character
        insertNode(&head, type, length);
    }

    reportSummary(head);

    // Free the linked list
    LineNode *temp;
    while (head) {
        temp = head;
        head = head->next;
        free(temp);
    }

    return 0;
}

LineType getLineType(const char *line) {
    if (strncmp(line, "<svg", 4) == 0) return SVG;
    if (strncmp(line, " <path", 6) == 0) return PATH;
    return OTHER;
}

LineNode *createNode(LineType type, int length) {
    LineNode *node = malloc(sizeof(LineNode));
    if (!node) {
        fprintf(stderr, "Failed to allocate memory for node.\n");
        exit(1);
    }
    node->type = type;
    node->length = length;
    node->next = NULL;
    return node;
}

void insertNode(LineNode **head, LineType type, int length) {
    LineNode *node = createNode(type, length);
    node->next = *head;
    *head = node;
}

void reportSummary(LineNode *head) {
    int lineCount[3] = {0}, totalLines = 0, maxLineLength = 0;

    for (LineNode *current = head; current; current = current->next) {
        lineCount[current->type]++;
        totalLines++;
        if (current->length > maxLineLength)
            maxLineLength = current->length;
    }

    fprintf(stderr, "SVG lines: %d\n", lineCount[SVG]);
    fprintf(stderr, "Path lines: %d\n", lineCount[PATH]);
    fprintf(stderr, "Other lines: %d\n", lineCount[OTHER]);
    fprintf(stderr, "Total lines: %d\n", totalLines);
    fprintf(stderr, "Max line length: %d\n", maxLineLength);
}
