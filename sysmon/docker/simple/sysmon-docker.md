```mermaid
graph LR
    A[Host Machine] -->|Hosts Logs| NGINX[NGINX]
    A -->|Hosts SSH| SSH[SSH Service]
    A -->|Monitored By| Fail2Ban[Fail2Ban]

    subgraph Docker Containers
        B[Grafana] -->|Reads from| C[Prometheus]
        C -->|Collects Metrics| D[NGINX Exporter]
        C -->|Collects Logs| E[Node Exporter]
        B -->|Reads SSH Logs| F[SSH Log Collector]
        B -->|Reads Fail2Ban Logs| G[Fail2Ban Monitor]
    end

    NGINX -->|Sends Logs| D
    SSH -->|Sends Events| F
    Fail2Ban -->|Sends BaBCDed IPs| G
