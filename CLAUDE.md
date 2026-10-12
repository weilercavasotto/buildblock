@AGENTS.md

## Claude Code notes

- Reply to the user in Portuguese; keep code, comments, docs and in-game text in English.
- On macOS, `sed -i` needs an empty backup suffix: `sed -i '' ...`.
- The user keeps their own dev server on port 5173: for verification start another one on a different port (e.g. `npm run dev -- --port 5199 --strictPort`), open that port in the browser, and stop only the process you started (by its PID, never `pkill` by name or port 5173).
- Start the dev server with `npm run dev` (the project's `.claude/launch.json` is not picked up when the
  session was started outside this folder).
