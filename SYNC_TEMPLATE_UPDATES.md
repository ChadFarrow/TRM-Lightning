# How to Sync Updates from the Template Repository

If you created your repository from this template and want to pull updates from the original template, follow these steps:

## Step 1: Add the Template as Upstream Remote

**In your new repository** (`ChadFarrow/TRM-Lightning`), add the template repository as upstream:

```bash
git remote add upstream https://github.com/ChadFarrow/TRM-Lightning.git
```

**Note:** Make sure you're in your new repository directory (not the template repository) when running this command.

To verify it was added:
```bash
git remote -v
```

You should see:
- `origin` - your repository
- `upstream` - the template repository

## Step 2: Fetch Updates from Template

```bash
git fetch upstream
```

This downloads all the latest changes from the template repository without modifying your local files.

## Step 3: Merge Updates into Your Branch

### Option A: Merge (Recommended for most cases)

```bash
git checkout main  # or your main branch name
git merge upstream/main
```

This will merge the template updates into your branch. If there are conflicts, Git will pause and ask you to resolve them.

### Option B: Rebase (For a cleaner history)

```bash
git checkout main
git rebase upstream/main
```

**Note:** Only use rebase if you haven't pushed your changes yet, or if you're comfortable with force-pushing.

## Step 4: Resolve Conflicts (if any)

If there are conflicts, Git will mark them in the files. You'll need to:

1. Open the conflicted files
2. Look for conflict markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Template changes
   >>>>>>> upstream/main
   ```
3. Edit the files to keep the changes you want
4. Remove the conflict markers
5. Stage the resolved files:
   ```bash
   git add <resolved-file>
   ```
6. Complete the merge:
   ```bash
   git commit
   ```

## Step 5: Push Your Updated Repository

After successfully merging:

```bash
git push origin main
```

## Quick Sync Script

You can create a simple script to automate this:

```bash
#!/bin/bash
# sync-template.sh

echo "Fetching updates from template..."
git fetch upstream

echo "Merging updates..."
git merge upstream/main

echo "Done! Review changes and push when ready."
```

Save as `sync-template.sh`, make it executable (`chmod +x sync-template.sh`), and run it whenever you want to sync.

## Tips

- **Review changes before merging**: Use `git log upstream/main` to see what changed
- **Test after merging**: Always test your site after pulling template updates
- **Keep your customizations**: Your changes in `data/feeds.json`, `.env.local`, and custom assets won't be overwritten unless the template changes those same files
- **Backup first**: Consider creating a backup branch before merging:
  ```bash
  git branch backup-before-sync
  ```

## Common Issues

**"fatal: refusing to merge unrelated histories"**
- This happens if your repository and the template have completely different histories
- Solution: Add `--allow-unrelated-histories` flag:
  ```bash
  git merge upstream/main --allow-unrelated-histories
  ```

**"Your branch is ahead of 'origin/main' by X commits"**
- This is normal after merging. Just push your changes:
  ```bash
  git push origin main
  ```

