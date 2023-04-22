# Do this after increasing volume size in Hypervisor (Digital Ocean, etc)
tetra-volume-resize(){
  local dev="/dev/sda"
  local mntpt="/mnt/volume_nyc1_02" 
  umount $mntpt
  e2fsk -f $dev
  resize2fs $dev
}

