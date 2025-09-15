tetra_bufsize=${tetra_bufsize:-1000}            # set/use system default
tetra_logfile=${tetra_logfile:-/tmp/tetra.log}  # set/use system default

# Apple_Date-T-UTC_time.MilliSecond-Z
# date -u +"%FT%T.%3NZ"
# 2023-04-12T03:58:38.352Z

tetra_log_orig(){
  local bufsize=$tetra_bufsize                    # easier to read below
  local logfile=$tetra_logfile                    # easier to read/resuse
  touch $logfile                                  # Create if it doesn't exist
  tail -n $bufsize $logfile > /dev/null           # Set up the circular buffer
  while read input; do
  echo "$(date -u +"%FT%T.%3NZ") $input" >> $logfile  # to the log file
      tail -n $bufsize $logfile > $logfile.tmp    # Trim log to buffer size
      mv $logfile.tmp $logfile
  done
}
tetra_logs(){
  cat $tetra_logfile                              # use system default
}


alias tetra_log='tetra_log_via_gpt4'
tetra_log_via_gpt4() {
    local log_dir="$HOME/tetra/logs"
    local log_file="${log_dir}/tetra.log"
    local max_size=131072 # 128 KB in bytes
    local message=$1
    local timestamp=$(date "+%Y-%m-%dT%H:%M:%S.%3N") # ISO 8601 with milliseconds

    mkdir -p "${log_dir}"

    # Check if the log file exists and its size
    if [ -f "${log_file}" ]; then
        local size=$(stat -c %s "${log_file}")
        if (( size + ${#message} > max_size )); then
            # Find the highest existing log rotation number
            local num=$(find "$log_dir" -name 'tetra.log.*' \
                              | sed 's/^.*\.//' \
                              | sort -n \
                              | tail -1)
            num=$((num+1)) # Increment for new log file
            mv "${log_file}" "${log_file}.${num}"
        fi
    fi

    # Log the message with a timestamp
    echo "${timestamp} - ${message}" >> "${log_file}"
}

