# EENTOST Content Rebuild Implementation Plan

> **For agentic workers:** Apply the approved in-chat design; use independent content work under dispatching-parallel-agents and verify integration before completion.

**Goal:** Replace all 15 existing articles with useful, source-backed Korean defensive-security learning material and repair discovered navigation/advertising defects.
**Architecture:** Preserve Jekyll, the current theme, post filenames, dates and categories so existing URLs remain valid. Rewrite editorial content in place, add executable standard-library examples where useful, and maintain explicit revision dates and limits.
**Tech Stack:** Jekyll/Liquid, Markdown, Python standard library, existing HTML/CSS.
**Spec:** User-approved conversation: repair broken navigation and ad loading, improve language metadata, rebuild all existing articles; user permits removing prior text.

## Global Constraints
- No fabricated employment history, field incidents, measurements or reviewer approvals.
- No fixed word-count or traffic claim presented as a Google approval threshold.
- Preserve original dates and URLs; label complete rewrites with 2026-09-23 revision dates.
- Do not publish private Gmail content or identifiers in public artifacts.
- New examples must be harmless, local, reproducible and clearly synthetic.
- Retain existing publisher ID and ads.txt, which the account confirms is approved.

## Review Focus
- Code samples must actually run, with observed output separated from illustrative output.
- Internal links must target generated pages; no date fragments in breadcrumbs.
- XML must escape titles, summaries and URLs correctly.
- Ads must not load on errors or thin utility pages; verification metadata can remain.
- Article language, revision dates and source links must match the actual content.

## Tasks
- [ ] Content group A: rewrite welcome/research-method, password, zero-trust, AI evaluation, threat-intelligence articles; source and execute examples.
- [ ] Content group B: rewrite cryptography, incident-response, network, cloud, ransomware articles; source and execute examples.
- [ ] Content group C: rewrite web-security, malware, API-security, privacy engineering, secure-coding articles; source and execute examples.
- [ ] Common templates: replace URL-split breadcrumbs with valid archive links, per-page language, ad opt-out/default scope, sitemap revision dates, homepage revision labels and concise editorial disclosure.
- [ ] Verify: full Jekyll build where runtime is available, generated internal links/XML, all executable examples, desktop/mobile rendering and final independent review.
- [ ] Deliver/deploy: inspect authenticated GitHub capability, publish verified branch or PR using authorized existing access, verify live deployment. Request review only if all declared fixes are true and the site is ready; do not assert that Google has approved it.

## Execution record
- 2026-09-23: User explicitly approved full replacement after reviewing initial scoped proposal. Existing isolated clone is clean at 6bb665fb. Continue implementation without another design approval loop.
