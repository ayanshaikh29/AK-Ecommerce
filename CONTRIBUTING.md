# Contributing Guide

Thanks for contributing to AK-Ecommerce.

## Workflow

1. Create a focused branch for each task.
2. Keep changes scoped and avoid unrelated edits.
3. Run tests relevant to your change.
4. Open a clear PR with summary and validation notes.

## Commit Message Style

Use meaningful, scoped commits:

- `feat: add vendor order status filters`
- `fix: correct GST split for interstate orders`
- `docs: add local setup instructions`
- `test: add reconciliation edge case`

Recommended prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Pull Request Checklist

- [ ] Changes are focused and reviewed locally
- [ ] `npm test` passes (when code/report logic changes)
- [ ] No secrets or credentials are committed
- [ ] Documentation updated when behavior/setup changed

## Reporting System Changes

If your changes affect report logic, also verify details in:

- [`REPORTING.md`](./REPORTING.md)
