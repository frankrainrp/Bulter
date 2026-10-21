# Register a development project

1. Inspect the local repository name, default branch, remote and working changes. Preserve uncommitted work before registration.
2. Create an account slot with a non-personal identifier and complete the official device-auth flow using `account-login.sh`.
3. Push the intended branch to GitHub and verify that the server has repository-specific read/push permission.
4. Run `register-project.sh` with the project identifier, display name, GitHub URL and existing branch. The project must remain under the configured automation workspace root.
5. Create a task containing the objective, acceptance checks, allowed scope, selected account/project and first run time.
6. Verify the registered account, repository and branch. After execution, inspect the task result, project checks, commit and remote branch.

Use account labels in reports; keep login-cache contents, tokens, cookies and keys out of task text and logs. A private repository requires server-side repository access configured through the existing credential mechanism. Credential migration is separate from normal project registration.

Successful verification permits a commit/push. Conflicts, test failures and missing decisions pause the task; usage exhaustion waits for the next eligible period.
