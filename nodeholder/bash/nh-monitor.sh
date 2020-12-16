nh-monitor-disk(){
  # root mount where we boot from
  df -h | grep /dev/vd  | cut -c 1-$COLUMNS
  # Volume storage mounts 
  df -h | grep /dev/sd  | cut -c 1-$COLUMNS
  sudo du -hs  /home/admin
  sudo du -hs  /var
}

nh-monitor-network(){
echo "need to dial in nload"
nload
}

nh-monitor-cpu(){
htop # customize for small panel
}

