---
layout: single
title: "SHA-256 체크섬만으로 변조를 막을 수 있을까: HMAC 비교 실험"
date: 2026-03-04
categories: cryptography cybersecurity
tags: sha256 hmac integrity python
lang: ko
last_modified_at: 2026-09-23
excerpt: "합성 주문 데이터를 바꿔 보며 SHA-256 체크섬과 HMAC의 신뢰 조건을 비교하는 로컬 실험입니다."
---

파일 옆에 SHA-256 값이 있으면 안심해도 될까요? 답은 **그 값이 어디에서 왔는가**에 달려 있습니다. 다운로드한 파일과 체크섬을 같은 사람이 바꿀 수 있다면 둘은 서로 일치해도 원본이 아닐 수 있습니다. 이 글은 비밀번호 저장이나 암호화 대신, 메시지의 무결성을 검사할 때 필요한 신뢰 조건 하나를 다룹니다.

> 2026-09-23 개정: 기존 개요를 전면 재작성했습니다. 아래 주문·키·변경 상황은 모두 교육용 합성 예제이며 실제 서비스나 침해 사례가 아닙니다.

## 먼저 구분할 두 질문

SHA-256은 입력 바이트로부터 고정 길이 요약을 계산합니다. 믿을 수 있는 원본 요약과 비교하면 파일이 달라졌는지 확인하는 데 쓸 수 있습니다. 하지만 비밀키가 없으므로 누구든 변경한 파일의 새 요약을 계산할 수 있습니다. Python의 [hashlib 문서](https://docs.python.org/3/library/hashlib.html)는 이 계산에 사용하는 표준 라이브러리 API를 설명합니다.

HMAC은 비밀키와 메시지를 함께 사용합니다. 검증자는 자신이 가진 키로 태그를 다시 계산하여 받은 태그와 비교합니다. 따라서 메시지를 바꾸는 사람이 키까지 알지 못한다는 전제가 필요합니다. 양쪽 모두 같은 키를 가지므로, HMAC이 일치한다고 특정 개인의 서명을 입증하는 것은 아닙니다. [Python hmac 문서](https://docs.python.org/3/library/hmac.html)는 외부 태그 비교에 `compare_digest` 사용을 권장합니다.

## 네 가지 경우를 로컬에서 비교하기

Python 3 표준 라이브러리만 사용합니다. 파일을 만들거나 네트워크에 접속하지 않습니다. 다음 내용을 `integrity_demo.py`에 저장해 `python integrity_demo.py`로 실행할 수 있습니다. 고정 키는 결과 재현용이며 공개되었으므로 어떤 실제 보호에도 사용할 수 없습니다.

```python
import hashlib
import hmac

key = b"public-demo-key-not-for-production"
original = b"order=17&amount=1000"
changed = b"order=17&amount=9000"
trusted_hash = hashlib.sha256(original).digest()
trusted_tag = hmac.digest(key, original, "sha256")

print("original_hash:", hashlib.sha256(original).digest() == trusted_hash)
print("changed_hash:", hashlib.sha256(changed).digest() == trusted_hash)
replacement_hash = hashlib.sha256(changed).digest()
print("replaced_pair:", hashlib.sha256(changed).digest() == replacement_hash)
print("changed_hmac:", hmac.compare_digest(
    hmac.digest(key, changed, "sha256"), trusted_tag))
print("original_hmac:", hmac.compare_digest(
    hmac.digest(key, original, "sha256"), trusted_tag))
```

실행 출력은 다음과 같습니다.

```text
original_hash: True
changed_hash: False
replaced_pair: True
changed_hmac: False
original_hmac: True
```

첫째와 둘째 줄에서는 원본 요약을 이미 신뢰하고 있습니다. 셋째 줄에서는 파일뿐 아니라 비교 대상 요약도 새로 만들었습니다. `True`는 두 값의 수학적 일치만 나타내며 출처의 정당성을 보장하지 않습니다. 넷째 줄은 변경한 본문에 원래 태그를 붙였을 때 검증이 실패함을 보여 줍니다. 이 코드에는 키가 보이지만, 비교 상황은 변경자에게 검증 키가 없다고 가정합니다. 그 가정이 깨지면 변경자도 유효한 태그를 만들 수 있습니다.

## 같은 내용처럼 보여도 바이트는 다르다

메시지 끝의 줄바꿈, 공백, 문자 인코딩도 입력입니다. `amount=1000` 뒤에 `\n`을 붙인 메시지는 다른 바이트열입니다. JSON에서는 키 순서나 공백이 달라도 사람이 보기에는 같은 객체일 수 있습니다. 송신자는 원문 바이트에 태그를 붙이고, 수신자는 파싱·재직렬화하기 전 동일한 바이트를 검사하는 방식처럼 명확한 규칙을 정해야 합니다. 임의로 공백을 제거하면 본문 의미를 바꿀 수도 있습니다.

직접 검증하려면 `changed = original`로 바꿔 두 실패가 성공으로 바뀌는지 확인합니다. 다음에는 `changed = original + b"\n"`으로 바꿔 다시 실패하는지 확인합니다. 마지막으로 검증할 때만 다른 키를 사용하면 원본 메시지도 실패해야 합니다. 이 세 검사는 본문 변화와 키 불일치를 구분하도록 돕습니다. 단순히 한 번 성공했다는 것보다 실패 조건을 재현하는 편이 검증기의 동작을 더 분명히 보여 줍니다.

## HMAC을 붙여도 남는 설계 문제

이전의 유효한 메시지와 태그를 그대로 다시 보내면 이 예제는 통과합니다. 재전송을 구분하려면 요청 식별자, 시간, 만료 정책 등을 인증 대상에 포함하고 서버가 사용 이력을 관리해야 합니다. 시간만 포함하고 허용 구간을 검사하지 않으면 재전송 방지가 되지 않습니다. 또한 HMAC은 내용을 숨기지 않습니다. 금액을 보이지 않게 하는 기밀성과 변경을 검출하는 무결성은 별도의 요구사항입니다.

실제 검토에서는 먼저 “원본 해시는 누가 보관하는가”, “키를 가진 구성요소는 무엇인가”, “검증 전에 본문이 변환되는가”를 적어 봅니다. 키를 로그에 남기거나 코드 저장소에 넣으면 알고리즘 선택보다 앞서 신뢰 전제가 무너집니다. 공개 배포 파일처럼 수신자가 비밀키를 공유할 수 없는 상황은 전자서명 등 다른 배포 모델을 검토해야 합니다. 이 실험의 결론은 SHA-256이 약하다는 것이 아니라, 해시 일치와 신뢰할 수 있는 발신자 확인이 서로 다른 검증이라는 점입니다.
