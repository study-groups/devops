#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define TRIGGER_WORDS_COUNT 10

// Global array of trigger words
const char* triggerWords[TRIGGER_WORDS_COUNT] = 
    {"__","path", "fill", "stroke","class",
     "transform", "m", "l", "c", "d="};

typedef enum { SVG, PATH, OTHER } LineType;

typedef struct LineNode {
    LineType type;
    int length;
    struct LineNode *next;
} LineNode;

#define BUFFER_SIZE 4000

// Function prototypes
LineType getLineType(const char *line);
LineNode *createNode(LineType type, int length);
void insertNode(LineNode **head, LineType type, int length);
void reportSummary(LineNode *head);
void printFormattedLine(char *line, int N);
    
int main(int argc, char *argv[]) {
	char line[32000];
    LineNode *head = NULL;
    int bufferLength = 0;
    int N = 0;
    if( argc == 2)
      N = atoi(argv[1]);
    else
      N=0;

    while (fgets(line, sizeof(line), stdin)) {
        LineType type = getLineType(line);
        int length = strlen(line) - 1; // Adjust for newline character
        insertNode(&head, type, length);

        if (N==0) printf("%s",line);
        else
           printFormattedLine(line,N);
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


void reportSummary(LineNode *head) {
    int lineCount[3] = {0}, totalLines = 0, maxLineLength = 0;

    for (LineNode *current = head; current; current = current->next) {
        lineCount[current->type]++;
        totalLines++;
        if (current->length > maxLineLength) {
            maxLineLength = current->length;
        }
    }

    printf("SVG lines: %d\n", lineCount[SVG]);
    printf("Path lines: %d\n", lineCount[PATH]);
    printf("Other lines: %d\n", lineCount[OTHER]);
    printf("Total lines: %d\n", totalLines);
    printf("Max line length: %d\n", maxLineLength);
}


LineType getLineType(const char *line) {
    if (strncmp(line, "<svg", 4) == 0 ||
        strncmp(line, "</svg",4) == 0 ) return SVG;
    if (strncmp(line, "  <path", 6) == 0) return PATH;
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

void printFormattedLine(char *line, int N) {
    int wordCount = 0;
    bool isFirstWord = true; // To track if we are at the first word
    char *token = strtok(line, " \n");  // Also consider newline as a delimiter

    while (token != NULL) {
        bool isTriggerWord = false;

        // Check if token is a trigger word
        for (int i = 0; i < TRIGGER_WORDS_COUNT; i++) {
            if (strncmp(token, triggerWords[i], strlen(triggerWords[i])) == 0) {
                isTriggerWord = true;
                break;
            }
        }

        // If it's a trigger word and not the first word, print a newline before printing the trigger word
        if (isTriggerWord && !isFirstWord) {
            printf("\n");
            wordCount = 0; // Reset word count after printing a newline
        } else if (!isFirstWord) { // Ensure this is not the first word to avoid leading spaces
            printf(" "); // Print space between words for non-first words
        }

        printf("%s", token); // Print current word
        wordCount++;
        isFirstWord = false; // Update flag as soon as the first word is processed

        // Ensure we do not exceed the word limit per line
        if (wordCount >= N) {
            printf("\n");
            wordCount = 0; // Reset word count after printing a newline
        }

        // Get the next token for the loop
        token = strtok(NULL, " \n");
    }

    // Ensure the output ends with a newline if there were any words printed
    if (!isFirstWord) {
        printf("\n");
    }
}

