# Performance, capacity and abuse resistance

This is a code-level inventory, **not** a load test or SLA. Verify limits in production-like QA and measure memory/latency before setting capacity targets.

| Path | Existing guard | Residual risk / next measurement |
| --- | --- | --- |
| PDF generation | Server-authorized; production per-user rate limit 40; no-store response | React-PDF memory and long-profile rendering time unmeasured; hosting timeout may interrupt |
| Source upload/extraction | Resume 10 MB, photo 5 MB; MIME/extension/signature checks; DOCX uncompressed cap 40 MB/1000 ZIP entries; PDF max 100 pages; extracted text max 2 million chars | Malicious parser inputs/CPU timeout and AV remain unresolved; isolate/test in production-like runtime |
| Brand image decoding | Sharp input pixel limit 16 million | Decode CPU/memory and malformed-image behavior need live QA |
| Admin directory | 2000-role scan cap, 200 batch, 25 display rows, 1000 document row cap | Full scan may be slow at scale; no cursor-based DB search; test before larger client base |
| Skill library | Server query capped at 500 names | Search currently loads capped list; monitor size and move to server search if needed |
| Career save | Max 50 entries per section plus field validation; production rate limit 40 | Payload/transaction cost needs runtime measurement |

Production rate limiting depends on the prepared SEC-01 migration and independent `SECURITY_RATE_LIMIT_KEY`; fail-closed behavior is unit-tested but the remote gate is open. Next QA should measure p50/p95 latency, peak memory, concurrent generation, upload parse time and error rates with fictional data; set budgets only from observed results. Do not remove caps to mask truncation. A bounded directory that exceeds its scan cap fails explicitly rather than silently omitting records. No paid load-testing service is required.
