---
title: "eBPF for Observability"
date: 2026-03-20
draft: true
tags: ["linux", "observability", "ebpf"]
summary: "eBPF lets you observe Linux systems from inside the kernel — no agents, no sidecars, no overhead. Here's how it works and how to start using it."
---

If you've been anywhere near the infrastructure space lately, you've probably heard "eBPF" thrown around. It sounds intimidating — the name literally has "BPF" in it, which stands for Berkeley Packet Filter, which sounds like something from a 1993 networking textbook. Because it is.

But modern eBPF has very little to do with packet filtering. It's become one of the most important technologies in Linux observability, and it's worth understanding why.

## What eBPF actually is

eBPF lets you run small, sandboxed programs inside the Linux kernel. No kernel module compilation. No rebooting. No risk of panicking the whole machine.

You write a program, the kernel's built-in verifier checks that it's safe (no infinite loops, no out-of-bounds memory access, no crashing the kernel), and then it runs at specific hook points — syscalls, network events, tracepoints, function entries, you name it.

Think of it as instrumenting the kernel the way you'd instrument application code. Except you don't need to modify the kernel source, and the overhead is negligible.

The key properties:

- **Safe** — the verifier guarantees your program won't crash the kernel
- **Fast** — programs run in kernel space, JIT-compiled to native instructions
- **Dynamic** — attach and detach programs at runtime, no restarts needed
- **No kernel modification** — works on stock kernels (4.x+, ideally 5.8+)

## Why it matters for observability

Traditional observability on Linux has always been a tradeoff.

**Agents** (Datadog agent, Telegraf, node_exporter) run in userspace. They poll `/proc`, parse files, make syscalls to gather data. This works, but you're adding CPU and memory overhead, and you only see what the kernel exposes through its existing interfaces. You're always one step removed.

**Sidecars** (like Envoy in a service mesh) intercept traffic by sitting in the data path. Effective, but adds latency and resource consumption per pod. At scale, this gets expensive.

**Kernel modules** give you full access, but they're dangerous. A bug in a kernel module takes down the machine. They need to be compiled for your specific kernel version. Nobody wants to maintain those.

eBPF sits in a sweet spot. You get kernel-level visibility with userspace safety. You can observe every syscall, every packet, every function call — with almost zero overhead because the program runs right where the events happen, not in a separate process polling for data.

This is why tools like Cilium replaced kube-proxy and iptables for Kubernetes networking. It's why Pixie can give you full application traces without any code instrumentation. The data is just *there* in the kernel. eBPF lets you tap into it.

## A practical example: tracing TCP connections with bpftrace

Let's do something concrete. Say you want to see every new TCP connection on a machine — which process is connecting where.

First, install bpftrace. On Ubuntu/Debian:

```sh
sudo apt install bpftrace
```

On Fedora:

```sh
sudo dnf install bpftrace
```

Now trace all outgoing TCP connections:

```sh
sudo bpftrace -e '
kprobe:tcp_connect
{
    $sk = (struct sock *)arg0;
    $inet_family = $sk->__sk_common.skc_family;

    if ($inet_family == AF_INET) {
        $daddr = ntop($sk->__sk_common.skc_daddr);
        $dport = $sk->__sk_common.skc_dport;
        printf("%-8d %-16s -> %s:%d\n",
            pid, comm, $daddr, $dport);
    }
}
'
```

Run this in one terminal, then do something like `curl https://example.com` in another. You'll see output like:

```
12345    curl             -> 93.184.216.34:443
```

That's a live, kernel-level trace of TCP connections. No agent installed. No application changes. The bpftrace program attached to the `tcp_connect` kernel function, and every time it fires, your program runs and prints the details.

Want something simpler? bpftrace ships with one-liners. Count syscalls by process:

```sh
sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'
```

Let it run for a few seconds, hit Ctrl+C, and you get a histogram of which processes are making the most syscalls. Instant performance insight.

