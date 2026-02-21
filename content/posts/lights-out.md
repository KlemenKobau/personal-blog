---
title: "Solving the Lights Out problem"
date: 2023-07-24T17:53:32+02:00
tags: ['algorithm', 'math', 'quarkus', 'java', 'angular']
draft: true
math: true
---

Two years ago I created a application for solving [Lights Out](https://en.wikipedia.org/wiki/Lights_Out_(game)).
The code is available [here](https://gitlab.com/KlemenKobau/lights-out).
I created the application in quarkus (Java) and the frontend was developed in Angular.

## Story

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
in the same position as the switch and also all neighboring lights.
After some brute forcing you manage to turn all the lights off.
Feeling proud, you walk into the next room and find a bigger
room with much more lights.

Slightly depressed, you try to think of a smarter solution.
You want to get home as soon as possible.
What is the smallest number of clicks you need to turn all the lights off?
You are pretty sure you saw a light flick, is a solution still possible?

## Solution

The lights out problems seems tricky at first, but it has an elegant solution.
A naive approach could consist of a depth first search with pruning, but we will look at a
fast solution with matrices.

### Idea

Let's look at the 2x2 case

```
1 0
0 1
```

The problem has the following properties:
- the clicked button only affects neighboring fields
- clicking the same button twice returns the problem back to the original state

I made it obvious with the previous diagrams, but we can represent a light with a boolean,
1 means turned on and 0 means turned off.

We will now use a more mathematical notation to better represent the problem.

Out example:
```
1 0
0 1
```

Becomes:

$$
\begin{bmatrix}
x_{11} & x_{12} \\\
x_{21} & x_{22}
\end{bmatrix}
$$

We will define the following:
- $x_{ij}$ represents the state of the light in the *i*-th row and *j*-th column
- $c_{ij}$ represents whether we will click the button in the i*-th row and *j*-th column
- $y_{ij}$ shows the final state in the *i*-th row and *j*-th column

Let's look at what determines whether the light is on or off in the top left corner.
Mod 2 just means that we are working in binary.

$$
y_{11} = x_{11} + c_{11} + c_{12} + c_{21} \space mod \space 2
$$

Intuitively, this makes sense. The new state depends on the starting state
and whether the neighboring buttons were clicked or not.
We can do this for all fields.

$$
y_{11} = x_{11} + c_{11} + c_{12} + c_{21} \space mod \space 2 \\\
y_{12} = x_{12} + c_{11} + c_{12} + c_{22} \space mod \space 2 \\\
y_{21} = x_{21} + c_{11} + c_{21} + c_{22} \space mod \space 2 \\\
y_{22} = x_{22} + c_{12} + c_{21} + c_{22} \space mod \space 2
$$

We now have a system of equations! What is even nicer is that that the relationship is 
composed only of simple addition!
If you know a bit of maths you probably know that these systems can be solved by substituting
and eliminating the variables, but our solution happens to
have a very nice matrix representation.
You can read more about this in [Wikipedia: System of linear equations](https://en.wikipedia.org/wiki/System_of_linear_equations).

$$
\begin{bmatrix}
    y_{11} \\\
    y_{12} \\\
    y_{21} \\\
    y_{22}
\end{bmatrix} =
\begin{bmatrix}
    x_{11} \\\
    x_{12} \\\
    x_{21} \\\
    x_{22}
\end{bmatrix} +
\begin{bmatrix}
    c_{11} & c_{12} & c_{21} & 0 \\\
    c_{11} & c_{12} & 0 & c_{22} \\\
    c_{11} & 0 & c_{21} & c_{22} \\\
    0 & c_{12} & c_{21} & c_{22}
\end{bmatrix}
$$