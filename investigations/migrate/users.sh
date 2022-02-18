# copy from old to new
# From rsync man page:
# -a, --archive               archive mode; equals -rlptgoD (no -H,-A,-X)
# -z, --compress              compress file data during the transfer
# -v, --verbose               increase verbosity
# -P                          same as --partial --progress
# /home => include home/username1 => /home/home/user1
# /home/ => just user1 => /home/user1
rsync -avzP /home/ root@159.65.106.21:/home
