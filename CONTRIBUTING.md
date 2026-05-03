# Contributing to Clypt

Thank you for your interest in contributing! This document explains how to get set up, the conventions we follow, and the process for submitting changes.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Conventions](#coding-conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) code of conduct. TL;DR: treat everyone with respect, assume good intent, and keep discussions constructive.

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- yt-dlp — `pip install yt-dlp` or via your package manager
- ffmpeg — required for GIF conversion and some audio extractions

### Setup

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/vkop007/clypt.git
cd clypt

# Install all workspace dependencies
pnpm install

# Copy the example env file
cp artifacts/clypt-next/.env.example artifacts/clypt-next/.env.local

# Start the dev server
pnpm --filter @workspace/clypt-next run dev
```

The app runs at `http://localhost:3000` (or the port shown in your terminal).

---

## Development Workflow

### Branching

- `main` — stable, always deployable
- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — tooling, docs, refactors

### Making changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes in `artifacts/clypt-next/`.
3. Run the type checker before committing:
   ```bash
   pnpm --filter @workspace/clypt-next exec tsc --noEmit
   ```
4. Commit using a clear, imperative message:
   ```
   feat: add audio bitrate selector
   fix: prevent crash on empty URL input
   chore: update yt-dlp path resolution
   ```

### Commit message format

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|---|---|
| `feat:` | New user-facing feature |
| `fix:` | Bug fix |
| `chore:` | Tooling, dependencies, config |
| `docs:` | Documentation only |
| `refactor:` | Code change with no feature/fix |
| `style:` | Formatting, whitespace |

---

## Coding Conventions

### TypeScript

- **Strict mode** is enabled. No `any` unless unavoidable — use `unknown` and narrow the type.
- Prefer explicit return types on exported functions.
- Use `interface` for object shapes; `type` for unions/aliases.

### React

- All client components must have `"use client"` at the top.
- Keep components focused. If a component exceeds ~200 lines, consider splitting it.
- State that lives only inside a single component stays local. Shared state goes in a custom hook under `hooks/`.
- Avoid prop-drilling more than 2 levels; lift state or use a hook.

### API routes

- Every route must export `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
- Long-running routes (downloads) must set `export const maxDuration = 300` for Vercel compatibility.
- Never use `console.log` in server code — use `req.log` in route handlers or the `logger` singleton.
- Validate all inputs and return a typed JSON error on failure.

### Styling

- Tailwind CSS v4 utility classes only — no custom CSS files unless absolutely necessary.
- Dark mode is handled via the `dark:` prefix (class strategy).
- Use the existing design tokens (`primary`, `zinc-*`, etc.) before introducing new colours.

### File layout

```
components/   — React components
hooks/        — Custom React hooks
lib/          — Pure utility modules (no React)
app/api/      — Next.js route handlers
```

---

## Submitting a Pull Request

1. Push your branch to your fork.
2. Open a PR against `main` on the original repo.
3. Fill in the PR template:
   - **What** — what changed and why
   - **How to test** — steps a reviewer can follow
   - **Screenshots** — for any UI changes
4. Address review comments promptly.
5. Squash your commits before merging if there are more than 3–4 fixup commits.

### PR checklist

- [ ] TypeScript compiles without errors (`tsc --noEmit`)
- [ ] Feature works end-to-end in a browser (not just server-side)
- [ ] No hardcoded secrets or API keys
- [ ] `.env.example` updated if new env vars were added
- [ ] `README.md` updated if the feature changes setup or usage
- [ ] Existing functionality is not broken

---

## Reporting Bugs

Open a GitHub Issue and include:

- A clear, one-line title
- Steps to reproduce
- Expected vs actual behaviour
- Browser and OS
- Any relevant console errors or screenshots

---

## Feature Requests

Open a GitHub Issue with the `enhancement` label. Describe:

- The problem you're trying to solve
- Your proposed solution or ideas
- Any alternatives you've considered

We read every request, but cannot guarantee every suggestion will be implemented. Contributions are the fastest path from idea to shipped feature.

---

Thank you for helping make Clypt better!
