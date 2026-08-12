---
title: "Understanding the basics of system calls and Tokio.rs"
date: 2026-08-12
tags: ["system calls", "kernel", "rust"]
summary: "Figuring out the basics of system calls in rust, by looking at Tokio. Example working on linux x86_64."
---

## Introduction

Professionally, I mostly work with java APIs, but I have long
wondered, how these servers actually work.

Like, suppose a new request comes, how can the server efficiently process this.
I also wanted to learn low level rust, so I figured this 
will be a perfect opportunity to learn a bit of both.

I looked around at how [Tokio.rs](https://tokio.rs/tokio/tutorial) 
handles this and found out, that it uses a work stealing async runtime.
This runtime then does a bunch of things, but at the bottom layer,
it calls [epoll](https://man7.org/linux/man-pages/man7/epoll.7.html) and
its related functions to schedule tasks on threads and wait until
the response arrives to wake up the thread.

I figured that this was much too complicated as a starting point, so
I set out to implement a simple [write(2)](https://man7.org/linux/man-pages/man2/write.2.html) system call.

The project is implemented in [Toy async runtime](https://github.com/KlemenKobau/Toy-async-runtime/tree/3bee8070cff2d46b296856f44a8846d50126d281) as an older commit.

## Implementing the system call

I will be focusing on linux with x86_64 architecture, since this
is just a proof of concept.
Take note, that this example *is platform specific*, since the system
calls change per operating system, but also per architecture (ARM, x86, x86_64 etc.).

On x86_64, we are lucky and system call is also a CPU instruction.
This means, that we can call it directly from assembly.
In rust, we can call assembly, by using the `core::arch::asm!` macro.
Since we are implementing the [write(2)](https://man7.org/linux/man-pages/man2/write.2.html) system call, let us first look at the call description.

```c
ssize_t write(int fd, const void buf[count], size_t count);
```

Write expects the file descriptor `fd` as the first argument (signed 32 bit).
For our simple case, the file register 1 is notable, 
since it is guaranteed to be `stdout`.
Next is a buffer pointer starting at `buf` (64 bit) 
and the final param is `count` which means that we will write 
at most `count` bytes (64 bit).
The call returns the number of bytes written as a signed size_t (in our case 64 bit).

Now let us look at the system call and then go through it line by line.

```rs
unsafe {
    asm!(
        "syscall",
        inout("rax") WRITE_SYSCALL_NUM => bytes_written,
        in("rdi") file_descriptor,
        in("rsi") buffer_pointer,
        in("rdx") buffer_byte_length,

        out("rcx") _,
        out("r11") _,
        options(nostack)
    )
}
```

The `asm!` macro requires unsafe, since the compiler cannot guarantee that
calls to assembly are safe.
We will be passing syscall arguments using registers, you can read more about this in
[syscall(2)](https://man7.org/linux/man-pages/man2/syscall.2.html).

Let's look at each line separately:
- "syscall" -> means to call the syscall cpu instruction
- `inout("rax") WRITE_SYSCALL_NUM => bytes_written` -> this is the rax register and by writing inout, we can use it as input and output. 
As input, this register holds the syscall number, which for linux you can see in [the linux kernel source code](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/arch/x86/entry/syscalls/syscall_64.tbl). 
On output, this register holds the number of bytes written, the syscall return. If the number is negative, then this indicates an error.
- `in("rdi")` -> on input, this register holds the 1st argument, the `file_descriptor`.
- `in("rsi")` -> the second argument, the buffer pointer
- `in("rdx")` -> third argument, buffer_byte_length
- `out("rcx") _` and `out("r11") _`, the syscall clobbers these registers, so we
should not assume that they still hold the values from before we made the call.
This lets the macro know that it should not assume that these registers survived.
- `options(nostack)` -> lets the macro know that the instruction
did not touch the stack. Without this it would be more defensive and less performant.

The final function body looks like this.
```rs
pub fn write(file_descriptor: int, buffer: &[u8]) -> ssize_t {
    let bytes_written: ssize_t;

    let buffer_pointer = buffer.as_ptr();
    let buffer_byte_length = buffer.len();

    unsafe {
        asm!(
            "syscall",
            inout("rax") WRITE_SYSCALL_NUM => bytes_written,
            in("rdi") file_descriptor,
            in("rsi") buffer_pointer,
            in("rdx") buffer_byte_length,

            out("rcx") _,
            out("r11") _,
            options(nostack)
        )
    }

    bytes_written
}
```

And we can call it with
```rs
write(1, b"hello");
```
Which writes `hello` to the console.

References:
- https://www.felixcloutier.com/x86/syscall
- https://coddy.tech/learn/assembly/fundamentals/what_is_syscall
