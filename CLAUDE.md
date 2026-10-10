@AGENTS.md

## Claude Code notes

- Reply to the user in Portuguese; keep code, comments, docs and in-game text in English.
- On macOS, `sed -i` needs an empty backup suffix: `sed -i '' ...`.
- Start the dev server with `npm run dev` (the project's `.claude/launch.json` is not picked up when the
  session was started outside this folder).
