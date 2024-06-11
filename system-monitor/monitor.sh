monitor-help(){
  cat <<EOF
Monitor is a shell based application for monitoring Linux
log files, system processes, disk usage and network traffic
in real time. Try:
 monitor-cpu
 monitor-files
 monitor-log
EOF
}

monitor-help-cpu(){
  cat << EOF
This is the language from RedHat man vmstat. 

The r value denotes the RUNNABLE processes, not the RUNNING!

“r – Number of kernel threads placed in run queue.”
“b – Number of kernel threads placed in wait queue (awaiting
resource, awaiting input/output).”


https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/system_administrators_guide/chap-managing_services_with_systemd#:~:text=10.1.,manager%20for%20Linux%20operating%20systems.&text=In%20Red%20Hat%20Enterprise%20Linux,as%20the%20default%20init%20system.
EOF
}

monitor-cpu(){
  echo "Add info about vmstat"
  echo "Procs:"
  echo "r: The number of runnable processes. (running or waiting)."
  echo "b: The number of processes in uninterruptible sleep."

  echo "Memory"
  echo "swpd: the amount of virtual memory used."
  echo "free: the amount of idle."
  echo "buff: the amnount of memory used as buffers."
  echo "cache: the amount of memory used as cache."
  echo "inact: the amount of inactive memory. (-a option) "
  echo "Swap:"
  echo "si: amount of memory swapped in from disk (-/s)."
  echo "so: amount of memory swapped to disk (-/s). "  
  echo "IO: "
  echo "bi: Blocks recieved from a block device (block/s). "
  echo "bo: Blocks sent to a block device (blocks/s). "
  echo "System: "
  echo "in: The number of intrerrupts per second, including the clock."
  echo "cs:The number of context switches per second. "
  echo "us: non-kernel code time. (user time, including nice time)"
  echo "sy: Time spent running kernel code. (system time)"
  echo "wa: Time spent waiting for IO. Prior to Linux 2.5.41, include in idle"
  echo "st: Time stolen from a virtual machine. Prior to Linux 2.6.11, unknown."


  
  # allows pssing up to 2 flags
  vmstat $1 $2 
}

monitor-files(){
  echo "put monitor-files code here."
}

monitor-log(){
  watch -n.2 tail /var/log/syslog
}

PS1="MONITOR> "
clear
monitor-help
echo ""
