---
title: "eBPF for Observability"
date: 2026-03-20
draft: true
tags: ["linux", "observability", "ebpf"]
summary: "eBPF lets you run sandboxed programs in the Linux kernel to observe syscalls, network events, and more. Here's how it works and how to start using it."
---

If you've been anywhere near the infrastructure space lately, you've probably heard "eBPF" thrown around. It sounds intimidating — the name literally has "BPF" in it, which stands for Berkeley Packet Filter, which sounds like something from a 1993 networking textbook. Because it is.

But modern [eBPF](https://ebpf.io/what-is-ebpf/) has very little to do with packet filtering. It's become one of the most important technologies in Linux observability, and it's worth understanding why.

## What eBPF actually is

eBPF lets you run small, sandboxed programs inside the Linux kernel. No kernel module compilation. No rebooting. No risk of panicking the whole machine.

You write a program, the kernel's built-in verifier checks that it's safe (no infinite loops, no out-of-bounds memory access, no crashing the kernel), and then it runs at specific hook points — syscalls, network events, tracepoints, function entries, you name it.

Think of it as instrumenting the kernel the way you'd instrument application code. The verifier guarantees your program won't crash the kernel, and once accepted, the program is JIT-compiled to native instructions and runs in kernel space with minimal overhead. You can attach and detach programs at runtime — no restarts, no kernel recompilation, and no need to be on a custom kernel. Stock kernels from 4.x onward support eBPF, though 5.8+ is where the feature set becomes broadly useful.

## Why it matters for observability

Traditional observability on Linux has always been a tradeoff.

**Agents** (Datadog agent, Telegraf, node_exporter) run in userspace. They poll `/proc`, parse files, make syscalls to gather data. This works, but you're adding CPU and memory overhead, and you only see what the kernel exposes through its existing interfaces. You're always one step removed.

**Sidecars** (like Envoy in a service mesh) intercept traffic by sitting in the data path. Effective, but adds latency and resource consumption per pod. At scale, this gets expensive.

**Kernel modules** give you full access, but they're dangerous. A bug in a kernel module takes down the machine. They need to be compiled for your specific kernel version. Nobody wants to maintain those.

eBPF sits in a sweet spot. You get kernel-level visibility with userspace safety. You can observe every syscall, every packet, every function call — with almost zero overhead because the program runs right where the events happen, not in a separate process polling for data.

This is why tools like [Cilium](https://cilium.io/) replaced kube-proxy and iptables for Kubernetes networking. It's why [Pixie](https://px.dev/) can give you full application traces without any code instrumentation. The data is just *there* in the kernel. eBPF lets you tap into it.

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

The bpftrace program attached to the `tcp_connect` kernel function, and every time it fires, your program runs and prints the details — no agent required, no application changes.

Want something simpler? bpftrace ships with one-liners. Count syscalls by process:

```sh
sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'
```

Let it run for a few seconds, hit Ctrl+C, and you get a histogram of which processes are making the most syscalls — useful for spotting unexpectedly noisy services.

Or trace which files are being opened:

```sh
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%-8d %-16s %s\n", pid, comm, str(args.filename)); }'
```

Compared to `strace`, which intercepts syscalls from userspace and adds noticeable overhead, these bpftrace programs run inside the kernel and have a much smaller performance footprint.

## The tooling ecosystem

eBPF itself is a kernel feature. You interact with it through various tools and frameworks:

**[bpftrace](https://github.com/bpftrace/bpftrace)** — What we just used. High-level tracing language, great for ad-hoc investigations. Think of it as awk for kernel tracing. Perfect for debugging sessions.

**[BCC (BPF Compiler Collection)](https://github.com/iovisor/bcc)** — A toolkit with dozens of ready-made tools: `tcpconnect`, `opensnoop`, `execsnoop`, `biolatency`, and many more. If you just want to run a tool and get answers, start here.

```sh
# trace all new TCP connections
sudo tcpconnect-bpfcc

# trace all file opens
sudo opensnoop-bpfcc

# histogram of block I/O latency
sudo biolatency-bpfcc
```

**[libbpf](https://github.com/libbpf/libbpf) / CO-RE** — If you're writing production eBPF programs, this is the modern approach. CO-RE (Compile Once, Run Everywhere) solves the problem of eBPF programs breaking across kernel versions. Write your program once and it runs on any kernel that supports BTF.

**Cilium** — Kubernetes networking and security powered by eBPF. Replaces kube-proxy, provides network policies, and gives you deep visibility into service-to-service traffic. If you're running Kubernetes, this is probably where you'll encounter eBPF first.

**Pixie** — Auto-instrumented observability for Kubernetes. Uses eBPF to capture application-level metrics, traces, and logs without any code changes. It can show you HTTP requests, DNS queries, and database calls just by running in the cluster.

**[Tetragon](https://tetragon.io/)** — Security observability from the Cilium project. Traces process execution, file access, and network activity for security monitoring. Think of it as an eBPF-powered audit system.

## When it makes sense

eBPF is most useful in scenarios where traditional tooling falls short. If you're running a latency-sensitive service and can't afford the CPU overhead of a polling agent, an eBPF program attached to the relevant kernel functions collects the same data at a fraction of the cost. If you need to debug network issues at the packet level in a Kubernetes cluster, Cilium gives you that visibility without the iptables complexity. If you want HTTP-level traces across services but can't modify the application code, Pixie can derive them from kernel-level socket data. In security contexts, Tetragon can monitor process execution and file access in real time, acting as a lightweight audit layer.

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

eBPF gives you a practical way to run custom logic inside the kernel without the risks that traditionally came with that level of access. For observability, networking, and security, it opens up instrumentation approaches that were previously impractical. The ecosystem is maturing, and the tools built on top of it are steadily getting easier to use.

## Sources

- [eBPF](https://ebpf.io/what-is-ebpf/) — introduction to eBPF and how it works
- [eBPF kernel version support](https://docs.ebpf.io/linux/) — feature availability by Linux kernel version
- [bpftrace](https://github.com/bpftrace/bpftrace) — high-level tracing language for Linux
- [BCC (BPF Compiler Collection)](https://github.com/iovisor/bcc) — toolkit with ready-made eBPF-based tracing tools
- [libbpf](https://github.com/libbpf/libbpf) — C library for building production eBPF programs with CO-RE
- [Cilium](https://cilium.io/) — eBPF-powered Kubernetes networking, security, and observability
- [Pixie](https://px.dev/) — auto-instrumented observability for Kubernetes using eBPF
- [Pixie documentation](https://docs.px.dev/about-pixie/what-is-pixie/) — detailed overview of Pixie's capabilities
- [Tetragon](https://tetragon.io/) — eBPF-based security observability from the Cilium project
- [BPF Performance Tools](https://www.brendangregg.com/bpf-performance-tools-book.html) — definitive reference book by Brendan Gregg
