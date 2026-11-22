# Costa reels: progress

## Kernels (Kaggle, account jerzysukiennik)
- costa-reel-v1-probe: COMPLETE (previous agent), 4 probe frames of old v1, in out/probe1/.
- costa-reel-v1: COMPLETE (previous agent), full v1 frames rendered (~42 min on T4, ~1.5 s/frame) but edit.py crashed (old dataset version without int fix); only check frames + silent 1 s video in out/v1old/. Frames lost. Needs re-render.
- costa-probe-a: never created (push refused: weekly GPU quota of 30 h reached, 2026-11-20 22:40 UTC). Quota was back by 2026-11-21 05:58 UTC.
- costa-render-b (v4,v5) pushed 2026-11-21 05:58 UTC, dataset version of 05:58 (v2 pro vault fix). Full render + edit.
- costa-render-a (v1,v2,v3) pushed 2026-11-21 05:59 UTC, same dataset. Full render + edit.
- Download outputs with: kaggle kernels output jerzysukiennik/<slug> -p out/<slug>. Do not re-push before checking status.

## Done
- costa-render-b COMPLETE 07:34 CET (35 min, ~0.55 s/frame; worker pending sticks at 1 so every frame hits the 400 ms wait). Downloaded to out/costa-render-b/.
- v4 verified (34.97 s, -14.0 LUFS, -1.4 dBTP) and delivered as Rolki/Subwoofer.mp4.
- v5 verified (50.2 s, -13.7 LUFS, -1.5 dBTP, no overlays) and delivered as Rolki/Złota godzina.mp4.
- costa-render-a COMPLETE 07:57 CET (v1,v2,v3, ~57 min). v1 audio peak-limited locally (-14.4 LUFS, -1.6 dBFS) and delivered as Rolki/Darmowa jazda.mp4. v2 verified (46.7 s, -14.0 LUFS, -1.3 dBTP) and delivered as Rolki/Noob vs Pro vs Haker.mp4.
- v3 from render-a had two weak shots (whosdriving ended on dark seat backs, overbridge showed an empty road): fixed, checked locally.
- costa-render-c (v3 only) pushed ~08:03 CET on the 07:02 UTC dataset. Next: download, verify, deliver as Rolki/Leniwa niedziela.mp4, commit tooling, report.

## Videos (state before renders)
- v1 sneaky (Sneaky Snitch): choreography from previous agent, check frames OK. Not captured.
- v2 noob/pro/hacker (Monkeys): local stills done. Known bugs: pro-door entry never triggers; rider faces backwards in hacker shots; hacker-roll camera ends inside the bridge deck.
- v3 lazy sunday (Chicken): local stills done, mostly fine.
- v4 subwoofer (song4_loop): rewritten to ~35 s, local stills done, fixes applied (not re-checked).
- v5 golden hour (Monkeys 52.5-102.7 s, no overlays): local stills done twice, fixes applied.
- Nothing edited, verified or delivered.

## Audio
- song4_loop.flac: 12-beat loop (7.815 s) cut from the recording at 2.32 s, seam spectral match 0.854 (natural bar repeat 0.85), 12 ms crossfade.

## Next
1. Check GPU quota (push a probe). 2. Fix pending-wait (each frame waits the full 1.5 s timeout) to cut render time. 3. Fix v2 bugs. 4. Full renders on Kaggle, download, verify, deliver.

## Finished 2026-11-21
- costa-render-c COMPLETE; v3 verified (46.9 s, -14.0 LUFS, -1.5 dBTP) and delivered as Rolki/Leniwa niedziela.mp4.
- All five delivered. Tooling committed locally, not pushed.
