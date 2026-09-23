---
layout: single
title: '로그인했는데 다른 사람의 주문이 보인다: 객체 단위 권한 검사 실습'
categories: cybersecurity api-security
tags: api-security oauth authentication rest-api web-services
excerpt: 합성 주문 조회 함수를 통해 인증·객체 소유권·응답 필드 제한을 분리하고 정상·비정상 접근을 검증합니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 기존 주소와 최초 게시일은 유지했습니다. 아래 데이터와 계정은 교육용 합성 예제이며 실제 서비스나 침해 사고를 나타내지 않습니다.

토큰이 유효하다는 확인만으로 주문 조회 API가 안전해지지는 않습니다. 로그인한 사용자 A가 주문 번호를 B의 번호로 바꿨을 때 B의 주문을 읽을 수 있다면 객체 단위 권한 검사가 빠진 것입니다. 이 글은 **인증 성공과 특정 자료에 대한 접근 허용이 다른 결정**임을 로컬 코드로 확인합니다. 외부 API에 요청하지 않습니다.

## 무엇을 신뢰할지 먼저 정하기

실습에서는 `actor_id`가 서버의 검증된 인증 처리에서 나왔다고 가정합니다. 쿼리 문자열의 `user_id`나 요청 본문의 `owner`를 그대로 넣으면 안 됩니다. 주문 소유자도 클라이언트가 보낸 값이 아니라 서버 저장소에서 읽어야 합니다. [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)은 객체 식별자를 다루는 API에서 이런 권한 검사를 다룹니다.

예제 정책은 ‘일반 사용자는 자신의 주문만 읽는다’입니다. 관리자 예외, 조직 간 공유, 대리 구매는 없습니다. 실제 요구사항이 있다면 별도 정책으로 추가하고 테스트해야지 `admin`이라는 문자열 하나를 클라이언트가 보낼 수 있게 만들어서는 안 됩니다.

## 서버 정책과 응답 필드를 함께 제한하기

Python 3 표준 라이브러리만 사용합니다. 사전은 합성 데이터베이스이며 실제 개인 정보가 아닙니다. 미존재 주문과 권한 없는 주문에 동일한 `not_found` 결과를 주는 것은 존재 여부를 구분해 노출하지 않기 위한 이 예제의 정책 선택입니다.

```python
orders = {
    "o-101": {"owner": "u-a", "total": 1200, "internal_note": "demo A"},
    "o-102": {"owner": "u-b", "total": 3400, "internal_note": "demo B"},
}

def read_order(actor_id, order_id):
    if actor_id is None:
        return {"error": "unauthenticated"}
    order = orders.get(order_id)
    if order is None or order["owner"] != actor_id:
        return {"error": "not_found"}
    return {"id": order_id, "total": order["total"]}

assert read_order("u-a", "o-101") == {"id": "o-101", "total": 1200}
assert read_order("u-a", "o-102") == {"error": "not_found"}
assert read_order("u-a", "missing") == {"error": "not_found"}
assert read_order(None, "o-101") == {"error": "unauthenticated"}
assert "internal_note" not in read_order("u-a", "o-101")
print("5 authorization and response checks passed")
```

```text
5 authorization and response checks passed
```

이 검사는 본인 주문 읽기뿐 아니라 다른 사람·없는 주문·미인증·내부 필드 제외까지 확인합니다. 성공 응답에 원본 객체를 통째로 반환하지 않고 허용한 필드만 새로 구성한 것도 의도적입니다. 권한은 맞아도 내부 메모나 다른 고객 식별자가 응답에 섞이면 별개의 노출 문제가 됩니다.

## UI에서 숨기는 것으로 끝내지 않기

버튼을 숨기거나 주문 번호를 추측하기 어려운 UUID로 바꾸는 것은 서버의 권한 검사를 대체하지 않습니다. 모바일·내보내기·일괄 조회 API도 같은 정책을 적용해야 합니다. 단건 조회가 안전해도 `/orders?ids=...` 같은 묶음 요청이 소유자를 필터링하지 않으면 우회 경로가 됩니다.

데이터베이스에서는 현재 사용자와 객체 ID를 함께 조건으로 조회하는 방법을 검토할 수 있습니다. 조회 후 검증하더라도 실제 사용 시점에 소유권이 바뀌는 경쟁 조건이 있는지 살펴봅니다. 캐시 키에 사용자나 테넌트 범위를 빼면 다른 사용자의 허용된 응답을 재사용할 수 있습니다. 따라서 권한 함수만 시험하고 캐시·저장 계층을 제외하면 실제 서비스 검증이 아닙니다.

## JWT를 쓰면 추가로 확인할 것

JWT라는 형식을 사용했다는 사실만으로 인증이 검증되지는 않습니다. 서명·허용 알고리즘·발급자·대상·만료 등 서비스가 요구하는 조건을 검증해야 하고, 유효 토큰이어도 객체 권한은 다시 확인해야 합니다. 일반적인 서명 토큰은 본문을 숨기는 암호화와 같지 않습니다. 구현 세부는 [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)를 기준으로 검토하고 직접 암호 검증기를 만들지 않습니다.

## 실서비스 테스트로 확장할 때

허가된 테스트 환경에서 서로 다른 두 계정을 만들고 같은 경로를 각 계정으로 호출합니다. 목록·단건·수정·삭제·내보내기에 대해 ‘누가 어떤 자료에 어떤 행위를 하는가’를 표로 작성합니다. 거부 응답에 주문 금액이나 소유자 힌트가 없는지도 확인합니다. 접근 거부 로그에는 요청 ID와 정책 이유를 남기되 토큰이나 전체 응답 본문을 기록하지 않습니다.

이 로컬 함수는 HTTP 상태 코드, 인증서, 세션 만료, 속도 제한, 멀티테넌트 DB를 구현하지 않습니다. 따라서 다섯 검사 통과는 이 작은 정책의 증거일 뿐 API 전체의 안전성 인증이 아닙니다. 정책 설계의 추가 기준은 [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)에서 확인할 수 있습니다.
