#!/bin/bash
# This script monitors CPU, memory, and swap usage

while : 
do 
  # Get the current usage of CPU, memory, and swap
  cpuUsage=$(top -bn1 | awk '/Cpu/ { print $2}')
  memUsage=$(free -m | awk '/Mem/{print $3}')
  swapUsage=$(free -m | awk '/Swap/{print $3}')

  # Print the usage
  echo "CPU Usage: $cpuUsage%"
  echo "Memory Usage: $memUsage MB"
  echo "Swap Usage: $swapUsage MB"

  # Sleep for 1 second
  sleep 1
done
