---
title: "The WebAssembly Component Model"
date: 2026-03-20
draft: true
tags: ["wasm", "rust", "containers"]
summary: "The WASM Component Model enables composable, polyglot modules. Here's what it is, how it works, and how it compares to containers."
---

For years, WebAssembly has been "the future" of portable computation. And for years, the actual developer experience has been: compile your code to a `.wasm` blob, glue it together with JavaScript, and hope for the best. Plain Wasm modules are powerful but limited — they only speak in integers and floats, can't natively pass strings or structs, and have no standard way to talk to each other.

The [Component Model](https://component-model.bytecodealliance.org/) changes that. It adds the missing layer that makes Wasm modules composable, interoperable, and practical to use across languages.

## What the Component Model actually is

A plain Wasm module is a low-level compilation target. It exports and imports functions, but those functions can only deal with numeric types. Want to pass a string? You're manually managing shared memory. Want one module to call another? You're writing glue code.

The Component Model sits on top of core Wasm and adds:

- **Rich types**: strings, lists, records, variants, enums, options, results — first-class.
- **Defined interfaces**: components declare what they provide and what they need using a formal interface definition language.
- **Composition**: you can wire components together without writing any glue code.
- **Language independence**: a component built in Rust can be consumed by one built in Go, Python, or JavaScript. The types translate cleanly across language boundaries.

Think of it like this: core Wasm is assembly. The Component Model is a calling convention, type system, and package manager rolled into one.

## WIT: WebAssembly Interface Types

[WIT](https://component-model.bytecodealliance.org/design/wit.html) is the IDL (Interface Definition Language) for the Component Model. It defines the contract between components — what functions they expose, what types they use, and what they depend on.

Here's what a simple WIT file looks like:

```wit
package example:greeter@0.1.0;

interface greet {
    record greeting {
        message: string,
        lang: string,
    }

    greet: func(name: string) -> greeting;
}

world greeter {
    export greet;
}
```

A few things to notice:

- `package` gives the component a namespaced identity with a version.
- `interface` defines a set of types and functions. This is what other components can import.
- `world` describes the full shape of a component — what it exports (provides) and what it imports (needs).
- Types like `string`, `record`, `list<T>`, `option<T>`, and `result<T, E>` are all built in.

If you've used protobuf or GraphQL schemas, WIT will feel familiar. The difference is that WIT maps directly to Wasm component boundaries — there's no separate serialization step.

## Building a component in Rust

Let's build the greeter component from above using [`cargo-component`](https://github.com/bytecodealliance/cargo-component).

First, install the toolchain:

```sh
cargo install cargo-component
```

Create a new project:

```sh
cargo component new greeter --lib
cd greeter
```

This scaffolds a project with a `wit/` directory. Drop in the WIT file from above at `wit/world.wit`, then implement it in `src/lib.rs`:

```rust
#[allow(warnings)]
mod bindings;

use bindings::exports::example::greeter::greet::{Guest, Greeting};

struct Component;

impl Guest for Component {
    fn greet(name: String) -> Greeting {
        Greeting {
            message: format!("Hello, {name}!"),
            lang: "en".to_string(),
        }
    }
}

bindings::export!(Component with_types_in bindings);
```

The `bindings` module is auto-generated from your WIT file. You get real Rust types — `Greeting` is a struct, `String` is a `String`. No manual memory juggling.

Build it:

```sh
cargo component build --release
```

You get a `.wasm` file in `target/wasm32-wasip1/release/`. That file is a self-describing, portable component. It carries its interface metadata with it.

## Composing components

Say you have two components:

1. A `greeter` that exports a `greet` function.
2. An `http-handler` that imports `greet` and uses it to respond to HTTP requests.

The `http-handler`'s WIT might look like:

```wit
package example:http-handler@0.1.0;

world handler {
    import example:greeter/greet@0.1.0;
    export wasi:http/incoming-handler@0.2.0;
}
```

You compose them using [`wac`](https://github.com/bytecodealliance/wac) (WebAssembly Compositions):

```sh
wac plug handler.wasm --plug greeter.wasm -o composed.wasm
```

That's it. The output is a single `.wasm` file where the handler's import of `greet` is satisfied by the greeter component. There's no networking between services, no shared memory management, and no IPC involved — the composed component runs as one unit.

You can keep composing. Need to swap in a different greeter that speaks French? Build a new component with the same WIT interface and plug it in. The handler doesn't change.

## Containers vs Components

The obvious question: when would I use a Wasm component instead of a container?

**Where components win:**

- **Startup time**. A Wasm component starts in microseconds. Containers take seconds. For serverless and edge workloads, this difference is significant.
- **Size**. A typical component is kilobytes to low megabytes. Container images are tens to hundreds of megabytes.
- **Composition**. Wiring components together is a build-time operation with type checking. Wiring containers together involves configuration files, networking setup, and considerably more moving parts.
- **Sandboxing**. Components get capability-based security by default. They can only access what you explicitly grant. Containers have a much larger attack surface.
- **Portability**. A Wasm component runs anywhere there's a Wasm runtime — Linux, macOS, Windows, the browser, the edge. A single binary covers all of them.

**Where containers still win:**

- **Ecosystem maturity**. Containers have a decade head start. The tooling, registries, orchestration (Kubernetes), monitoring, and debugging story is vastly more mature.
- **Arbitrary workloads**. Containers can run anything — databases, legacy apps, GUI tools. Components are constrained to what WASI provides. You're not running PostgreSQL as a Wasm component any time soon.
- **Networking**. Containers have full network access by default. WASI's networking story is still catching up.
- **Team familiarity**. Everyone knows Docker. The Component Model is still new to most developers.

The honest answer is that they're not direct competitors. Components are best for application logic — business logic, request handling, data transformation. Containers are best for running full services and infrastructure. In practice, you'll probably use both: Wasm components for your application code, running inside a container or on an edge runtime.

## Current state and what's coming

The Component Model is shipping in real runtimes today:

- **Wasmtime** has full Component Model support.
- **WASI 0.2** is stable and includes interfaces for HTTP, I/O, clocks, random, filesystem, and sockets.
- **Fermyon Spin**, **Fastly Compute**, and **Cosmonic** all run component-based workloads in production.
- **warg** registries are emerging as the package manager story for components.

What's on the horizon:

- **WASI 0.3** is bringing async support, meaning components will be able to do non-blocking I/O natively — an important step for server workloads.
- **WASI 1.0** will be the stable milestone. Once it lands, the interface stability guarantees mean components built today will keep working.
- **Language support** is broadening. Rust and Go have the best tooling right now, but Python, JavaScript, and C++ guests are actively being developed.

The Component Model is at the stage where you can build real things with it, but you'll still hit rough edges. Documentation is sparse in places, error messages can be cryptic, and the toolchain is evolving fast. That said, the trajectory is clear and progress has been steady.

If you've been waiting for Wasm to become practical outside the browser, the Component Model is worth a serious look.

## Sources

- [Component Model](https://component-model.bytecodealliance.org/) — Bytecode Alliance documentation for the Component Model
- [WIT specification](https://component-model.bytecodealliance.org/design/wit.html) — WebAssembly Interface Types design documentation
- [cargo-component](https://github.com/bytecodealliance/cargo-component) — Cargo subcommand for building Wasm components in Rust
- [wac](https://github.com/bytecodealliance/wac) — WebAssembly Compositions tool for plugging components together
- [Wasmtime Component Model](https://docs.wasmtime.dev/api/wasmtime/component/index.html) — Wasmtime runtime support for the Component Model
- [WASI 0.2 (wasip2)](https://github.com/WebAssembly/WASI/tree/main/wasip2) — Stable WASI preview 2 specification
- [WASI repository](https://github.com/WebAssembly/WASI) — WebAssembly System Interface specification, including WASI 0.3 development
- [Fermyon Spin](https://www.fermyon.com/spin) — Framework for building serverless applications with Wasm components
- [Fastly Compute](https://www.fastly.com/products/edge-compute) — Edge compute platform running Wasm component workloads
- [warg registry](https://github.com/bytecodealliance/registry) — Package registry protocol for WebAssembly components
