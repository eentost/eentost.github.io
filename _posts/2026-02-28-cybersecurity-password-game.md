---
layout: single
title: 특수문자 점수 대신 비밀번호 정책을 검토하는 방법
date: 2026-02-28
categories: cybersecurity-game interactive
tags: game password-strength hacking-defense ctf
excerpt: 길이·차단 목록·재사용·MFA를 분리해 판단하고, 실제 비밀번호를 입력받지 않는 정책 점검 예제를 실행합니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 기존 게시 주소와 최초 게시일은 유지했습니다. 아래 사례와 수치는 교육용 합성 예제이며 실제 침해 사고나 운영 성과가 아닙니다.

`Welcome2026!`에 숫자와 특수문자가 있다는 이유로 안전하다고 판정하면 어떤 문제가 생길까요? 사람은 규칙을 맞추면서도 예측하기 쉬운 표현을 선택할 수 있습니다. 문자열의 겉모양으로 계정 탈취 위험 전체를 계산할 수는 없습니다. 이 글에서는 **정책 조건을 충족하는가**와 **비밀번호가 추측에 강한가**를 분리합니다. 아래 예시는 공개되었으므로 실제 비밀번호로 사용하면 안 됩니다.

## 먼저 서비스가 처리할 위협을 나누기

온라인 로그인 시도에는 계정별 시도 제한과 MFA가 중요하고, 유출된 해시의 오프라인 추측에는 비밀번호 전용 해시와 저장 설계가 중요합니다. 여러 서비스에서 같은 비밀번호를 사용하는 문제는 복잡한 문자열을 요구해도 남습니다. 피싱 사이트가 비밀번호를 그대로 수집하는 상황도 문자 종류만으로 막지 못합니다.

[NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)는 비밀번호 단독 인증과 MFA 구성에서의 최소 길이를 구분하며, 흔하거나 유출된 값의 차단 목록과 실패 시도 제한을 다룹니다. 문자 종류 혼합을 강제하는 규칙을 안전성의 근거로 삼지 않습니다. 이를 모든 서비스에 그대로 적용되는 법적 의무로 읽는 대신 자신의 인증 구조와 위협을 함께 검토해야 합니다.

## 실제 비밀값을 받지 않는 정책 실험

다음 코드는 공개된 합성 문자열만 검사합니다. 단독 인증 정책의 예시로 15자를 사용하되, 차단 목록을 세 항목으로 축소했습니다. 이것은 비밀번호 강도 측정기나 실제 가입 검증기의 완성본이 아닙니다. Python 3으로 `password_policy.py`를 실행합니다.

```python
blocked = {"passwordpassword", "welcome2026welcome", "companyname2026!"}

def check_policy(value):
    reasons = []
    if len(value) < 15:
        reasons.append("too_short")
    if value.casefold() in blocked:
        reasons.append("demo_blocklist")
    return reasons or ["passes_demo_policy"]

cases = [
    ("short_complex", "Ab9!xQ2@"),
    ("listed_long", "PasswordPassword"),
    ("unlisted_public", "this-is-a-public-example"),
]
for label, value in cases:
    print(label, ",".join(check_policy(value)))
```

```text
short_complex too_short
listed_long demo_blocklist
unlisted_public passes_demo_policy
```

마지막 값은 인터넷에 공개된 표현인데도 통과합니다. **통과를 안전 판정이라고 부를 수 없는 이유**가 여기에 있습니다. 실제 차단 목록의 최신성과 범위, 계정 이름과 서비스 이름에 대한 정책, 인증 실패 제한, 비밀번호 저장 방식은 이 함수 바깥에 있습니다. `casefold()`는 이 작은 목록 비교의 선택이며 실제 로그인 비밀번호를 소문자로 변환하라는 권고가 아닙니다.

## 경계값을 확인할 때 던질 질문

14자와 15자, 공백이 있는 구문, 긴 붙여넣기, Unicode 입력을 각각 확인합니다. 서버가 입력을 몰래 잘라 저장하면 사용자가 생각한 비밀번호와 실제 비밀번호가 달라집니다. 길이를 문자로 셀지 바이트로 셀지도 문서화해야 합니다. 이 예제의 `len(str)`은 Python의 문자 단위 길이이며 사람이 화면에서 보는 글자 수와 항상 일치하는 것은 아닙니다.

브라우저와 서버 정책이 다를 때에는 서버가 최종 판단을 해야 합니다. 클라이언트의 초록 표시만 통과시키면 직접 요청하는 경로에서 제한을 우회할 수 있습니다. 거부 이유는 이해하기 쉽게 알려주되 실제 입력값을 분석 로그에 남기지 않습니다. 비밀번호 관리자의 생성·저장·붙여넣기를 방해하는 UI도 피합니다.

## 운영 점검표를 통과/실패로 만들기

| 확인할 항목 | 검증 방법 | 통과만으로 알 수 없는 것 |
|---|---|---|
| 차단 목록 | 테스트 전용 계정에서 목록 값 거부 확인 | 모든 유출 비밀번호 포함 여부 |
| 시도 제한 | 허가된 테스트 환경에서 제한 응답·복구 확인 | 분산 공격 대응의 충분성 |
| MFA | 분실·복구 절차까지 단계별 확인 | 모든 MFA가 피싱에 같은 저항성을 갖는지 |
| 저장 | 검토자가 저장 알고리즘·매개변수 확인 | 운영 비밀키나 DB가 안전한지 |
| 로그 | 오류·분석 로그에서 비밀번호 미포함 확인 | 다른 계층의 자동 수집 여부 |

서버 저장에는 일반 SHA-256 반복 같은 자체 설계 대신 검증된 비밀번호 저장 구현을 사용합니다. 구체적인 알고리즘과 비용 조정은 [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)를 참조하고, 서비스 환경에서 부하와 업그레이드 계획을 검토합니다. 이 글은 사용자의 실제 비밀번호를 평가하지 않으며, 입력 폼이나 외부 전송 기능도 제공하지 않습니다.
