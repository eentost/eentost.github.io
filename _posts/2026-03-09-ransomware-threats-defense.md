---
layout: single
title: '백업 성공 표시와 복구 가능성은 다르다: 안전한 복원 점검 설계'
date: 2026-03-09
categories: cybersecurity ransomware threat-intelligence
tags: ransomware encryption defense incident-response
excerpt: 악성코드 없이 메모리상의 합성 백업을 비교하고, 누락·변경·불필요한 파일 및 RPO·RTO 판단을 분리합니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 기존 게시 주소와 최초 게시일은 유지했습니다. 사례·수치는 교육용 합성 데이터이며 실제 운영 환경의 측정 결과가 아닙니다.

백업 작업이 성공했다는 화면을 보고 복구 준비가 끝났다고 판단하기 쉽습니다. 그러나 백업 파일을 읽을 권한이나 암호화 키가 없거나, 중요한 설정 파일이 빠져 있으면 서비스는 돌아오지 않습니다. 이 글은 랜섬웨어 실행이나 복호화 도구가 아니라 **백업에서 복구할 수 있다는 주장을 어떻게 시험할지**를 다룹니다.

## 복원 시험의 합격 조건을 먼저 적기

합성 서비스의 필수 자료는 `orders.csv`, `config.json`, `schema.sql` 세 개입니다. 복원된 파일이 존재하는지만 확인하면 내용 손상은 놓칩니다. 반대로 해시만 맞춰도 데이터베이스 관계나 애플리케이션 기동은 확인되지 않습니다. 파일 수준 검증과 서비스 수준 검증을 나누어야 합니다. [CISA의 StopRansomware 안내](https://www.cisa.gov/stopransomware/ransomware-guide)는 백업 보호와 복구 계획을 포함한 대응을 설명합니다.

## 파일을 건드리지 않는 비교 실습

Python 3으로 아래 코드를 실행합니다. 사전 두 개가 원본과 복원 결과를 대신하며 디스크 쓰기·삭제·암호화는 하지 않습니다. 저장된 ‘원본 해시’는 신뢰할 수 있는 시점에 확보했다고 가정합니다.

```python
import hashlib

expected = {
    "orders.csv": b"id,total\n1,100\n",
    "config.json": b'{"mode":"test"}',
    "schema.sql": b"CREATE TABLE orders(id INTEGER);",
}
restored = {
    "orders.csv": b"id,total\n1,999\n",
    "config.json": b'{"mode":"test"}',
    "debug.txt": b"temporary",
}
hash_of = lambda data: hashlib.sha256(data).hexdigest()
missing = sorted(expected.keys() - restored.keys())
extra = sorted(restored.keys() - expected.keys())
changed = sorted(name for name in expected.keys() & restored.keys()
                 if hash_of(expected[name]) != hash_of(restored[name]))
print("missing:", missing)
print("changed:", changed)
print("extra:", extra)
print("file_check_passed:", not (missing or changed or extra))
```

```text
missing: ['schema.sql']
changed: ['orders.csv']
extra: ['debug.txt']
file_check_passed: False
```

위 결과에는 서로 다른 세 가지 문제가 있습니다. 누락된 스키마는 기동 실패로 이어질 수 있고, 주문 금액 변화는 기동에 성공해도 업무 결과를 틀리게 만들 수 있습니다. 추가 파일은 자동 생성된 정상 파일일 수도 있습니다. 따라서 운영에서는 완전 일치가 필요한 자료와 허용할 생성 파일을 사전에 구분해야 합니다. 실패가 나온 뒤 합격 기준을 바꿔 통과시키지 않습니다.

## RPO와 RTO를 혼동하지 않기

예를 들어 마지막 사용 가능한 복원 시점이 09:00이고 장애 시각이 09:40이면 그 복원 지점을 선택할 때 위험에 놓인 데이터 구간은 40분입니다. 서비스 복구 목표가 2시간이고 실제 검증된 복구 완료가 장애 후 150분이면 목표를 30분 넘었습니다. 백업 복사 자체가 10분 만에 끝났다고 서비스 RTO를 달성한 것은 아닙니다. 계정 복구, 키 확보, 의존 서비스 기동과 업무 검증까지 포함한 범위를 먼저 정해야 합니다.

이 숫자는 합성 시나리오입니다. 실제 손실량은 트랜잭션 로그나 별도 복구 경로에 따라 달라집니다. 시간 목표와 허용 가능한 데이터 손실을 업무 담당자와 정리하는 참고 자료로 [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)을 사용할 수 있습니다. 조직의 모든 시스템에 같은 목표 시간을 복사하지 않습니다.

## 복구 훈련에서 함께 확인할 항목

첫 단계는 운영과 분리된 복원 환경에 필요한 접근 수단을 준비하는 것입니다. 사고로 평소 관리자 계정을 쓸 수 없어도 백업과 복구 문서에 접근 가능한지 확인합니다. 그 다음 필요한 복원 지점을 골라 파일 검증, 데이터베이스 일관성, 대표 업무 요청 순으로 시험합니다. 민감한 운영 자료를 훈련 환경에 복제할 때는 해당 환경의 접근 통제와 보존 정책도 따라야 합니다.

백업 파일이 공격자에게 수정되지 않도록 분리된 자격 증명과 적절한 보호 방식을 검토합니다. 다만 특정 저장 옵션 하나가 모든 관리 실수를 막는 것은 아닙니다. 보존 기간, 삭제 권한, 복구 키와 비용까지 포함해 실제 복원 시험으로 확인합니다. 원인 제거 전에 감염된 운영 환경으로 되돌리는 것은 재발 위험을 남깁니다.

## 작은 실험에서 확대할 수 없는 결론

`restored = dict(expected)`로 바꾸면 파일 검사는 통과해야 합니다. 그러나 이는 같은 바이트를 복사했다는 사실만 확인합니다. 권한, 심볼릭 링크, 파일 시각, 외부 서비스, 비밀키, 응용 프로그램 버전은 이 사전에 없습니다. 실제 훈련 보고서에는 이 항목별 확인 여부와 남은 위험을 따로 적습니다. 복구를 ‘성공’이라고 부를 때에는 무엇이 복구됐고 무엇은 시험하지 않았는지를 함께 공개해야 다음 훈련이 개선됩니다.
