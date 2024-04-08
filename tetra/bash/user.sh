tetra_user_create() {
    local username=$1
    local remote=$2
    ssh root@"${remote}" "useradd -m ${username} && echo 'User ${username} created.'"
}
tetra_user_backup() {
    local username=$1
    local remote=$2
    ssh root@"${remote}" "tar czf /home/${username}_backup.tar.gz -C /home ${username} && echo 'Backup of ${username} completed.'"
}
tetra_user_restore() {
    local username=$1
    local remote=$2
    ssh root@"${remote}" "tar xzf /home/${username}_backup.tar.gz -C / && echo 'Restore of ${username} completed.'"
}
tetra_user_delete() {
    local username=$1
    local remote=$2
    ssh root@"${remote}" "userdel -r ${username} && echo 'User ${username} deleted.'"
}
