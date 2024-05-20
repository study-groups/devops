tetra_help_pm_start_session_creation() {
    cat << EOF
Session Creation in tmux:
-------------------------
Creating a new session in tmux is done with:
tmux new-session -d -s session_name "command"
This command creates a new session named 'session_name'.
If '-d' is used, the session starts detached, running in
the background. The "command" specifies the initial
command to run within the new session. This setup allows
for isolated execution environments within tmux.
EOF
}

tetra_help_pm_start_io_redirection() {
    cat << EOF
I/O Redirection in tmux Sessions:
---------------------------------
By default, stdout and stderr from commands run in a tmux
session are captured by tmux. If attached to the session,
you'll see this output in the pane. For detached sessions,
tmux stores this output, which can be viewed upon
attaching. This mechanism ensures that output is not lost
and can be reviewed or monitored as needed.
EOF
}

tetra_help_pm_start_configuration_changes() {
    cat << EOF
Configuration Changes in tmux:
------------------------------
Starting a session with a command can alter the tmux
environment for that session. Commands that modify
environment variables or change the shell state affect
only that session's environment. tmux maintains separate
environments for each session, ensuring isolation from
the system and other sessions.
EOF
}

tetra_help_pm_start_stdout_capture() {
    cat << EOF
Capturing stdout in tmux:
-------------------------
stdout from commands in tmux can be "captured" outside
the session using 'tee' or redirection. For example,
using './entrypoint.sh 2>&1 | tee -a \$LOG_FILE' captures
stdout and stderr, logging them to a file and optionally
displaying them in the terminal. This allows for external
access to command output while maintaining session
isolation.
EOF
}

tetra_help_pm_show_full_command() {
    cat << EOF

Summary:
The 'full_command' is executed within a new
tmux session created by the 'tetra_pm_start'
function. This session is independent of the
terminal where it was initiated, allowing the
process to run in a controlled and isolated
environment.

Conclusion:
Each managed process runs in a clean environment,set up by
'base_command', and executes the specified 'command'.
The tmux session, as a child of the initiating shell,
allows the process to continue running even if the parent
terminal is closed, providing stability and independence
from the parent shell's state or configuration.
EOF
}
# Display help information
tetra_help_pm() {
    cat << EOF
Tetra PM - tmux based process manager
-------------------------------------
tetra_pm_start <name>: Start a new process in <name> directory
tetra_pm_stop <name>: Stop the process with <name>
tetra_pm_list: List all running processes
tetra_pm_attach <name>: Attach to the process session <name>
tetra_pm_attach_main: Attach to the main management session
-------------------------------------
EOF
}


tetra_help_pm_start(){
    cat << EOF
Starting a process in Tetra PM:

1. The process is initiated using the 'tetra_pm_start' command followed
   by the process name.
2. A new tmux session is created in the background to run the process.
3. The session is named based on the process name and a unique identifier.
4. The command executed in the session is constructed with a clean
   environment and minimal shell initialization.
5. The output of the command is redirected to both the terminal and the
   log file for monitoring and debugging.

To start a process, use the following command:
tetra_pm_start <process_name>

EOF
}

tetra_help_pm_start_details() {
    cat << EOF

    Internally the following concepts can be identified with tetra_pm_start:

+--------------------------------------------------+
| Variables and Concepts                           |
+--------------------------------------------------+
| process_name: tetra_pm_\$1                       |
| entrypoint: \${process_dir}/entrypoint.sh        |
| base_command: construct_command()                |
| command: cd \${process_dir} && ./entrypoint.sh   |
+--------------------------------------------------+
| Function Calls                                   |
+--------------------------------------------------+
| _tetra_pm_check_session_exists                   |
| _tetra_pm_check_session_and_script               |
| _tetra_pm_construct_base_command                 |
| _tetra_pm_construct_full_command                 |
| _tetra_pm_start_tmux_session                     |
+--------------------------------------------------+
| Actions                                          |
+--------------------------------------------------+
| 1. Check session existence and script validity   |
| 2. Construct base command via construct_command()|
| 3. Construct full command for the session        |
| 4. Start a new tmux session with the constructed |
|    commands                                      |
| 5. Log the session start                         |
+--------------------------------------------------+
EOF
}

tetra_help_pm_start_concepts() {
    cat << EOF
+------------------------------------------------+
| Key Concepts of tetra_pm_start                 |
+------------------------------------------------+
| entrypoint:                                    |
|   Path to the script to be executed.           |
|   Typically \${process_dir}/entrypoint.sh      |
+------------------------------------------------+
| command:                                       |
|   Actual command executed within tmux.         |
|   Format: cd \${process_dir} && ./entrypoint.sh|
+------------------------------------------------+
| base_command:                                  |
|   Generated by construct_command().            |
|   Sets up a clean environment for execution.   |
+------------------------------------------------+
| full_command:                                  |
|   Combination of base_command and command.     |
|   Ensures correct environment for execution.   |
+------------------------------------------------+
EOF
}
