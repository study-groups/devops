# Watchdog Remote Naming Convention

## Top Level
- URL_ENTRY=<url>                    # Initial URL provided
- DOMAIN_NAME=<domain>               # Extracted domain name
- TRACE_TIME=<timestamp>             # When trace was performed

## Network Layer
- RESOLVED_IPS=(<ip1> <ip2>...)      # All IPs resolved from DNS
- IP_TYPE_<ip>=<floating|direct>     # Replace IS_FLOATING_IP with clearer type
- ENDPOINT_MAP_<ip>=<target_ip>      # Replace PUBLIC_ENDPOINT with semantic mapping
- PRIVATE_NET_<ip>=<internal_ip>     # Replace PRIVATE_IP with network context

## Node Information
- NODE_<ip>={                        # Group all node-specific info
    HOSTNAME=<hostname>
    ROLE=<proxy|service>             # New: explicitly define node role
    NETWORK_TYPE=<public|private>    # New: network position
}

## Service Layer
- PROXY_<ip>={                       # Group proxy-specific data
    NGINX_SITES=(<site1> <site2>)
    NGINX_CONFIG_<site>=<config>
    LISTEN_PORTS=(<port1> <port2>)
}

- SERVICE_<ip>={                     # Group service-specific data
    NAME=<service_name>
    PORT=<port>
    TYPE=<systemd|pm2|docker>
    STATUS=<status>
}

## Storage Layer
- STORAGE_<ip>={                     # Group storage information
    NFS_MOUNTS=[
        {PATH=<path>, SIZE=<size>, USAGE=<percent>}
    ]
    VOLUMES=[
        {PATH=<path>, SIZE=<size>, USAGE=<percent>}
    ]
    LOCAL_DISKS=[
        {PATH=<path>, SIZE=<size>, USAGE=<percent>}
    ]
}

## Relationships
- PROXY_ROUTE_<ip>={                 # New: track routing relationships
    FRONTEND=<public_url>
    BACKEND=<service_ip:port>
    SSL=<true|false>
}
