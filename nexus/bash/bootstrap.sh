NEXUS_SRC=${NEXUS_SRC:-$(pwd)}
ignore=("bootstrap.sh" "tests.sh")  # Add files to ignore to this array

for f in $(ls $NEXUS_SRC/bash/*.sh); do
    if [[ ! " ${ignore[@]} " =~ " $(basename $f) " ]]; then
        source $f
    fi
done