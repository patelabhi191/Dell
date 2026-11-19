# Scheduled run (for Claude)

Desk: https://claude.ai/artifact/2vHWRbFL7ah6va3M3g76vF (db: state/main, trades/*, checkpoints/*)

1. `git fetch origin claude/clever-maxwell-i0ypiw && git checkout FETCH_HEAD -- paper-run`
2. ArtifactData get state/main with out_dir=<scratch>/in. Note its version N.
3. `python3 paper-run/engine.py --state <scratch>/in/state/main.json --version N --out <scratch>/out`
   (Finnhub key is injected by the network proxy; nothing to set.)
4. If writes.json is `[]` (market closed), stop. Otherwise ArtifactData batch with the entries of writes.json exactly.
5. If the batch fails on a version conflict, start over at step 2 once. Never edit the numbers by hand.
6. Reply with the engine's printed summary. No commits, no other changes.
