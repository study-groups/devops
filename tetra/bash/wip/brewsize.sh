#!/usr/bin/env bash

for package in $(brew list); do
    echo -n "$package: "
    brew list -v $package | xargs du -ch | grep "total$" | awk '{print $1}'
done
