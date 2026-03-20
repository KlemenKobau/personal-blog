# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog at kkobau.com built with Hugo (v0.154.2) using the PaperMod theme (managed as a git submodule).

## Common Commands

```bash
# Local development server with live reload
hugo server

# Build for production (outputs to public/)
hugo --gc --minify

# Create a new blog post
hugo new content/posts/<slug>.md
```

## Architecture

- **Hugo static site** with PaperMod theme as a git submodule in `themes/PaperMod/`
- **Content** lives in `content/posts/` as Markdown files with YAML frontmatter
- **Theme overrides** go in `layouts/partials/` — only override what's needed, don't duplicate theme files
- **Configuration** is in `hugo.toml`

### Math Rendering

KaTeX is integrated for LaTeX math. To enable on a post, add `math: true` to the frontmatter. Delimiters: `$$...$$` and `$...$` for display/inline math. The setup lives in `layouts/partials/math.html`.

### LLM Output

A custom `llms.txt` output format template exists for LLM-friendly site structure.

### Deployment

GitHub Actions (`.github/workflows/hugo.yml`) builds and deploys to GitHub Pages on push to main. The workflow installs Go, Node.js, Dart Sass, and Hugo extended edition.

## Content Conventions

- Posts use YAML frontmatter with: `title`, `date`, `tags`, `summary`, `draft`
- Set `draft: true` to exclude a post from production builds
- Tags are lowercase (e.g., `rust`, `kubernetes`, `algorithm`)
