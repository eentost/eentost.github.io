---
layout: single
title: '로그에 무엇을 남길까: 허용 목록으로 개인정보 노출 줄이기'
categories: cybersecurity privacy compliance
tags: gdpr ccpa privacy data-protection regulations
excerpt: 전체 요청을 저장하는 로그 대신 목적에 필요한 필드만 선택하고, 합성 데이터로 비밀 값과 제어문자 유출을 검사합니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 최초 게시일과 주소를 유지했습니다. 모든 입력은 교육용 합성 데이터입니다.

오류를 빨리 찾으려고 요청 객체 전체를 로그에 넣으면 비밀번호, 인증 토큰, 이메일이 함께 저장될 수 있습니다. 화면에서 값을 가려도 로그 수집기와 백업에는 원문이 남습니다. 이 글은 법률별 준수 여부를 판정하는 대신 **로그를 만드는 지점에서 불필요한 데이터를 줄이는 방법**을 실험합니다.

## 먼저 로그의 질문을 정하기

예제의 목적은 “어떤 경로에서 어떤 상태 코드가 발생했는가”입니다. 이 질문에는 비밀번호도 이메일도 필요하지 않습니다. 사용자별 행동 추적이 필요하다면 별도 목적과 접근 권한을 검토해야 합니다. 편리하다는 이유만으로 기본 로그의 필드를 늘리지 않습니다.

| 입력 필드 | 예제에서의 처리 | 이유 |
|---|---|---|
| method | 알려진 값만 선택 | 요청 종류 구분 |
| route | 등록된 경로 템플릿만 허용 | 실제 주소의 ID·검색어 노출 방지 |
| status | 정수 100~599만 허용 | 오류 분류 |
| email, password, authorization | 선택하지 않음 | 이 분석 목적에 불필요 |
| body, query, headers | 선택하지 않음 | 임의의 비밀 값이 포함될 수 있음 |

삭제 목록은 새 필드가 생길 때 놓치기 쉽습니다. 허용 목록은 새 필드를 명시적으로 검토하기 전에는 출력하지 않습니다. 그렇다고 허용된 필드 안의 값까지 안전하다는 뜻은 아닙니다. URL 전체를 `route`에 넣으면 값 안에서 정보가 새기 때문에 아래 코드는 경로 템플릿도 제한합니다.

## 로컬에서 확인하는 최소 로그

Python 3 표준 라이브러리만 사용합니다. 실제 요청을 받거나 파일에 저장하지 않습니다. `route`는 프레임워크가 라우팅을 완료한 뒤 제공하는 템플릿이어야 하며 클라이언트가 보낸 헤더를 그대로 믿어서는 안 됩니다.

```python
import json

def safe_event(raw):
    method = raw.get("method")
    route = raw.get("route")
    status = raw.get("status")
    return {
        "method": method if method in {"GET", "POST"} else "OTHER",
        "route": route if route in {"/notes", "/notes/{id}"} else "OTHER",
        "status": status if type(status) is int and 100 <= status <= 599 else None,
    }

raw = {
    "method": "GET", "route": "/notes/{id}", "status": 200,
    "email": "demo@example.org", "password": "SYNTHETIC_SECRET",
    "authorization": "Bearer SYNTHETIC_TOKEN",
    "new_private_field": "future field",
}
encoded = json.dumps(safe_event(raw), sort_keys=True)
print(encoded)
assert "SYNTHETIC" not in encoded and "example.org" not in encoded
assert set(safe_event(raw)) == {"method", "route", "status"}
dirty = safe_event({"method": "GET\nFAKE", "route": "/notes?email=x", "status": True})
assert dirty == {"method": "OTHER", "route": "OTHER", "status": None}
print("allowlist and invalid-value checks passed")
```

기대 출력:

```text
{"method": "GET", "route": "/notes/{id}", "status": 200}
allowlist and invalid-value checks passed
```

`type(status) is int`는 Python에서 `bool`이 `int`의 하위형인 점 때문에 사용했습니다. `isinstance(True, int)`만 검사하면 상태 코드로 참·거짓을 허용할 수 있습니다. 줄바꿈이 들어간 메서드도 등록된 값이 아니므로 `OTHER`가 됩니다. 이 실험은 임의 문자열을 이어 붙이지 않고 구조화된 JSON을 사용합니다.

## 이 결과가 보장하는 것과 남는 위험

검사는 이 함수가 선택한 세 필드만 출력하며, 지정한 합성 비밀 값이 결과에 없다는 것을 보여 줍니다. 시스템 전체에서 개인정보를 수집하지 않는다는 증명은 아닙니다. 역방향 프록시 접근 로그, 예외 추적기, APM, 클라우드 감사 로그가 요청을 따로 기록할 수 있습니다. 함수 실행 전에 `print(raw)`가 있으면 이 방어의 효과도 사라집니다.

이메일을 일반 해시로 바꾸는 것만으로 익명성이 보장되지도 않습니다. 후보 이메일을 같은 방식으로 해시해 맞춰 볼 수 있고, 안정적인 식별자는 서로 다른 기록을 연결하게 합니다. 연결이 필요하지 않으면 저장하지 않는 것이 먼저입니다. 연결이 필요한 경우에는 목적, 키 관리, 접근 통제와 보관 기간을 함께 정해야 합니다.

## 운영에 적용하기 전 확인 순서

1. 오류 분석에 실제로 쓰는 질문과 필드를 짝지어 기록합니다.
2. 요청 진입부터 프록시·애플리케이션·수집기·백업까지 복사 경로를 그립니다.
3. 합성 비밀 값을 넣은 테스트 요청으로 모든 출력 위치를 검색합니다. 실제 비밀번호로 시험하지 않습니다.
4. 조회 권한과 보관 기간을 목적에 맞게 정하고, 만료된 데이터가 실제로 사라지는지 확인합니다.
5. 새 필드나 새 수집기를 추가할 때 같은 검사를 반복합니다.

보관 일수를 무조건 30일로 정하는 식의 공통 정답은 없습니다. 필요한 조사 기간과 계약·규제 조건을 확인해야 합니다. 이 글의 코드만으로 GDPR이나 국내 개인정보 관련 법률을 준수한다고 주장할 수 없습니다.

## 참고 자료

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): 제외할 데이터, 로그 인젝션 방어, 접근 통제와 보관 고려 사항.
- [Python json 문서](https://docs.python.org/3/library/json.html): 구조화된 직렬화 동작.

이 실습을 확장할 때는 무작정 필드를 늘리기보다 “이 필드가 없어 답할 수 없는 질문이 무엇인가”부터 추가해 보세요.
