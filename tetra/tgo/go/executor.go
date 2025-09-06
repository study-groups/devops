package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

// Executor runs shell commands to generate panel content.
type Executor struct{}

func NewExecutor() *Executor {
	return &Executor{}
}

// Execute runs the provided shell command string.
// It injects core state as environment variables: TGO_FILE and TGO_PWD.
func (e *Executor) Execute(command string, currentFile string, pwd string) (string, error) {
	if command == "" {
		return "", fmt.Errorf("command is empty")
	}

	cmd := exec.Command("bash", "-c", command)
	cmd.Env = append(cmd.Environ(),
		fmt.Sprintf("TGO_FILE=%s", currentFile),
		fmt.Sprintf("TGO_PWD=%s", pwd),
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	if err != nil {
		errorMsg := fmt.Sprintf("Command failed: %s\n--- STDERR ---\n%s", err.Error(), stderr.String())
		if stdout.Len() > 0 {
			errorMsg += fmt.Sprintf("\n--- STDOUT ---\n%s", stdout.String())
		}
		return strings.TrimSpace(errorMsg), nil
	}

	return stdout.String(), nil
}
