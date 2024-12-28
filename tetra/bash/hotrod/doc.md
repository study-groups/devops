### Overview

**`hotrod_remote`** and **`hotrod_multi_remote`** are utility functions that facilitate the creation of named pipes (FIFOs) on a remote server. These pipes can be used for inter-process communication, allowing different processes to read from and write to the same data stream asynchronously.

### Detailed Breakdown

#### 1. `hotrod_remote` Function

```bash
hotrod_remote() {
    # Arguments for server and user with default values
    local server="${1:-$TETRA_REMOTE}"
    local user="${2:-root}"

    # Check if server is provided or TETRA_REMOTE is set
    if [ -z "$server" ]; then
        echo "Server is not specified and TETRA_REMOTE is not set."
        return 1
    fi

    # SSH and execute the hotrod function remotely using a here-document
    ssh "${user}@${server}" bash << 'EOF'
hotrod() {
    local fifo_path="/tmp/myfifo"
    
    # Ensure the FIFO exists; create it if it doesn't
    if [[ ! -p "$fifo_path" ]]; then
        mkfifo "$fifo_path"
        echo "FIFO created at $fifo_path"
    fi

    # Read from stdin and write to the FIFO
    cat > "$fifo_path"
}
hotrod
EOF
}
```

**Purpose:**

- **Parameters:**
  - `server`: The remote server's address. Defaults to the environment variable `TETRA_REMOTE` if not provided.
  - `user`: The username for SSH. Defaults to `root` if not provided.

- **Functionality:**
  - **Validation:** Checks whether the `server` parameter is provided or if `TETRA_REMOTE` is set. If neither is available, it exits with an error message.
  - **SSH Execution:** Connects to the remote server via SSH using the specified `user` and `server`.
  - **Remote Function (`hotrod`):**
    - **FIFO Creation:** Checks if a named pipe (`/tmp/myfifo`) exists. If not, it creates one using `mkfifo`.
    - **Data Handling:** Reads data from `stdin` and writes it to the FIFO (`/tmp/myfifo`).

**Usage Scenario:**

Imagine you have a service or process on the remote server that's listening to `/tmp/myfifo` for incoming data. By using `hotrod_remote`, you can send data to this FIFO from your local machine, which the remote service can then process.

#### 2. `hotrod_multi_remote` Function

```bash
hotrod_multi_remote() {
    # Arguments for server and user with default values
    local server="${1:-$TETRA_REMOTE}"
    local user="${2:-root}"

    # Check if server is provided or TETRA_REMOTE is set
    if [ -z "$server" ]; then
        echo "Server is not specified and TETRA_REMOTE is not set."
        return 1
    fi

    # Generate a unique FIFO name using the current timestamp
    local fifo_name="myfifo_$(date +%s)"

    # SSH and execute the hotrod function remotely using a here-document
    ssh "${user}@${server}" bash << EOF
hotrod_multi() {
    local fifo_path="/tmp/${fifo_name}"
    
    # Ensure the FIFO exists; create it if it doesn't
    if [[ ! -p "$fifo_path" ]]; then
        mkfifo "$fifo_path"
        echo "FIFO created at $fifo_path"
    fi

    # Output the FIFO path for user information
    echo "Writing to FIFO at $fifo_path. To read from this FIFO, use 'cat $fifo_path' on the server."

    # Read from stdin and write to the FIFO
    cat > "$fifo_path"
}
hotrod_multi
EOF
}
```

**Purpose:**

- **Parameters:**
  - `server`: The remote server's address. Defaults to the environment variable `TETRA_REMOTE` if not provided.
  - `user`: The username for SSH. Defaults to `root` if not provided.

- **Functionality:**
  - **Validation:** Similar to `hotrod_remote`, it checks for the `server` parameter or `TETRA_REMOTE`.
  - **FIFO Naming:** Generates a unique FIFO name by appending the current timestamp (`myfifo_$(date +%s)`), ensuring that multiple FIFOs can coexist without name clashes.
  - **SSH Execution:** Connects to the remote server and executes the `hotrod_multi` function.
  - **Remote Function (`hotrod_multi`):**
    - **FIFO Creation:** Creates a uniquely named FIFO in `/tmp/` if it doesn't already exist.
    - **User Guidance:** Informs the user how to read from the FIFO using `cat`.
    - **Data Handling:** Reads data from `stdin` and writes it to the newly created FIFO.

**Usage Scenario:**

This function is useful when you need to create multiple FIFOs on the remote server dynamically, perhaps for handling multiple streams of data independently. Each FIFO has a unique name based on the timestamp, reducing the risk of naming conflicts.

### What is `hotrod`?

In the context of the provided script, `hotrod` is a Bash function defined within the SSH session on the remote server. Its primary role is to:

1. **Create a Named Pipe (FIFO):** If the specified FIFO doesn't exist, it creates one at a defined path (e.g., `/tmp/myfifo` or `/tmp/myfifo_TIMESTAMP`).

2. **Handle Data Streaming:**
   - **Writing Data:** It takes input from `stdin` and writes it directly into the FIFO. This means any data piped into `hotrod_remote` or `hotrod_multi_remote` will be sent through the FIFO on the remote server.
   - **Reading Data:** Other processes on the remote server can read from the FIFO to receive the data being written into it.

**Example Workflow:**

1. **Setup:**
   - On the remote server, you have a process that listens to `/tmp/myfifo` for incoming data:
     ```bash
     cat /tmp/myfifo | some_processing_script.sh
     ```

2. **Sending Data:**
   - From your local machine, you use `hotrod_remote` to send data:
     ```bash
     echo "Data to send" | hotrod_remote remote_server user
     ```
   - This command SSHs into `remote_server` as `user`, creates `/tmp/myfifo` if it doesn't exist, and writes "Data to send" into the FIFO.

3. **Processing Data:**
   - The listening process on the remote server receives "Data to send" through the FIFO and processes it accordingly.

### Benefits of Using This Setup

- **Asynchronous Communication:** FIFO allows for decoupled communication between processes. The writing process (your local command) doesn't need to wait for the reading process to be ready to receive data.
  
- **Remote Data Injection:** Easily send data to a remote server's process without needing to have the data initially present on the server.

- **Flexibility:** By generating unique FIFO names (`hotrod_multi_remote`), you can handle multiple data streams concurrently without conflicts.

