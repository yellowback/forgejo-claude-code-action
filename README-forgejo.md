# Claude Code Action for Forgejo

This is a Forgejo-compatible version of the Claude Code Action that enables Claude to interact with Forgejo pull requests and issues.

## Key Differences from GitHub Version

1. **No GraphQL Support**: Forgejo only supports REST API, so all GraphQL queries have been converted to REST API calls
2. **Token Authentication Only**: OIDC token exchange with Anthropic is not supported; use direct token authentication
3. **Workflow Location**: Place workflows in `.forgejo/workflows/` instead of `.github/workflows/`
4. **Runner Configuration**: Use `runs-on: docker` instead of `runs-on: ubuntu-latest`

## Prerequisites

- Forgejo instance with Actions enabled
- Forgejo Runner installed and configured
- Anthropic API key

## Installation

### 1. Create a Forgejo Access Token

1. Go to your Forgejo user settings
2. Navigate to Applications → Access Tokens
3. Generate a new token with the following permissions:
   - `repo`: Full repository access
   - `issue`: Issue and PR access
   - `write:issue`: Comment creation

### 2. Add Secrets to Your Repository

In your repository settings, add these secrets:
- `FORGEJO_TOKEN`: Your Forgejo access token
- `ANTHROPIC_API_KEY`: Your Anthropic API key

### 3. Create the Workflow File

Create `.forgejo/workflows/claude.yml` in your repository:

```yaml
name: Claude Forgejo Assistant

on:
  issue_comment:
    types: [created]
  issues:
    types: [opened, assigned, labeled]
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-forgejo:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'issues' && contains(github.event.issue.body, '@claude'))
    
    runs-on: docker
    container:
      image: node:20-alpine
    
    steps:
      - name: Install dependencies
        run: |
          apk add --no-cache git bash curl

      - name: Checkout repository
        uses: https://code.forgejo.org/actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.FORGEJO_TOKEN }}

      - name: Run Claude Forgejo Action
        uses: https://github.com/anthropics/claude-code-action@forgejo
        with:
          forgejo_url: ${{ env.GITHUB_API_URL }}
          forgejo_token: ${{ secrets.FORGEJO_TOKEN }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          trigger_phrase: "@claude"
```

## Usage

### In Issues
Create an issue with `@claude` in the body, or comment `@claude` followed by your request:
```
@claude Can you help me implement a new feature for user authentication?
```

### In Pull Requests
Comment on a PR with `@claude` to get code review or assistance:
```
@claude Please review this code and suggest improvements
```

### Assignee Trigger
Assign an issue to a user named `claude` to trigger the action.

### Label Trigger
Add the `claude` label to an issue to trigger the action.

## Configuration Options

### Required Parameters
- `forgejo_token`: Forgejo access token (usually from secrets)
- `anthropic_api_key`: Your Anthropic API key

### Optional Parameters
- `forgejo_url`: Forgejo API URL (auto-detected from `GITHUB_API_URL` if not specified)
- `model`: Claude model to use (default: `claude-3-5-sonnet-20241022`)
- `trigger_phrase`: Phrase to trigger Claude (default: `@claude`)
- `branch_prefix`: Prefix for branches created by Claude (default: `claude/`)
- `timeout_minutes`: Timeout for Claude's response (default: `30`)
- `allowed_tools`: Tools Claude can use (default includes file operations and bash)
- `custom_instructions`: Additional instructions for Claude

## Limitations

1. **No GitHub App Support**: Forgejo doesn't have an equivalent to GitHub Apps
2. **Limited API Features**: Some GitHub-specific features may not be available
3. **No GraphQL**: All queries use REST API, which may require more API calls
4. **No OIDC**: Direct token authentication only

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your `FORGEJO_TOKEN` has the correct permissions
   - Check that the token hasn't expired

2. **API Errors**
   - Ensure your `forgejo_url` is correct (should end with `/api/v1`)
   - Check Forgejo logs for detailed error messages

3. **Runner Issues**
   - Verify Forgejo Runner is properly installed and registered
   - Check that Docker is available on the runner

### Debug Mode

Enable debug logging by adding to your workflow:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

## Contributing

To contribute to the Forgejo support:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with a Forgejo instance
5. Submit a pull request

## Migration from GitHub

If migrating from GitHub to Forgejo:

1. Move workflows from `.github/workflows/` to `.forgejo/workflows/`
2. Update `runs-on: ubuntu-latest` to `runs-on: docker`
3. Replace GitHub-specific action references with Forgejo equivalents
4. Update authentication to use Forgejo tokens

## Support

For issues specific to Forgejo support, please:
1. Check existing issues in the repository
2. Create a new issue with the `forgejo` label
3. Include your Forgejo version and configuration