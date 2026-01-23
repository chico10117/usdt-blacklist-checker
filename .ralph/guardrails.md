# Guardrails (Signs)

> Lessons learned from failures. Read before acting.

## Core Signs

### Sign: Read Before Writing
- **Trigger**: Before modifying any file
- **Instruction**: Read the file first
- **Added after**: Core principle

### Sign: Test Before Commit
- **Trigger**: Before committing changes
- **Instruction**: Run required tests and verify outputs
- **Added after**: Core principle

---

## Learned Signs
### Sign: Never Kill Ralph Tee
- **Trigger**: When trying to stop or “finalize” the run log
- **Instruction**: Do not `kill` the `tee` process started by Ralph; it will exit when the agent exits. Killing it can terminate the iteration and leave PRD status/logs half-updated.
- **Added after**: US-005 iteration ended early due to killing `tee`

