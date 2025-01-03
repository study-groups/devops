[ -z "$NH_SRC" ] \
  && { echo "NH_SRC not set"; return 1; }
[ -z "$DIGITALOCEAN_CONTEXT" ] && \
  { echo "DIGITALOCEAN_CONTEXT not set"; return 1; }
[ ! -z "$NH_INIT_DONE" ] && \
  { echo "NH_INIT_DONE already set"; return 0; }

doctl auth switch --context $DIGITALOCEAN_CONTEXT >&2
echo "Using Digital Ocean context: $DIGITALOCEAN_CONTEXT" >&2
source "$NH_SRC/bash/bootstrap.sh"
export NH_SRC
export NH_DIR
export NH_CONTEXT
#NH_INIT_DONE=1
