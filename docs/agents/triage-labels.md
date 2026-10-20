# Triage labels

These five canonical roles map directly to GitHub label names in `pzehrel/web-tools`.

| Canonical role    | GitHub label      | Meaning                                                                       |
| ----------------- | ----------------- | ----------------------------------------------------------------------------- |
| `needs-triage`    | `needs-triage`    | Maintainer assessment is required.                                            |
| `needs-info`      | `needs-info`      | Waiting for information from the reporter.                                    |
| `ready-for-agent` | `ready-for-agent` | Fully specified and suitable for an agent; blocking dependencies still apply. |
| `ready-for-human` | `ready-for-human` | Human implementation is required.                                             |
| `wontfix`         | `wontfix`         | Will not be actioned.                                                         |

Apply the mapped label when a skill names a role. Preserve unrelated existing labels; a triage role does not replace dependency or assignment checks.
