---
title: "Post-Quantum Cryptography for Developers"
date: 2026-03-20
draft: true
tags: ["security", "cryptography"]
summary: "Quantum computers will eventually break RSA and ECC. Here's what's replacing them and what developers should actually do about it today."
---

Sometime in the next decade or two, a sufficiently powerful quantum computer will break RSA and elliptic curve cryptography. Not weaken them — break them entirely. Every TLS handshake, every signed binary, every encrypted secret that relies on the hardness of factoring or discrete logarithms becomes vulnerable.

This isn't hypothetical hand-wraving. NIST has already finalized new standards. Browsers are already shipping hybrid key exchanges. The migration is underway.

Here's what you need to know.

## Why RSA and ECC will break

Classical computers can't efficiently factor large numbers or solve the discrete logarithm problem. That's the foundation of RSA and ECC. Shor's algorithm, running on a large enough quantum computer, solves both in polynomial time.

The key phrase is "large enough." Current quantum computers have a few thousand noisy qubits. Breaking RSA-2048 likely requires millions of error-corrected qubits. We're not there yet.

But there are two reasons to care now:

1. **Harvest now, decrypt later.** Adversaries can record encrypted traffic today and decrypt it once quantum computers are capable. If your data needs to stay confidential for 10+ years, this matters right now.
2. **Migration takes time.** Swapping cryptographic primitives across an entire ecosystem is a multi-year effort. The time to start is before you're forced to.

The timeline is fuzzy — serious estimates range from 2030 to 2045 for a cryptographically relevant quantum computer. Nobody knows for sure. But "we don't know when" is not the same as "we can ignore it."

## The new NIST standards

In 2024, NIST finalized three post-quantum cryptographic standards. These are built on mathematical problems that are hard for both classical and quantum computers.

### ML-KEM (formerly Kyber) — Key encapsulation

This is the replacement for key exchange. Whenever you establish a shared secret — TLS handshakes, key agreement protocols — ML-KEM is what you'll use.

It's based on the Module Learning With Errors (MLWE) problem, a lattice-based construction. It's fast, and the key sizes are manageable:

| Parameter set | Public key | Ciphertext | Shared secret |
|---|---|---|---|
| ML-KEM-512 | 800 bytes | 768 bytes | 32 bytes |
| ML-KEM-768 | 1,184 bytes | 1,088 bytes | 32 bytes |
| ML-KEM-1024 | 1,568 bytes | 1,568 bytes | 32 bytes |

Compare this to X25519 where the public key is 32 bytes. The keys are bigger. We'll come back to that.

### ML-DSA (formerly Dilithium) — Digital signatures

This replaces RSA and ECDSA signatures. Code signing, certificate chains, authenticated messages — anything that needs a digital signature.

Also lattice-based (MLWE/MSIS). The signatures are larger than what we're used to:

| Parameter set | Public key | Signature |
|---|---|---|
| ML-DSA-44 | 1,312 bytes | 2,420 bytes |
| ML-DSA-65 | 1,952 bytes | 3,309 bytes |
| ML-DSA-87 | 2,592 bytes | 4,627 bytes |

An ECDSA signature is around 64 bytes. ML-DSA-65 is 3,309 bytes. That's a 50x increase. Not a problem for most applications, but it adds up in certificate chains and protocols that exchange many signatures.

### SLH-DSA (formerly SPHINCS+) — Hash-based signatures

This is the conservative backup option for signatures. It relies only on the security of hash functions, which are extremely well-understood. If lattice-based cryptography turns out to have a weakness we haven't found yet, SLH-DSA is the fallback.

The trade-off: signatures are larger (up to ~50 KB) and signing is slower. You probably won't use this directly unless you're building something that needs maximum long-term confidence.

## What's already changing

This isn't future stuff. Post-quantum cryptography is shipping in production systems right now.

### Browsers and TLS

Chrome and Firefox have enabled hybrid key exchange by default since 2024. When you connect to a site that supports it, the TLS 1.3 handshake uses **X25519Kyber768** — a combination of classical X25519 and ML-KEM-768.

The "hybrid" part is important. If ML-KEM turns out to have a flaw, X25519 still protects you. If quantum computers arrive, ML-KEM protects you. You get security against both threats.

You can check if a connection used hybrid PQ key exchange in Chrome DevTools under the Security tab.

### Libraries

The major cryptographic libraries have support:

- **OpenSSL 3.5+**: ML-KEM and ML-DSA support via the default provider
- **BoringSSL**: ML-KEM support (used by Chrome, Go, and others)
- **AWS-LC**: Full ML-KEM and ML-DSA support
- **liboqs**: Open Quantum Safe project, provides a comprehensive collection of PQ algorithms with C and language bindings

