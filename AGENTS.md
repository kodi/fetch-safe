## Memory - Use ZIKKARON MCP for Context Management (when available)

- On every new session, call `recall` tool with the current project name
- Before starting any task, call `get_project_context` for the current directory
- After completing significant work, call `remember` to store decisions and outcomes
- For releases, publish via GitHub Actions with `gh workflow run publish.yml -f dry_run=false` after pushing the release commit and tag.
- ALWAYS DO THAT WHEN STARTING NEW WORK!