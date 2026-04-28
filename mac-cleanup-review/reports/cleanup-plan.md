# Cleanup Plan For This Mac

Generated from read-only scans. No permanent delete actions should be used. Approved cleanup should move items to Trash only.

## Current Disk Position

- Internal APFS container: about 494 GB total.
- Data volume used: about 150 GB.
- Available: about 289 GiB.
- Home folder: `/Users/anand.thakur1312`, about 66 GB.
- Biggest home area: `~/Library`, about 41 GB.

## Highest-Impact Cleanup Candidates

### Approval Required

These are large or personal/project-adjacent and should only move to Trash after you approve them:

- `/Users/anand.thakur1312/.minikube/machines/minikube/minikube.rawdisk` - listed as 19 GB by file size; Minikube data/VM disk.
- `/Users/anand.thakur1312/Library/Containers/com.docker.docker` - about 6.5 GB; Docker Desktop container data.
- `/Applications/workspace` - about 6.1 GB; looks like an old mirrored workspace under Applications.
- `/Users/anand.thakur1312/.gradle` - about 4.0 GB; Gradle cache, usually rebuildable.
- `/Applications/iMovie.app` - about 2.7 GB; app removal requires approval.
- `/Users/anand.thakur1312/.npm` - about 1.4 GB; npm cache, usually rebuildable.
- `/Users/anand.thakur1312/.m2` - about 897 MB; Maven cache, usually rebuildable.
- `/Users/anand.thakur1312/Movies/CapCut` - about 826 MB; media/project output, review first.
- `/Applications/GarageBand.app` - about 901 MB; app removal requires approval.
- Large videos in `~/Pictures` and `~/Music/iTunes`, including:
  - `/Users/anand.thakur1312/Music/iTunes/iTunes Media/Home Videos/IMG_7298.mov` - 1.2 GB.
  - `/Users/anand.thakur1312/Pictures/DJI_0168.MP4` - 1.1 GB.
  - `/Users/anand.thakur1312/Pictures/DJI_0017.MP4` - 596 MB.
  - `/Users/anand.thakur1312/workspace/Coding/Algos/Time.mov` - 1.2 GB.

### Usually Safe After Review

These are caches or old tool data. They are still listed for review before moving:

- `~/Library/Caches/com.openai.atlas` - about 2.2 GB.
- `~/Library/Caches/Google` - about 1.8 GB.
- `~/Library/Caches/JetBrains` - about 1.2 GB.
- `~/Library/Caches/com.citrix.receiver.nomas` - about 996 MB.
- `~/Library/Caches/com.openai.chat` - about 402 MB.
- `~/Library/Logs` - about 330 MB total.
- Old IDE leftovers:
  - `~/Library/Caches/JetBrains/IntelliJIdea2022.1` - about 260 MB.
  - `~/Library/Application Support/JetBrains/IntelliJIdea2022.1` - about 179 MB.
  - `~/Library/Application Support/IntelliJIdea2019.3` - about 8.2 MB.
  - `~/Library/Preferences/IntelliJIdea2019.3` - about 7.5 MB.
  - `~/Library/Application Support/WebStorm2019.3` - about 4.0 MB.
  - `~/Library/Preferences/WebStorm2019.3` - about 652 KB.

### Low-Risk Command Cleanup

These tools have native cleanup commands and should be dry-run first:

- Homebrew: `brew cleanup -n` says it would free about 106 MB.
- Docker: `docker system df` should be reviewed before pruning.
- npm cache: can be cleaned with `npm cache clean --force`, but moving `~/.npm` to Trash is easier to undo.
- Gradle/Maven caches: moving cache folders to Trash is usually safe, but first run a dry-run with the approval script.

## Items To Keep Unless You Explicitly Say Otherwise

- `/Applications/IntelliJ IDEA CE.app`
- `/Applications/Google Chrome.app`
- `/Applications/CapCut.app`
- `/Applications/PyCharm CE.app`
- `/Applications/Webull Desktop.app`
- `~/Documents/Codex`
- Tax, personal, identity, immigration, and finance documents.

## Recommended Cleanup Phases

### Phase 1: Cache And Log Cleanup

Move approved cache/log paths to Trash:

- Browser/app caches: Atlas, Google, ChatGPT, JetBrains, Citrix.
- Old logs older than 30 days, or entire app log folders if approved.
- Old JetBrains/WebStorm/IntelliJ 2019/2022 support folders if you no longer need those versions.

Expected recovery: roughly 4-7 GB depending on approved paths.

### Phase 2: Developer Cache Cleanup

Approve rebuildable caches:

- `~/.gradle`
- `~/.npm`
- `~/.m2`
- selected `node_modules` folders in old projects
- Python virtualenv folders in old courses

Expected recovery: roughly 5-7 GB plus selected project dependencies.

### Phase 3: Docker And Minikube Review

Review whether you still use Docker Desktop and Minikube on this Mac.

- If Docker Desktop is not needed, approve Docker container data cleanup.
- If Minikube is not needed, approve `.minikube` cleanup.

Expected recovery: roughly 8-25 GB depending on sparse disk accounting and Docker state.

### Phase 4: Old Workspace Review

Review `/Applications/workspace` carefully. It appears to be a large old workspace mirror under Applications.

Do not bulk-trash it until you confirm it is duplicate/obsolete.

Expected recovery if approved: about 6.1 GB.

### Phase 5: Apps And Media

Approve only if you no longer need them:

- iMovie
- GarageBand
- CapCut project media/output
- large DJI videos and iTunes home videos

Expected recovery: variable, about 4-7 GB from the obvious app/video candidates.

## Scripts

Fresh scan:

```bash
/Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/scripts/scan_mac_cleanup.sh
```

Dry-run approved cleanup:

```bash
/Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/scripts/move_approved_to_trash.sh /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/approved/approved-paths.txt
```

Apply approved cleanup:

```bash
/Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/scripts/move_approved_to_trash.sh --apply /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/approved/approved-paths.txt
```

