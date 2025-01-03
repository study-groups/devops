# Phase One Specification

This first phase focuses on extracting and documenting essential data about the target domain and its IPs—laying the groundwork for deeper inspection of server and NGINX configuration in subsequent steps.

## Goals
1. Identify the domain name (e.g., placeholdermedia.com).
2. Perform DNS resolution to gather public IPs.
3. Distinguish floating IPs vs. direct public IPs (writing both to an interim report).
4. Connect to each associated server (SSH as root) and capture:
   - Hostname
   - Basic filesystem usage and mounts
   - Running services and open ports

## Outline
1. Accept a URL and parse out the domain.  
2. Resolve the domain to collect all associated IPs.  
3. For each IP:  
   a. Check whether it is a floating IP using a reference file (e.g., digocean.json).  
   b. If floating IP, map it to the underlying host’s actual public IP.  
   c. Attempt SSH login to document basic server status (hostname, services, ports).  
4. Store these findings in a structured report directory (e.g. <domain>-report).  

## Deliverables
- An interim shell script (<domain>_devops_structure.sh or similar) that captures resolved IPs, floating vs. direct IP status, and related droplet details.  
- A status log (<domain>_status.log) noting successes and errors (e.g., SSH failures).  
- A simple text file (<domain>_network_path.txt) summarizing domain → IP(s) → server relationships.  

By the end of Phase One, we have a clear picture of how DNS is set up, which servers are targeted, and how to reach them. This data is then leveraged in subsequent phases (e.g., examining NGINX directives, analyzing port mappings, exploring potential proxy endpoints).  
