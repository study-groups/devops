#!/usr/bin/env bash
qa_files(){
	for file in $(ls *.sh); do
		echo "Contents of file: $file"
		cat $file
	done
}
