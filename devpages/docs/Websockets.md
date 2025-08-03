graph TD
    subgraph "System Boot"
        A[systemd]
    end

    subgraph "User Space"
        B(SvelteKit App Process)
        C[PM2 Daemon]
    end
    
    subgraph "PM2 Managed"
        D(WebSocket Process)
    end
    
    subgraph "Admin Dashboard"
        E[Control Panel UI]
    end
    
    A -- "Starts/Manages" --> B
    A -- "Starts/Manages" --> C
    C -- "Starts/Manages" --> D
    
    E -- "API Request (e.g., 'stop')" --> B
    B -- "Executes 'pm2 stop ...'" --> C
    C -- "Sends stop signal to" --> D

    style A fill:#d5a6bd,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px