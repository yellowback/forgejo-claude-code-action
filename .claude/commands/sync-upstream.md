# Sync with Upstream Anthropics Repository

Fetch and merge the latest changes from the upstream Anthropics repository.

## Commands to execute:

```bash
# Fetch latest changes from anthropics
git fetch anthropics

# Show the differences
echo "=== Showing commits from anthropics/main not in current branch ==="
git log HEAD..anthropics/main --oneline

# Ask user if they want to merge
echo ""
echo "Do you want to merge these changes? (Respond with 'yes' to merge)"
```

If the user confirms, then:

```bash
# Merge anthropics/main into current branch
git merge anthropics/main
```

## Notes:
- This will fetch the latest changes from the original Anthropics repository
- Review the changes before merging to avoid conflicts
- Make sure your local changes are committed before merging