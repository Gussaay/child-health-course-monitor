# Course videos for "Download for offline"

Lessons stream their videos from YouTube. A copy of each video sits in Firebase
Storage under `course-videos/` so a learner can save it on the device once
(`src/components/imnci/onlineCourses/offlineVideos.js`). The app finds the
copies through `course-videos/index.json` (fixed token in `index-token.txt`).

YouTube refuses downloads from GitHub's servers, so the workflow
`.github/workflows/course-videos.yml` rebuilds the parts from the Drive source
clips (`sources.json`) and checks each against the length YouTube reports
(`parts.json`, from the YouTube API `fileDetails.durationMs`).

`mode.txt`: `list` (list the Drive folders only), `dry` (build and check),
`commit` (build, check, upload, write index.json), `undo` (delete `course-videos/`).

Uploaded 2026-11-20 (importBatch `course-videos-2026-11-20`): 41 videos, 188 MB.
A new video: add its YouTube id to a course package, its exact length to
`parts.json` and its source to `sources.json`, then run `commit`.
