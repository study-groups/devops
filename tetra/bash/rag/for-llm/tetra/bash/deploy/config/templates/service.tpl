[Unit]
Description=${DESCRIPTION}
After=network.target

[Service]
Type=simple
User=${USER}
Group=${USER}
WorkingDirectory=${WORKING_DIR}
ExecStart=${ENTRYPOINT_SH}
Restart=on-failure
RestartSec=15s

[Install]
WantedBy=multi-user.target
