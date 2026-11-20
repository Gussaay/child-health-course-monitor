#!/bin/sh
# Every YouTube video the course packages link to, one id per line.
grep -ohE '(youtube(-nocookie)?\.com/(embed/|watch\?v=)|youtu\.be/)[A-Za-z0-9_-]{11}' ../../course-packages/*.imnci.json \
  | sed -E 's#.*(/|=)##' | sort -u
