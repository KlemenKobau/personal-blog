---
title: "Using a Local LLM with Ollama and rust"
date: 2026-03-28
tags: ["llm", "ai", "ollama", "self-hosted", "rust"]
summary: "Quickly setup Ollama for use in rust"
---

I wanted to setup a LLM locally for various pet projects.
I have a claude code subscription, but I needed to expose an API for local projects, so I searched the internet and
saw that Ollama has a very straight forward process.

Check out my pet project [mind map](https://github.com/KlemenKobau/mind-map), that uses LLMs and rust.

## Initial setup

For my distro I simply followed the installation on the [Arch linux ollama wiki page](https://wiki.archlinux.org/title/Ollama).

This runs ollama as a systemd service and you can use it with
```sh
ollama
```

Follow the CLI and you should be able to quickly setup for local use.

Example:
```
$ ollama 
>>> Why is the sky blue?
Thinking...
...

The sky is blue due to a phenomenon called **Rayleigh scattering**. ...
```

The process takes ~15s, which is quite a long time due to thinking and
because I am running NVIDIA 4060, which is not that powerful.

You can also turn off thinking by doing
```
$ ollama 
>>> /set nothink
Set 'nothink' mode.
```

This cut down the response time to ~5s, much better!

## Using in rust

You can get started with LLMs in rust simply by using the following dependencies.

```toml
[package]
name = "mind-map"
version = "0.1.0"
edition = "2024"

[dependencies]
ollama-rs = "0.3.4"
tokio = { version = "1", features = ["full"] }
anyhow = "1.0"
```

The main dependency here is [ollama-rs](https://github.com/pepperoni21/ollama-rs), look at their official documents for more examples.

A simple program looks like this

```rs
#[tokio::main]
async fn main() -> Result<()> {
    let ollama = Ollama::default();

    let req = GenerationRequest::new("qwen3.5:4b".to_string(), "Why is the sky blue?").think(false);
    let res = ollama.generate(req).await?;

    println!("{}", res.response);

    Ok(())
}
```

We create an Ollama handle, by default it connects to localhost:11434.
Next we create a request, call the API and print the response.

Notice that I disabled thinking, this is due to similar reasons as when
calling from the CLI, disabling thinking massively improved the response time and it was not needed for me.