Or trace which files are being opened:

```sh
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%-8d %-16s %s\n", pid, comm, str(args.filename)); }'
```

This is absurdly powerful for debugging. No strace overhead, no log parsing, just direct kernel observation.

## The tooling ecosystem

eBPF itself is a kernel feature. You interact with it through various tools and frameworks:

**bpftrace** — What we just used. High-level tracing language, great for ad-hoc investigations. Think of it as awk for kernel tracing. Perfect for debugging sessions.

**BCC (BPF Compiler Collection)** — A toolkit with dozens of ready-made tools: `tcpconnect`, `opensnoop`, `execsnoop`, `biolatency`, and many more. If you just want to run a tool and get answers, start here.

```sh
# trace all new TCP connections
sudo tcpconnect-bpfcc

# trace all file opens
sudo opensnoop-bpfcc

# histogram of block I/O latency
sudo biolatency-bpfcc
```

**libbpf / CO-RE** — If you're writing production eBPF programs, this is the modern approach. CO-RE (Compile Once, Run Everywhere) solves the problem of eBPF programs breaking across kernel versions. Write your program once and it runs on any kernel that supports BTF.

**Cilium** — Kubernetes networking and security powered by eBPF. Replaces kube-proxy, provides network policies, and gives you deep visibility into service-to-service traffic. If you're running Kubernetes, this is probably where you'll encounter eBPF first.

**Pixie** — Auto-instrumented observability for Kubernetes. Uses eBPF to capture application-level metrics, traces, and logs without any code changes. It can show you HTTP requests, DNS queries, and database calls just by running in the cluster.

**Tetragon** — Security observability from the Cilium project. Traces process execution, file access, and network activity for security monitoring. Think of it as an eBPF-powered audit system.

## When it makes sense

eBPF is great when you need:

- **Low-overhead monitoring** — you can't afford the CPU/memory cost of traditional agents
- **Deep kernel visibility** — you need to see syscalls, network packets, scheduler events
- **No-instrumentation tracing** — you want application-level data without modifying application code
- **Kubernetes networking** — Cilium is a better answer than kube-proxy + iptables for most clusters
- **Security monitoring** — real-time visibility into what processes are doing on your machines

## When it doesn't

eBPF isn't the answer to everything.

**You need Linux.** eBPF is a Linux kernel feature. If you're on Windows or macOS in production, this doesn't help. (There are early efforts on Windows, but it's not there yet.)

**Kernel version matters.** The good stuff requires kernel 5.8+. If you're stuck on older kernels (some enterprise distros), your options are limited. Check what your distro ships.

**It's not a replacement for application-level metrics.** eBPF can tell you that your service made an HTTP request that took 500ms. It can't tell you that the slowdown was because your business logic hit a slow code path. You still need application instrumentation for that.

**The learning curve is real.** Writing raw eBPF programs means understanding kernel internals, BPF maps, the verifier's constraints, and C. For most people, using existing tools (bpftrace, BCC, Cilium) is the right level of abstraction.

**Debugging eBPF programs is painful.** When the verifier rejects your program with a cryptic error, you're in for a rough time. The tooling is getting better, but it's not as smooth as debugging userspace code.

## Getting started

If you're curious, here's a reasonable path:

1. Install bpftrace and BCC tools on a test machine
2. Run some of the included tools (`opensnoop`, `tcpconnect`, `biolatency`) to see what's possible
3. Write a few bpftrace one-liners to answer real questions about your systems
4. If you're on Kubernetes, try Cilium or Pixie
5. If you want to go deeper, read Brendan Gregg's [BPF Performance Tools](https://www.brendangregg.com/bpf-performance-tools-book.html) — it's the definitive reference

eBPF isn't hype. It's a fundamental shift in how we interact with the Linux kernel. The fact that you can safely run custom code in kernel space, at runtime, with near-zero overhead — that changes what's possible for observability, networking, and security. The tools built on top of it are only going to get better.
