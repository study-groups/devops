#!/usr/bin/env bash

# QA REPL - Interactive Question & Answer system

qa_repl() {
    echo "QA Interactive REPL - Question & Answer System"
    echo "Type 'help' for commands, 'exit' to quit"
    echo "Current engine: $(_get_qa_engine)"
    echo "Current context: $(_get_qa_context)"
    echo

    while true; do
        printf "qa> "
        read -r input

        case "$input" in
            "exit"|"quit"|"q")
                echo "Goodbye!"
                break
                ;;
            "help"|"h")
                qa_help
                ;;
            "status"|"s")
                qa_status
                ;;
            "engine"*)
                local engine=$(echo "$input" | cut -d' ' -f2-)
                if [[ -n "$engine" ]]; then
                    qa_set_engine "$engine"
                    echo "Engine set to: $engine"
                else
                    echo "Current engine: $(_get_qa_engine)"
                fi
                ;;
            "context"*)
                local context=$(echo "$input" | cut -d' ' -f2-)
                if [[ -n "$context" ]]; then
                    qa_set_context "$context"
                    echo "Context set to: $context"
                else
                    echo "Current context: $(_get_qa_context)"
                fi
                ;;
            "apikey"*)
                local apikey=$(echo "$input" | cut -d' ' -f2-)
                if [[ -n "$apikey" ]]; then
                    qa_set_apikey "$apikey"
                    echo "API key updated"
                else
                    echo "Current API key file: $OPENAI_API_FILE"
                fi
                ;;
            "last"|"a")
                a
                ;;
            "test")
                qa_test
                ;;
            "")
                # Empty input, continue
                ;;
            *)
                # Treat as query
                echo "Querying: $input"
                qq "$input"
                ;;
        esac
    done
}

# REPL function available when module is loaded