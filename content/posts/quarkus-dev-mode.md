---
title: "Quarkus remote dev mode"
date: 2026-05-30
draft: false
tags: ["Quarkus", "java", "development", "kubernetes"]
summary: "Remote development with quarkus. Hot reload service code in a kubernetes service."
---

Project url: https://github.com/KlemenKobau/quarkus-dev-kubernetes

During work I make changes in services, that receive traffic from a lot of other services,
or creating the testing data would take a really long time.
We are running a dev environment, so I wondered whether there was some way to test
code changes inside the dev cluster, so that I do not have to setup everything locally.

I tried out [Quarkus Remote Development Mode](https://quarkus.io/guides/maven-tooling#remote-development-mode) and it looked
interesting, but unfortunately the hot reload did not work for changes inside dependencies.

In the end, this looks like a good trick for development inside a dedicated dev cluster,
but the dependency hot reload is still a big limitation.
