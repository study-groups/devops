NEXUS_BASH=${NEXUS_BASH:-$(pwd)}
ignore=("bootstrap.sh" "tests.sh")  # Add files to ignore to this array

for f in $(ls $NEXUS_BASH/*.sh); do
    if [[ ! " ${ignore[@]} " =~ " $(basename $f) " ]]; then
        source $f
    fi
done
