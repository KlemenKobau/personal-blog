---
title: "Lights Out"
date: 2023-07-24T17:53:32+02:00
tags: ['algorithm']
draft: true
categories: ['algorithm']
---

Two years ago I created a application for solving [Lights Out](https://en.wikipedia.org/wiki/Lights_Out_(game)).
The code is available [here](https://gitlab.com/KlemenKobau/lights-out).
I created the application in quarkus (Java) and the frontend was developed in Angular.
The lights out problem can be described with the following story:

You were hired as a technician in a company.
During cleaning you discovered a small room with 9 lights where some are turned on and some are turned off.
The lights are arranged in a grid pattern, where 1 represents a light that is turned on
and 0 represents a light that is turned off.

```
1 0 1
1 1 1
1 1 1
```

Since it is close to the end of work hours you want to turn all the lights off and
after looking around you find a grid of 9 buttons,
arranged in a grid, similarly as the lights.
After pressing the middle button (below marked with X),
you notice that 5 lights flipped.

```
1 0 1    1 1 1
1 X 1 -> 0 0 0
1 1 1    1 0 1
```

After playing around for a bit you notice,
that pressing a button **flips** the light
in the same position as the switch and also all neighbouring lights.
After some brute forcing you manage to turn all the lights off.
Feeling proud, you walk into the next room and find a bigger
room with much more lights.

Slightly depressed, you try to think of a smarter solution.
You want to get home as soon as possible.
What is the smallest number of clicks you need to turn all the lights off?
You are pretty sure you saw a light flick, is a solution still possible?