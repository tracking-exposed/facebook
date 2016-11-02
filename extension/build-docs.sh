#!/usr/bin/env bash

ROOT=./src
for DIR in `find $ROOT -type d`; do
    INDIR=$DIR/*
    OUTDIR=docs${DIR:${#ROOT}};
    ./node_modules/.bin/docco $INDIR -o $OUTDIR
done;
