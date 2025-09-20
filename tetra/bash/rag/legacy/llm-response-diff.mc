#MULTICAT_START
# dir: .
# file: mpm-broken.sh
# mode: diff
#MULTICAT_END
--- a/mpm-broken.sh
+++ b/mpm-broken.sh
@@ -6,7 +6,7 @@ set -euo pipefail
 
 # Configuration - intentionally missing initialization
-MPM_DIR=${MPM_DIR:-}  # This will cause issues
+MPM_DIR=${MPM_DIR:-./processes}  # Default to ./processes directory
 
 usage() {
   cat <<EOF
@@ -22,11 +22,13 @@ mpm_start() {
   local name="$1"
   local cmd="$2"
   
-  local pidfile="$name.pid"  # Should be in MPM_DIR
-  local logfile="$name.log"  # Should be in MPM_DIR
+  # Create MPM_DIR if it doesn't exist
+  mkdir -p "$MPM_DIR"
+  
+  local pidfile="$MPM_DIR/$name.pid"
+  local logfile="$MPM_DIR/$name.log"
   
   if [[ -f "$pidfile" ]]; then
     local pid