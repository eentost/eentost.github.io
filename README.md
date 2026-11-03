# 하루도구

Daily useful calculators: shopping, price comparison, time, dates, percentage, split expenses.

Static site with browser-only calculations; no build step or dependency. Run `python3 -m http.server 8000` locally. This branch replaces the previous security site after merge. Old commits remain in Git history.

Before AdSense review, check live deployment, calculator edge cases, Search Console and site navigation. AdSense approval is never guaranteed.

## Situational AI prompt builder

- /tools/prompt-builder.html: 12 task-specific guided prompt templates
- /guides/prompt-guide.html: editorial guide and limitations
- Browser-only input; no remote AI API, no form submission or server storage
- Sample exercise: choose a scenario, click example, verify output changes with tone/format, copy and TXT export
- Run regression on 12 existing calculators after publication.

## 방문 통계 (GA4)

- 전 페이지에 분석 동의 모듈을 추가했으며 현재 측정 ID 미설정이면 수집은 비활성입니다.
- `assets/analytics-config.js`에 실제 `G-...` 측정 ID를 설정하세요.
- 상세 설정·이벤트·운영 검증: `docs/analytics-setup.md`
