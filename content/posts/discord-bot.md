---
title: "Kendo Discord Bot - Reaction-Based Role Management in Rust"
date: 2026-01-04
draft: false
tags: ["rust", "discord", "docker", "serenity"]
summary: "A Discord bot built with Rust and Serenity for automatic role assignment via emoji reactions."
---

A Discord bot I built for the Kendo Discord server that automatically assigns roles when users react to messages with specific emojis.

**Repository:** [Discord-bot on GitHub](https://github.com/KlemenKobau/Discord-bot)

## What It Does

The bot monitors a specific message in the server. When users react with a designated emoji, they automatically receive a role. Remove the reaction, and the role is removed. Simple self-service role management.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Rust** | Language (Edition 2021) |
| **Serenity** | Discord API library |
| **Tokio** | Async runtime |
| **Docker** | Containerized deployment |
| **GitHub Actions** | CI/CD pipeline |

## How It Works

1. User reacts to the monitored message with the configured emoji
2. Bot validates the reaction (checks message ID and emoji)
3. Bot assigns the configured role to the member
4. When the reaction is removed, the role is automatically removed

The core logic lives in a single `main.rs` file implementing Serenity's `EventHandler` trait for `reaction_add` and `reaction_remove` events.

## Deployment

The bot supports multiple deployment options:

- **Pre-built Docker images** from GitHub Container Registry (easiest)
- **Docker Compose** for local development
- **Cargo** for direct Rust compilation

The Docker setup uses multi-stage builds for optimized image size and runs as a non-root user for security.

## Key Features

- Async/await patterns with Tokio
- Structured logging with `tracing`
- Graceful shutdown handling
- Comprehensive error handling with `anyhow`
- Full CI/CD with automatic image publishing to GHCR

## What I Learned

Building this bot was a good exercise in:
- Working with Discord's API through Serenity
- Rust's async ecosystem (Tokio)
- Multi-stage Docker builds
- Setting up GitHub Actions for container publishing
