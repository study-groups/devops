nectar_root=/home/admin/src/devops-study-group/nectar
nectar_data=/home/admin/src/devops-study-group/nectar/data

nectar-help(){
cat << EOF
nectar is the cli tool for controlling nectar-collector.

The nectar collector is a dameon called nectard.

It is a system for:
- turning steams into objects
- storing objects in one conceptual system
- providing Pub/Sub
- fanning in many inputs to one system
- system state is a collection of objects
- objects have NID ids
- objects of PNID  parent ids
- objects have Types
- objects have states of pending or resolved

Configuration:

nectar_root=/home/admin/src/devops-study-group/nectar/
nectar_data=/home/admin/src/devops-study-group/nectar/data
EOF
}
