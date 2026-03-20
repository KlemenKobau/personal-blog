---
title: "PostgreSQL as Your AI Database"
date: 2026-03-20
draft: true
tags: ["postgresql", "ai", "databases", "pgvector"]
summary: "You probably don't need a dedicated vector database. PostgreSQL with pgvector handles semantic search well enough for most workloads."
---

Everyone building AI features right now faces the same question: where do I store my embeddings? The default answer from most tutorials is "pick a vector database" — Pinecone, Weaviate, Qdrant, take your pick. But there's a decent chance you already have the answer running in production.

PostgreSQL with [pgvector](https://github.com/pgvector/pgvector) has quietly become a solid option for most use cases.

## Why not a dedicated vector database?

Dedicated vector databases exist for a reason. If you're running similarity search over billions of vectors with sub-millisecond latency requirements, they're the right tool. But most workloads look more like this:

- A few hundred thousand to a few million embeddings
- Semantic search alongside regular relational queries
- Filtering results by metadata (user ID, category, date range)
- No appetite for operating yet another database in production

That last point is worth considering seriously. Every new piece of infrastructure is another thing to monitor, back up, secure, and debug at 3 AM. If PostgreSQL can handle your vector workload, that's one fewer service in your stack.

## Setting up pgvector

Assuming you have PostgreSQL 15+ running, enabling pgvector is straightforward.

```sql
CREATE EXTENSION vector;
```

That's it. Now you can create a table with a vector column:

```sql
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    created_at TIMESTAMPTZ DEFAULT now()
);
```

The number in `vector(1536)` is the dimension of your embeddings. This depends on which model you use — OpenAI's `text-embedding-3-small` outputs 1536 dimensions, while smaller models like `nomic-embed-text` use 768.

## Inserting embeddings

Generate your embeddings however you like (OpenAI API, a local model, whatever) and insert them as arrays:

```sql
INSERT INTO documents (content, embedding)
VALUES (
    'PostgreSQL is a powerful open-source relational database',
    '[0.0123, -0.0456, 0.0789, ...]'  -- your 1536-dim vector
);
```

In practice you'll do this from application code. Here's a Python example with `psycopg`:

```python
import psycopg

with psycopg.connect("postgresql://localhost/mydb") as conn:
    conn.execute(
        "INSERT INTO documents (content, embedding) VALUES (%s, %s)",
        ("Some text content", embedding_vector)
    )
```

## Querying: finding similar documents

The core operation is nearest-neighbor search. pgvector supports several distance functions:

```sql
-- Cosine distance (most common for text embeddings)
SELECT content, embedding <=> query_embedding AS distance
FROM documents
ORDER BY embedding <=> query_embedding
LIMIT 10;

-- L2 (Euclidean) distance
SELECT content, embedding <-> query_embedding AS distance
FROM documents
ORDER BY embedding <-> query_embedding
LIMIT 10;

-- Inner product (for normalized vectors)
SELECT content, embedding <#> query_embedding AS distance
FROM documents
ORDER BY embedding <#> query_embedding
LIMIT 10;
```

The `<=>` operator is cosine distance and is what you'll want for most text embedding models.

## Hybrid queries

One practical advantage of using PostgreSQL is that you can combine vector similarity with regular SQL filters in a single query:

```sql
SELECT content, embedding <=> $1 AS distance
FROM documents
WHERE created_at > now() - INTERVAL '30 days'
  AND category = 'engineering'
ORDER BY embedding <=> $1
LIMIT 10;
```

With a dedicated vector database, this typically means filtering client-side, working around limited metadata filtering, or maintaining a separate relational store — which partly defeats the purpose.

Since your vectors live alongside your relational data in PostgreSQL, joins, CTEs, and window functions all work as expected.

## Indexing for performance

Without an index, pgvector does an exact nearest-neighbor scan. Fine for small tables, but you'll want an index as you scale.

pgvector supports two index types:

### HNSW (recommended for most cases)

```sql
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

HNSW (Hierarchical Navigable Small World) gives you approximate nearest neighbors with great recall. It uses more memory but is faster at query time. The `m` and `ef_construction` parameters control the trade-off between build time, memory, and recall.

### IVFFlat

```sql
CREATE INDEX ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

IVFFlat is faster to build and uses less memory, but requires the table to already have data before you create the index (it clusters the vectors). Set `lists` to roughly `sqrt(row_count)` for a reasonable starting point.

For most workloads under a few million vectors, HNSW is the better default.

## Tuning query performance

You can control the recall/speed trade-off at query time:

```sql
-- For HNSW: higher ef_search = better recall, slower queries
SET hnsw.ef_search = 100;  -- default is 40

-- For IVFFlat: higher probes = better recall, slower queries
SET ivfflat.probes = 10;  -- default is 1
```

Start with the defaults and increase if your recall isn't good enough. You can set these per-transaction, so different queries can have different trade-offs.

## When to reach for something else

PostgreSQL with pgvector is not the answer to everything. Consider a dedicated solution when:

- **Scale**: You have hundreds of millions or billions of vectors. At that point, purpose-built systems with sharding and distributed search make sense.
- **Latency**: You need single-digit millisecond p99 latency on vector search specifically. pgvector is fast, but specialized systems can be faster.
- **Managed simplicity**: Services like Pinecone handle scaling, replication, and indexing automatically. If you don't want to think about PostgreSQL tuning, a managed vector DB might be less work, not more.

But for the majority of applications — RAG pipelines, semantic search, recommendation features — pgvector on PostgreSQL is a pragmatic, battle-tested choice.

## The bottom line

You don't need to complicate your stack to build AI features. If you're already running PostgreSQL (and statistically, you probably are), pgvector gets you 90% of the way there with zero additional infrastructure.

Start simple. Add a vector column, create an HNSW index, and see how far it takes you.

## Sources

- [pgvector](https://github.com/pgvector/pgvector) — PostgreSQL extension for vector similarity search, including distance functions, HNSW, and IVFFlat indexing
- [OpenAI text-embedding-3-small](https://platform.openai.com/docs/models/text-embedding-3-small) — OpenAI embedding model outputting 1536-dimensional vectors
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings) — documentation on generating and using text embeddings
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) — official PostgreSQL reference
