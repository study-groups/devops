tetra_bufsize=${tetra_bufsize:-1000}            # set/use system default
tetra_logfile=${tetra_logfile:-/tmp/tetra.log}  # set/use system default

# Apple_Date-T-UTC_time.MilliSecond-Z
# date -u +"%FT%T.%3NZ"
# 2023-04-12T03:58:38.352Z

tetra-log(){
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
tetra-logs(){
  cat $tetra_logfile                              # use system default
}
