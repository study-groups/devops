
pbase_systemd_create_service() {
    local service_name="pocketbase"
    local service_file="/etc/systemd/system/$service_name.service"
    echo "Creating systemd service file..."
    cat <<EOF | sudo tee $service_file
[Unit]
Description=PocketBase Service
After=network.target

[Service]
ExecStart=${PJA_SRC}/pbase/entrypoint.sh
User=${PJA_USER:-$(whoami)}
Restart=on-failure
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

    echo "Reloading systemd manager configuration..."
    sudo systemctl daemon-reload

    echo "Enabling and starting PocketBase service..."
    sudo systemctl enable ${service_name}
    sudo systemctl start ${service_name}

    echo "PocketBase service installed and started."
}

pj_pbase_systemd_priv_add() {
    if [ "$EUID" -ne 0 ]; then
        echo "Please run as root"
        return 1
    fi

    if [ -z "$1" ]; then
        echo "Usage: pj_pbase_systemd_priv_add <username>"
        return 1
    fi

    USERNAME=$1

    SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
    
    cat <<EOF > $SUDOERS_FILE
$USERNAME ALL=(ALL) NOPASSWD: /bin/systemctl restart pocketbase
$USERNAME ALL=(ALL) NOPASSWD: /usr/bin/vi /etc/systemd/system/pocketbase.service
$USERNAME ALL=(ALL) NOPASSWD: /bin/journalctl -u pocketbase.service
EOF

    chmod 440 $SUDOERS_FILE

    # Reload sudoers configuration
    visudo -c && echo "Sudoers configuration reloaded."
    # Reload systemd manager configuration
    systemctl daemon-reload && echo "Systemd manager configuration reloaded."
    echo "Privileges added for user $USERNAME"
}

pj_pbase_systemd_priv_remove() {
    if [ "$EUID" -ne 0 ]; then
        echo "Please run as root"
        return 1
    fi

    if [ -z "$1" ]; then
        echo "Usage: pj_pbase_systemd_priv_remove <username>"
        return 1
    fi

    USERNAME=$1

    REPORT_FILE="/root/systemd_priv_removal_report_$USERNAME.txt"

    echo "Removing privileges for user $USERNAME" | tee $REPORT_FILE

    SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
    
    if [ -f "$SUDOERS_FILE" ]; then
        echo "Removing $SUDOERS_FILE" | tee -a $REPORT_FILE
        rm "$SUDOERS_FILE"
    else
        echo "File $SUDOERS_FILE does not exist, skipping" | tee -a $REPORT_FILE
    fi

    # Reload sudoers configuration
    visudo -c && echo "Sudoers configuration reloaded."
    # Reload systemd manager configuration
    systemctl daemon-reload && echo "Systemd manager configuration reloaded."
    echo "Privileges removal for $USERNAME completed" | tee -a $REPORT_FILE
}

pj_pbase_systemd_status() {
    if [ "$EUID" -ne 0 ]; then
        echo "Please run as root"
        return 1
    fi

    if [ -z "$1" ]; then
        echo "Usage: pj_pbase_systemd_status <username>"
        return 1
    fi

    USERNAME=$1

    echo "Effective sudo permissions for user $USERNAME:"
    sudo -l -U $USERNAME

    echo
    echo "Files under /etc that $USERNAME can write to:"
    find /etc -type f -user $USERNAME
}

pj_pbase_systemd_aliases() {
    if [ -z "$1" ]; then
        echo "Usage: pj_pbase_systemd_aliases <username>"
        return 1
    fi

    USERNAME=$1

    echo "alias restart_pocketbase='sudo systemctl restart pocketbase'"
    echo "alias edit_pocketbase_service='sudo vi /etc/systemd/system/pocketbase.service'"
    echo "alias journalctl_pocketbase='sudo journalctl -u pocketbase.service'"
}
