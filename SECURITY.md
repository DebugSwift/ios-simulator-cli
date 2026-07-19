# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version  | Supported          |
| -------- | ------------------ |
| >= 1.3.3 | :white_check_mark: |
| < 1.3.3  | :x:                |

## Fixed Vulnerabilities

### Command Injection (Fixed in v1.3.3)

**CVE**: To be assigned  
**Severity**: Moderate  
**Fixed in**: v1.3.3 (2025)

**Description**: Previous versions contained command injection vulnerabilities in several commands (ui_tap, ui_type, ui_swipe, ui_describe_point, ui_describe_all, screenshot, record_video, stop_recording) due to unsafe shell command construction using string interpolation.

**Impact**: Malicious input could potentially execute arbitrary commands on the host system.

**Fix**: Replaced unsafe `execAsync` string interpolation with secure `execFile` calls using argument arrays. Added input validation.

## Reporting a Vulnerability

To report a security issue, please use the GitHub Security Advisory "Report a Vulnerability" tab.

You can expect an initial response to your report within 48 hours. We will keep you informed about the progress of addressing the vulnerability and will work with you to coordinate the disclosure timeline.

If the vulnerability is accepted:

- We will work on a fix and keep you updated on the progress
- Once a fix is ready, we will coordinate with you on the disclosure timeline
- You will be credited for the discovery (unless you prefer to remain anonymous)

If the vulnerability is declined:

- We will provide a detailed explanation of why it was not accepted
- If appropriate, we will suggest alternative approaches or mitigations
