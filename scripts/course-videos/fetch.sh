#!/bin/bash
# Downloads each course video from YouTube at up to 480p as an MP4 that starts
# playing before it has fully downloaded, and prints its size and length.
set -u
mkdir -p out
: > report.tsv
for ID in $(./collect-ids.sh); do
  if [ ! -s "out/$ID.mp4" ]; then
    yt-dlp -q --no-warnings --no-playlist \
      -f "bv*[height<=480][vcodec^=avc1]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]" \
      --merge-output-format mp4 -o "out/$ID.src.%(ext)s" "https://www.youtube.com/watch?v=$ID" || { echo "FAILED $ID"; printf '%s\tFAILED\n' "$ID" >> report.tsv; continue; }
    SRC=$(ls out/$ID.src.* | head -1)
    ffmpeg -loglevel error -y -i "$SRC" -c copy -movflags +faststart "out/$ID.mp4" && rm -f "$SRC"
  fi
  BYTES=$(stat -c %s "out/$ID.mp4")
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "out/$ID.mp4")
  H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "out/$ID.mp4")
  printf '%s\t%s\t%s\t%s\n' "$ID" "$BYTES" "$DUR" "$H" >> report.tsv
done
echo; echo "id	bytes	seconds	height"; cat report.tsv
awk -F'\t' '$2!="FAILED"{n++; b+=$2; s+=$3} END{printf "\n%d videos, %.1f MB, %.1f minutes, %.1f MB per minute\n", n, b/1048576, s/60, (b/1048576)/(s/60)}' report.tsv
