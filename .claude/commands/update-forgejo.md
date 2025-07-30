# Update Forgejo Branch

Update the forgejo branch with latest changes from anthropics/main while preserving Forgejo-specific changes.

## Commands to execute:

```bash
# Ensure we're on the forgejo branch
git checkout forgejo

# Fetch latest from anthropics
git fetch anthropics

# Show what would be merged
echo "=== Changes from anthropics/main ==="
git log forgejo..anthropics/main --oneline

# Create a backup branch just in case
git branch -f forgejo-backup forgejo

echo ""
echo "Backup branch 'forgejo-backup' created. Proceed with merge? (Respond with 'yes' to continue)"
```

If the user confirms:

```bash
# Merge with a clear commit message
git merge anthropics/main -m "chore: merge upstream changes from anthropics/main

Keep Forgejo support up to date with latest Claude Code Action features"

# Show the status
git status

echo ""
echo "Merge complete. Review changes and resolve any conflicts if needed."
```

## Notes:
- This preserves all Forgejo-specific changes while incorporating upstream updates
- A backup branch is created before merging for safety
- Conflicts may need manual resolution