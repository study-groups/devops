package main

import "log"

// Middleware enhances the store's dispatch function to handle side effects.
type Middleware func(store *Store) func(next Dispatcher) Dispatcher

// Dispatcher is the function signature for dispatching actions.
type Dispatcher func(action Action)

// CommandMiddleware handles actions that need to execute shell commands.
type CommandMiddleware struct {
	executor *Executor
}

func NewCommandMiddleware(executor *Executor) *CommandMiddleware {
	return &CommandMiddleware{executor: executor}
}

func (cm *CommandMiddleware) Middleware(store *Store) func(next Dispatcher) Dispatcher {
	return func(next Dispatcher) Dispatcher {
		return func(action Action) {
			// Pass through non-command actions.
			execAction, ok := action.(ExecuteCommandAction)
			if !ok {
				next(action)
				return
			}

			// Handle the command execution in a goroutine to avoid blocking the UI.
			go func() {
				state := store.GetState()
				log.Printf("Executing command for panel '%s'", execAction.PanelName)
				output, err := cm.executor.Execute(execAction.Command, state.CurrentFile, state.Pwd)
				if err != nil {
					log.Printf("Error executing command for panel '%s': %v", execAction.PanelName, err)
					// You could dispatch an error action here if needed.
					return
				}

				// Dispatch a new action with the result.
				store.Dispatch(CommandOutputAction{
					PanelName: execAction.PanelName,
					Output:    output,
				})
			}()
		}
	}
}
