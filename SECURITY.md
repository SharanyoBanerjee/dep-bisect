# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities by emailing security@dep-bisect.example.com (replace with actual email).

Alternatively, open a private security advisory on GitHub:
1. Go to the Security tab of this repository
2. Click "Report a vulnerability"
3. Fill in the details

We aim to respond within 48 hours and will work with you to validate, fix, and coordinate disclosure.

## Security Model

dep-bisect follows these security principles:

- **No network access in core path** - Runs offline once tarballs are cached
- **No lifecycle scripts** - `--ignore-scripts` by default, opt-in with `--scripts`
- **No user directory writes** - All operations in temp directories
- **No telemetry** - No data collection, no phone home
- **Registry auth from user config** - Uses `.npmrc` at runtime, never cached
- **Process isolation** - Each trial in separate temp workspace with timeout
- **No eval or dynamic code** - Pure TypeScript, no `eval`, `Function`, or similar

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious package scripts | `--ignore-scripts` by default |
| Supply chain compromise | Trial cache stores only hashes, not code |
| Path traversal | All paths resolved within temp workspace |
| Command injection | Arguments passed as array, not shell |
| Registry token leakage | Never logged, only used at runtime |
| Denial of service | Hard timeout per trial, kills process tree |

## Dependencies

Dependencies are audited on each release. Run `npm audit` to check current status.