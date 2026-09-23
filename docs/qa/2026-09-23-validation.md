# Content rebuild validation — 2026-09-23

- Replaced all 15 posts, preserving filenames, original dates, categories and URLs.
- Python standard-library examples: 14 executed successfully and matched documented output (`python docs/qa/verify_examples.py`).
- The S3 policy article is a policy review exercise, not a claim of execution against an AWS account.
- Static Jekyll 3.10 build succeeded using Ruby 3.3.12, Liquid 4 and the repository's vendored theme.
- Generated-site validator initially reported 96 issues. After fixes: 28 HTML pages passed link/fragment, language, heading, utility-page ad exclusion, XML and revision-date checks (`python docs/qa/verify_site.py`).
- Browser: homepage and full article render; breadcrumbs point to valid pages. At 390 px viewport the document width was 375 px with no page-level horizontal overflow.
- Korean search initially returned all 15 posts for `소유권`. Literal matching now returns the two relevant posts. Search responds to input events, including Korean input and paste.
- `git diff --check` passed.

AdSense approval is an external review outcome; these checks do not guarantee it. Continued substantive updates and genuine reader usefulness remain editorial responsibilities.
