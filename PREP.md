# Akasa Air – SDE Full Stack Intern: Prep Playbook

## 1. Company brief (verified from public sources)
- Operated by SNV Aviation Pvt Ltd; began flying Aug 2022; hubs Mumbai and Bengaluru.
- Fleet: all-Boeing 737 MAX (reported ~34 in 2026); ~25-28 destinations incl. ~5-6 international. Numbers vary by source, so say "30-ish aircraft" rather than quoting precisely.
- Etihad codeshare announced Dec 2024.
- Tech: Navitaire (New Skies order-based reservations, Digital Platform, GoNow, SkyLedger) powers booking/retailing; RateGain AI for dynamic fares (2022 deal); SmartKargo-built Akasa Air Cargo mobile app (Jul 2026); crew accommodation platform from Accommodations Plus Intl (Mar 2026); Robosoft did UI/UX for web/app.
- Implication: their engineers integrate with external systems (reservation engine, pricing, crew, cargo) and build customer and internal apps on top. **Integration, resilience and clean APIs matter more than greenfield novelty.**
- Not found: any public info on an intern hackathon format. Ask the recruiter: duration, team/solo, allowed stack, judging rubric, deliverables (demo/repo/deck).

## 2. JD -> your evidence map (use these in interviews)
| JD asks | Your proof |
|---|---|
| REST APIs, backend | 70+ Django REST endpoints for flight search/booking/payments at Acumen Travels (very close to airline domain!) |
| Secure coding | Razorpay HMAC-SHA256 verification, CSP, CSRF, rate limiting; RBAC + audit logs in Vaakya |
| Microservices | Gatekeeper API gateway: routing, token bucket, circuit breakers, health checks |
| Cloud-native | Docker + EC2 + GitHub Actions with rollback |
| GenAI / RAG / prompts | CodePulse (3 versioned LLM workflows, validated outputs, fallbacks, eval P/R/F1); Vaakya |
| Responsible AI | Consent-based sharing, hashed tokens, time-limited access |
| Reliability | Fallback workflows for payment/booking failures, p50/p95/p99 load tests |
Gaps vs JD: Java depth, React Native/Flutter, SQL Server in practice. Be honest; say you'd ramp quickly and cite learning speed.

## 3. Hackathon playbook (whatever the problem is)
**Likely themes:** flight search/booking, disruption handling (delay/cancel rebooking), AI assistant/chatbot for customers or ops, crew scheduling, baggage tracking, dynamic pricing, check-in, loyalty, ops dashboards.

**Winning formula (judges map to JD's eval list):**
1. First 15 min: restate the problem, define the user, pick ONE core flow. Write 3 non-goals.
2. Stack (fast + matches JD): React + Node/Express (or Django/Java if given) + MongoDB/MySQL + Docker. Add an LLM feature only where it genuinely helps.
3. Build vertical slice first (UI -> API -> DB), deploy early, never demo from localhost only.
4. Show engineering excellence: input validation, auth, rate limiting, error states, loading states, tests for the core logic, a README with architecture diagram, `.env.example`, one-command run (docker compose).
5. AI done right: RAG over policy/FAQ docs (baggage rules, refund policy) with citations, structured JSON outputs validated by schema, deterministic fallback when the LLM fails, guardrails (no PII in prompts, no invented policy, human handoff). Mention hallucination, prompt injection, and eval.
6. Demo script (3-5 min): problem -> live flow -> one "wow" (AI or resilience) -> architecture -> scaling/security story -> what next.
7. Customer obsession: a real traveler pain point, mobile-friendly, accessible.
8. Use AI tools openly (JD encourages it) but understand every line; be ready to explain.

**Time plan (example 24h):** 0-1h plan; 1-6h core slice; 6-14h features + AI; 14-18h hardening/tests; 18-21h deploy + polish; 21-24h demo + README.

## 4. Interview prep (JD evaluation areas)
- **DSA:** arrays/strings, hashmaps, two pointers, sliding window, BFS/DFS, heaps, intervals, basic DP. Practice 40-60 medium problems; explain complexity aloud.
- **OOD:** parking lot, airline reservation, seat allocation, elevator, rate limiter, LRU cache. Use SOLID, patterns (Strategy, Factory, Observer).
- **System design basics:** design flight booking (search vs booking consistency, seat locking with TTL, idempotent payments, webhooks, caching search results, DB indexing/sharding, queues, retries/circuit breakers), URL shortener, notification service.
- **DB:** normalization, indexes, transactions/isolation levels, double-booking prevention (row locks / unique constraints), SQL vs MongoDB tradeoffs.
- **Security:** OWASP top 10, JWT vs sessions, CSRF/XSS, SQLi, secrets, least privilege.
- **AI readiness:** transformers/LLM basics, tokens/context, temperature, prompt patterns (few-shot, CoT, structured output), RAG pipeline (chunk, embed, retrieve, rerank, cite), fine-tune vs RAG, evals, hallucination, prompt injection, bias/privacy, responsible AI.
- **Behavioral (STAR):** Ownership (Acumen: payment failure fallbacks), Collaboration (30+ PRs/code review), Learning agility (AI tooling, self-hosted Gemma), Customer obsession, Engineering excellence (CI/CD, load tests).

## 5. Questions to ask them
- What does an intern's first project look like, and how is PPO decided?
- How do you integrate with Navitaire and other vendors, and how do you handle their failures?
- How is AI used in customer journeys today?

## 6. Sources
Navitaire/Akasa, RateGain, SmartKargo, Accommodations Plus announcements; Wikipedia and press releases for fleet/network.
