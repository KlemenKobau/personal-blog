---
title: "Async Rust in Practice with Tokio"
date: 2026-03-28
draft: true
tags: ["rust", "async", "tokio", "concurrency"]
summary: "Async Rust is powerful but has a reputation for being confusing. Here's how it actually works, what Tokio does under the hood, and the practical patterns you need to avoid shooting yourself in the foot."
---

Async Rust has a reputation. It's the part of the language that makes experienced engineers reach for a stress ball. The `Future` trait, the polling model, `Pin`, `Send` bounds — it can feel like a lot to absorb before writing a single working program.

But the underlying model is coherent once you see it clearly. And [Tokio](https://tokio.rs/), the dominant async runtime, makes most of the complexity manageable in practice. Here's what you actually need to know.

## Why async exists

The alternative to async is threads. Threads work fine — until you need tens of thousands of concurrent connections. An OS thread typically costs ~8MB of stack space by default on Linux, plus scheduling overhead. At 10,000 concurrent connections, that's 80GB in stacks alone. Not practical.

Async solves this by multiplexing many logical tasks onto a small thread pool. While one task is waiting on a network response, the thread handles something else. The switch between tasks is cooperative and cheap — no kernel involvement, no full context switch.

This is the same model as Go's goroutines, JavaScript's event loop, and Python's asyncio. The core idea is identical. What differs is *how* Rust expresses it.

## How Rust's async model works

In Rust, `async fn` returns a `Future`. A `Future` is a value that represents a computation that hasn't necessarily finished yet. The interesting part: **Rust futures are lazy**. Unlike JavaScript promises or Go goroutines, a Rust future does nothing until something drives it.

```rust
async fn fetch_data() -> String {
    // This function doesn't run yet just because it was called.
    // It returns a Future<Output = String>.
    "hello".to_string()
}

let future = fetch_data(); // Nothing happens here.
let result = future.await; // Now it runs.
```

Under the hood, the compiler transforms an `async fn` into a state machine. Each `.await` point becomes a state — the function can suspend here and resume later. The state machine implements the `Future` trait's `poll` method, which either returns `Poll::Pending` (not done, call me later) or `Poll::Ready(value)` (done).

This matters because nobody runs that state machine for you. You need a runtime.

## What Tokio actually does

Tokio is an executor and I/O event loop. At startup, it spawns a thread pool (defaulting to one thread per CPU core). Each thread runs a loop: pull a task, call `poll`, if `Poll::Pending` park it and move to the next one, if `Poll::Ready` the task is done.

The scheduler is work-stealing. Each worker thread has a local run queue. When a thread runs out of work, it steals tasks from another thread's queue — specifically, it moves half the tasks over. This keeps all cores busy without a single global lock becoming a bottleneck.

When a task is waiting on I/O (a socket read, a timer), Tokio registers the interest with the OS via [epoll](https://man7.org/linux/man-pages/man7/epoll.7.html) (Linux), kqueue (macOS), or IOCP (Windows). When the I/O is ready, the OS notifies Tokio, which wakes the task and puts it back on a run queue.

The `#[tokio::main]` macro sets all of this up:

```rust
#[tokio::main]
async fn main() {
    // You're running inside a Tokio runtime here.
    // The macro expands to: tokio::runtime::Runtime::new().block_on(async { ... })
}
```

## Spawning tasks

`tokio::spawn` creates a new task that runs concurrently:

```rust
#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        // This runs as an independent task on the thread pool.
        do_something().await
    });

    // Do other work concurrently, then wait for the spawned task:
    let result = handle.await.unwrap();
}
```

Tasks spawned with `tokio::spawn` must be `'static` and `Send`. `'static` because Tokio can't guarantee when the task runs relative to the current stack frame. `Send` because the task can move between threads in the work-stealing scheduler.

If you need to run many things concurrently without spawning independent tasks, `tokio::join!` and `FuturesUnordered` are your tools:

```rust
// Run both concurrently, wait for both:
let (a, b) = tokio::join!(fetch_users(), fetch_orders());

// Run a dynamic number concurrently:
use futures::stream::{FuturesUnordered, StreamExt};

let mut tasks = FuturesUnordered::new();
for id in ids {
    tasks.push(fetch_item(id));
}
while let Some(result) = tasks.next().await {
    process(result);
}
```

## The biggest footgun: blocking in async code

Here's the rule: **never block an async thread**. Blocking means any operation that holds the thread for a significant time without yielding — file I/O via `std::fs`, a `std::sync::Mutex` held across an await, a CPU-heavy computation, or a call to `thread::sleep`.

When you block a Tokio thread, all the other tasks scheduled on that thread are also blocked. You're defeating the whole purpose.

```rust
// Bad: blocks the entire thread for however long this takes.
async fn bad() {
    let data = std::fs::read_to_string("big_file.txt").unwrap();
    process(data).await;
}
```

For blocking I/O, use `tokio::task::spawn_blocking`:

```rust
// Good: runs the blocking code on a dedicated blocking thread pool.
async fn good() {
    let data = tokio::task::spawn_blocking(|| {
        std::fs::read_to_string("big_file.txt").unwrap()
    })
    .await
    .unwrap();

    process(data).await;
}
```

`spawn_blocking` uses a separate thread pool with a much higher limit (512 threads by default) designed for exactly this — blocking operations that can't be made async. The downside: tasks spawned here can't be cancelled.

For CPU-bound work, the [rayon](https://github.com/rayon-rs/rayon) crate is the right tool. Rayon uses a work-stealing thread pool sized to CPU cores, designed for data parallelism. Bridging rayon into Tokio looks like this:

```rust
async fn compute_heavy(data: Vec<f64>) -> f64 {
    let (tx, rx) = tokio::sync::oneshot::channel();

    rayon::spawn(move || {
        let result = data.par_iter().map(|x| x * x).sum();
        tx.send(result).ok();
    });

    rx.await.unwrap()
}
```

## The runtime flavors

Tokio has two runtime configurations:

```rust
// Multi-threaded (default): work-stealing thread pool, N cores.
#[tokio::main]
async fn main() { ... }

// Single-threaded: one thread, cooperative multitasking only.
// Tasks do NOT need to be Send.
#[tokio::main(flavor = "current_thread")]
async fn main() { ... }
```

The `current_thread` flavor is useful for tools, CLI apps, and tests where you don't need true parallelism and want to avoid `Send` bounds. For servers handling real concurrency, use the default.

## async-std is gone

As of early 2025, [async-std has been officially discontinued](https://github.com/async-rs/async-std). If you're starting a new Rust project with async, Tokio is the answer. It has by far the largest ecosystem — `hyper`, `axum`, `reqwest`, `sqlx`, `tonic`, and most other async libraries target Tokio.

If you want something minimal, [smol](https://github.com/smol-rs/smol) is the suggested async-std replacement. It's a lightweight runtime that composes well with existing libraries, but its ecosystem is much smaller.

## A note on complexity

Async Rust has genuine rough edges. `Pin` and `Unpin` will confuse you at some point. Trait objects with async methods require workarounds like the [async-trait](https://github.com/dtolnay/async-trait) crate (though native async-in-traits landed in Rust 1.75 with some limitations). The `Send` bound on spawned tasks forces you to think carefully about shared state.

These aren't gratuitous. They're the price of having the compiler guarantee memory safety and data-race freedom at compile time, without a garbage collector. The model works, and once the concepts click, the error messages become genuinely helpful rather than cryptic.

Start with `#[tokio::main]`, `tokio::spawn`, and `tokio::task::spawn_blocking`. Those three get you very far.

## Sources

- [Tokio documentation](https://tokio.rs/) — official runtime docs, tutorials, and API reference
- [Making the Tokio scheduler 10x faster](https://tokio.rs/blog/2019-10-scheduler) — deep dive into the work-stealing scheduler redesign
- [tokio::task::spawn_blocking](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) — official API docs
- [Async: What is blocking?](https://ryhl.io/blog/async-what-is-blocking/) — Alice Ryhl's guide on blocking vs. async-safe operations
- [Bridging with sync code](https://tokio.rs/tokio/topics/bridging) — Tokio's guide on integrating blocking/sync code
- [rayon](https://github.com/rayon-rs/rayon) — data parallelism for CPU-bound work
- [async-std repository](https://github.com/async-rs/async-std) — notes on discontinuation
- [smol](https://github.com/smol-rs/smol) — lightweight async runtime
- [The State of Async Rust: Runtimes](https://corrode.dev/blog/async/) — corrode.dev overview of the async runtime landscape