If you're using Go 1.24+, the standard `crypto/tls` package already supports hybrid PQ key exchange out of the box. No configuration needed — the client will prefer it when the server supports it.

```go
// Go 1.24+ uses X25519Kyber768 by default in TLS 1.3
// No special configuration required
conn, err := tls.Dial("tcp", "example.com:443", &tls.Config{})
```

In Python, you'll likely interact with this through your TLS library. If you're using `cryptography` (the library), PQ support is being added incrementally:

```python
from cryptography.hazmat.primitives.asymmetric import ml_kem

private_key = ml_kem.generate_private_key(ml_kem.MLKEMParameters768)
public_key = private_key.public_key()

# Encapsulate — produces a shared secret and ciphertext
shared_secret, ciphertext = public_key.encapsulate()

# Decapsulate — recovers the shared secret
recovered_secret = private_key.decapsulate(ciphertext)
```

### Cloud providers

AWS KMS, Google Cloud KMS, and Cloudflare have all started rolling out PQ-capable options. AWS announced ML-KEM support for TLS connections to AWS services. Cloudflare has had PQ key exchange enabled by default for all sites behind their CDN since late 2024.

## Practical steps you can take today

You don't need to rewrite anything. But you should start preparing.

### 1. Audit your cryptographic dependencies

Figure out where you're using RSA, ECDH, and ECDSA. This includes:

- TLS configurations (what cipher suites are enabled?)
- Certificate authorities and certificate pinning
- JWT signing (RS256, ES256)
- Data encryption at rest (key wrapping, envelope encryption)
- SSH keys
- VPN configurations

You don't need to replace all of these tomorrow. You need to know where they are.

### 2. Test hybrid PQ in staging

If you control your TLS termination (not just sitting behind Cloudflare), try enabling hybrid key exchange:

```nginx
# nginx with OpenSSL 3.5+
ssl_ecdh_curve X25519Kyber768Draft00:X25519:P-256;
```

Run your test suite. Check if anything breaks. The most common issue is middleboxes and firewalls that choke on the larger ClientHello messages (hybrid PQ key exchange adds about 1 KB to the handshake).

### 3. Watch for larger sizes

The biggest practical impact of PQ cryptography is size. Larger keys, larger signatures, larger handshake messages. This can affect:

- **MTU and fragmentation**: TLS handshakes that used to fit in one packet may now fragment. Test with real networks, especially on constrained or mobile connections.
- **Certificate chains**: If certificates use PQ signatures, the chain gets significantly larger. A chain with three ML-DSA-65 certificates adds roughly 10 KB of signature data alone.
- **Storage**: If you store lots of public keys or signatures (think a blockchain or a package registry), the storage requirements grow substantially.
- **Embedded/IoT**: Constrained devices may struggle with the larger key sizes and the computation required for lattice-based operations.

### 4. Stop using RSA for new things

If you're starting a new project, prefer ECDH/ECDSA (P-256 or Curve25519) over RSA. Not because RSA is broken today, but because the migration path from ECDH to ML-KEM is cleaner than from RSA to ML-KEM. Smaller existing keys mean less disruption when you add hybrid PQ support.

### 5. Update your threat model

If you handle data that needs to remain confidential for 15+ years (medical records, legal documents, government data), the harvest-now-decrypt-later threat applies to you today. Prioritize PQ-protected TLS for data in transit and consider PQ key wrapping for data at rest.

## What you can safely ignore for now

Not everything needs your attention yet.

- **Replacing all signatures immediately.** The harvest-now-decrypt-later threat applies to encryption, not signatures. Signature migration is important but less urgent. You need to worry about it before quantum computers arrive, but you have more time than with key exchange.
- **AES and SHA.** Symmetric cryptography and hash functions are mostly fine. Grover's algorithm gives a quadratic speedup for brute-force search, which means AES-128 becomes effectively AES-64 against a quantum computer. The fix is simple: use AES-256. You probably already are.
- **Picking winners among PQ algorithms.** ML-KEM and ML-DSA are the NIST standards. Use those. Don't go chasing exotic alternatives unless you have a very specific reason.
- **Panicking.** The migration is happening. Browsers are doing it. Cloud providers are doing it. Your TLS library will handle most of it for you. Your job is to not be the bottleneck when the defaults change.

## The bottom line

Post-quantum cryptography is not a future problem. The standards are finalized. The implementations are shipping. The transition is gradual and mostly invisible — your browser is probably already doing PQ key exchange right now.

The practical advice is boring: know what crypto you use, test the new stuff in staging, don't start new projects on RSA, and pay attention to the size increases. That's it. No need to rewrite your stack. Just don't sleepwalk into a world where everything you encrypted is suddenly readable.
