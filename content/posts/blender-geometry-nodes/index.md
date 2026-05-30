---
title: "Messing around with blender geometry nodes"
date: 2026-04-02
draft: false
tags: ["blender", "geometry nodes"]
summary: "Using blender geometry nodes for procedural generation"
---

Some time ago I was trying out geometry nodes in Blender and they looked like a
lot of fun!

![falling pillars](falling-pillars.gif)

The interesting thing about this setup is that blender calculates bounding boxes for each object,
so we can dynamically calculate when each of them should stop.
This means that in the future, I can randomize the objects and they should all sink by the same amount.
While this is not realistic, it is a good start.

This was the geometry node setup used to create it

![node setup](nodes.png)