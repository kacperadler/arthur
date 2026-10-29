# AR0551 - Outcome

- Merged: 2026-10-28, `c7b4c24d`
- Branch: arthur/2026-10-28-worker-b14d6e94
- Reviews: review-1.md PASS
- Cost: worker $4.70, reviews $0.92; review rounds 1

## What went in

- A new video plugin: a video from any channel reaches the coordinator as its frames (every 5 s and at scene changes, at most 12, each with its second) and the words of its sound track, transcribed through the voice plugin by way of the host; clear lines for no sound, no speech, voice off, a video too long (with one line back to the owner) and ffmpeg missing or failing. Each ffmpeg step has a time limit (`timeoutSeconds`, 300). Its line budget is 186, its code exactly.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1190/1257 passed.

## Left open

- Deferred (client summary): F1. A video's frames stay in .arthur/video/ forever
- Deferred (client summary): F2. With maxFrames reached, the end of a long video has no frame
