#MULTICAT_START
# dir: .
# file: README.md
# note: A simple README for the MULTICAT specification project.
#MULTICAT_END
# MULTICAT Specification

This project provides a definitive guide and example for generating the MULTICAT file format, designed for use with Large Language Models (LLMs).

The primary instruction set for the LLM is located in `docs/GENERATING_MULTICAT.md`.

A simple shell script for extracting files from a `.mc` (MultiCat) file is provided in `scripts/unmulticat.sh`.

#MULTICAT_START
# dir: ./docs
# file: GENERATING_MULTICAT.md
# note: The complete and detailed instructions for an LLM to generate this format.
#MULTICAT_END
# LLM Generation Guide: The MULTICAT Format

## 1. The Cardinal Rule: The Single Code Block

Your entire response MUST be a single, contiguous markdown code block. It must begin with ```multicat and conclude with a final ```. There must be no text or characters before the opening ```multicat or after the closing ```.

**Example Structure:**
````

[Your entire response starts here -\>]`multicat #MULTICAT_START ... file 1 content ... #MULTICAT_START ... file 2 content ... [Your entire response ends here ->]`

````

## 2. The File Delimiter Block

Every file you generate must be encapsulated in a MULTICAT delimiter block. This block serves as the header and provides metadata for the file that follows.

### Header Format (MANDATORY)

The header is composed of exactly four lines:

1.  `#MULTICAT_START`: The opening delimiter.
2.  `# dir: ./path/to/directory`: The relative directory where the file should be placed. Use `.` for the root directory.
3.  `# file: filename.ext`: The name of the file, including its extension.
4.  `# note: A brief, one-line description of the file's purpose.`: A concise note for human readability.
5.  `#MULTICAT_END`: The closing delimiter.

### Content Placement

The raw content of the file must begin IMMEDIATELY on the line following `#MULTICAT_END`. There must be no extra blank lines between the delimiter and the file content.

## 3. Content Rules

- **Raw Content Only:** The content for each file must be raw text. Do not add any markdown formatting (like ```, bolding, italics, etc.) within the file content itself unless that formatting is part of the file's source code (e.g., in a Markdown file).
- **No Internal Delimiters:** The file content must not contain the `#MULTICAT_START` string, as this would be misinterpreted by parsers.
- **Contiguous Blocks:** Each `#MULTICAT_START` block must follow immediately after the content of the previous file. There should be no blank lines between the end of one file's content and the start of the next `#MULTICAT_START` header.

## 4. Final Checklist

Before finalizing your response, verify the following:
- [ ] Does my entire response exist within a single ```multicat block?
- [ ] Does the response start with `#MULTICAT_START` on the very first line inside the code block?
- [ ] Is every file preceded by a complete and correct 4-line header and a `#MULTICAT_END` delimiter?
- [ ] Is all file content raw and placed immediately after its `#MULTICAT_END` delimiter?
- [ ] Are there no blank lines between file sections?
- [ ] Are there no ``` sequences anywhere inside the main code block?

Adherence to this specification is paramount for ensuring the output can be parsed automatically.

#MULTICAT_START
# dir: ./scripts
# file: unmulticat.sh
# note: A simple shell script to extract files from a .mc file.
#MULTICAT_END
#!/bin/bash
#
# unmulticat.sh - A simple utility to extract files from a MULTICAT (.mc) file.
# Usage: ./unmulticat.sh < input_file.mc

if [ -t 0 ]; then
    echo "This script requires input via pipe or redirection."
    echo "Usage: ./unmulticat.sh < input_file.mc"
    exit 1
fi

CWD=$(pwd)
TEMP_DIR=$(mktemp -d)

# Use csplit to break the input file into pieces based on the delimiter
csplit -s -f "$TEMP_DIR/file_" -b "%03d.part" - "/^#MULTICAT_START/" "{*}"

for part_file in "$TEMP_DIR"/*.part; do
    # Skip empty parts (usually the first one)
    [ -s "$part_file" ] || continue

    # Extract metadata
    DIR=$(grep "^# dir:" "$part_file" | sed 's/# dir: //')
    FILE=$(grep "^# file:" "$part_file" | sed 's/# file: //')

    # Extract content (everything after #MULTICAT_END)
    CONTENT=$(sed '1,/^#MULTICAT_END/d' "$part_file")

    if [ -n "$DIR" ] && [ -n "$FILE" ]; then
        TARGET_PATH="$CWD/$DIR/$FILE"

        echo "Extracting -> $TARGET_PATH"

        # Create directory if it doesn't exist
        mkdir -p "$(dirname "$TARGET_PATH")"

        # Write the content to the file
        echo -n "$CONTENT" > "$TARGET_PATH"
    fi
done

# Clean up temporary files
rm -rf "$TEMP_DIR"

echo "Extraction complete."