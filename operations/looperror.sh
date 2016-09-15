#!/bin/sh

if [ -d "./samples" ]; then
  echo "ls -l /dev/shm/*.json | wc -l"
  ls -l /dev/shm/*.json | wc -l
  mv /dev/shm/*.json samples
else
  echo "directory ./samples not found here"
fi
