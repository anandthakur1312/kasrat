# Mac Cleanup Review

This folder contains a review-first cleanup plan for this Mac.

Rules baked into the scripts:
- Nothing is permanently deleted.
- Cleanup actions move items to `~/.Trash/Codex cleanup YYYYMMDD-HHMMSS`.
- The cleanup script only acts on paths you explicitly place in an approval file.
- The scan script is read-only.

## Files

- `reports/cleanup-plan.md` - current findings and cleanup plan.
- `scripts/scan_mac_cleanup.sh` - read-only scan script.
- `scripts/move_approved_to_trash.sh` - move explicitly approved paths to Trash.
- `approved/example-approved-paths.txt` - template approval list.

## Suggested workflow

1. Run a fresh scan:

   ```bash
   /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/scripts/scan_mac_cleanup.sh
   ```

2. Review the newest report under:

   ```text
   /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/reports/
   ```

3. Copy only approved paths into a new file, one absolute path per line:

   ```text
   /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/approved/approved-paths.txt
   ```

4. Dry-run the cleanup:

   ```bash
   /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/scripts/move_approved_to_trash.sh /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/approved/approved-paths.txt
   ```

5. If the dry-run looks right, move approved items to Trash:

   ```bash
   /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/scripts/move_approved_to_trash.sh --apply /Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/approved/approved-paths.txt
   ```

