---
layout: single
title: '제로 트러스트를 접근 결정표로 바꾸기: 사내망이면 허용해도 될까'
date: 2026-03-01
categories: zero-trust security-architecture
tags: zero-trust never-trust-verify security-framework
excerpt: 문서 열람 사례에서 사용자·기기·자원·행위를 분리하고, 누락된 조건을 기본 거부하는 로컬 정책 실험입니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 기존 게시 주소와 최초 게시일은 유지했습니다. 아래 사례와 수치는 교육용 합성 예제이며 실제 침해 사고나 운영 성과가 아닙니다.

사내망에 접속했다는 사실은 어느 문서를 읽을 권한이 있다는 뜻일까요? 네트워크 위치만으로 권한을 부여하면 탈취 계정이나 감염 기기가 내부로 들어온 뒤 과도한 접근을 얻을 수 있습니다. 제로 트러스트를 제품 목록으로 배우기보다 **특정 요청을 허용하는 데 어떤 증거가 필요한지**부터 적어 보겠습니다.

## ‘직원’이 아니라 ‘이 요청’을 검토하기

합성 사례의 자원은 재무팀 보고서 `finance-report` 하나이고, 행위는 `read`입니다. 정책은 인증된 사용자, 재무팀 소속, 관리 기기, 최근 확인된 기기 상태를 모두 요구합니다. 읽기 허용이 다운로드·삭제·공유 허용으로 확대되지는 않습니다. [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final)의 자원 중심 접근과 네트워크 위치만으로 암묵적 신뢰를 부여하지 않는 원칙을 작은 예제로 옮겼습니다.

| 요청 | 인증 | 소속 | 기기 상태 | 판단 |
|---|---|---|---|---|
| 정상 재무팀 열람 | 확인됨 | finance | 최근 확인·관리됨 | 허용 |
| 내부망의 미인증 요청 | 미확인 | finance 주장 | 관리됨 | 거부 |
| 다른 부서 열람 | 확인됨 | sales | 관리됨 | 거부 |
| 오래된 기기 상태 | 확인됨 | finance | 30분 전 | 재확인 전 거부 |

여기서 ‘최근’은 실습에서 정한 300초입니다. Google이나 NIST가 모든 조직에 요구하는 수치가 아닙니다. 조직은 자원의 민감도, 업무 지연, 상태 수집 실패 가능성에 맞춰 결정해야 합니다.

## 정책 함수로 모호한 조건 드러내기

Python 3 코드의 입력은 신뢰할 수 있는 인증·기기 관리 시스템이 전달했다고 **가정한 합성 값**입니다. 실제 서버에서 브라우저가 제출한 `authenticated=true`를 믿어서는 안 됩니다.

```python
def decide(context, resource, action):
    if resource != "finance-report" or action != "read":
        return "deny:unknown_request"
    if context.get("authenticated") is not True:
        return "deny:identity"
    if context.get("department") != "finance":
        return "deny:department"
    age = context.get("posture_age_seconds")
    if context.get("managed") is not True:
        return "deny:device"
    if type(age) is not int or not 0 <= age <= 300:
        return "deny:stale_or_missing_posture"
    return "allow:read"

base = dict(authenticated=True, department="finance", managed=True,
            posture_age_seconds=60)
tests = [base, {**base, "authenticated": False},
         {**base, "department": "sales"},
         {**base, "posture_age_seconds": 1800},
         {**base, "posture_age_seconds": None}]
for case in tests:
    print(decide(case, "finance-report", "read"))
```

```text
allow:read
deny:identity
deny:department
deny:stale_or_missing_posture
deny:stale_or_missing_posture
```

이 실험은 네트워크에 접속하지 않습니다. `age`를 -1, 300, 301로 바꿔 경계값을 확인합니다. 미래의 시각이나 누락값을 무조건 최신이라고 처리하면 상태 확인이 없는 요청까지 통과할 수 있습니다. 알 수 없는 자원·행위도 허용 목록에 없으므로 거부합니다.

## 정책 결정과 실제 차단은 다른 구성요소

함수가 거부를 반환해도 파일 다운로드 경로가 이를 무시하면 보호되지 않습니다. 정책을 평가하는 지점과 결과를 집행하는 지점을 식별하고, 웹 화면·직접 API·내보내기·캐시 경로에서 동일하게 적용되는지 확인해야 합니다. 관리자 예외와 장애 시 우회 경로도 정책의 일부입니다.

실제 도입은 중요한 자원 하나에서 시작할 수 있습니다. 먼저 요청을 차단하지 않는 관찰 단계에서 결정 이유를 기록하고 정상 업무가 왜 거부되는지 분석합니다. 관찰 단계는 보안 통제가 집행된 상태가 아닙니다. 데이터가 충분해지면 제한된 사용자군에 집행하고, 되돌릴 조건과 담당자를 정합니다. 단순히 거부율이 높아졌다는 이유로 성공이라고 평가하지 않습니다.

## 남는 위험과 다음 확인

인증 성공은 사용자의 의도가 선하다는 뜻이 아니며 관리 기기는 감염되지 않았다는 보증도 아닙니다. 장시간 세션에서는 상태 변경과 권한 회수가 반영되는 지연을 측정해야 합니다. 정책 서비스 장애 때 업무를 허용할지 중단할지는 자원별 위험 판단이 필요합니다. 모든 서비스에 같은 예외를 적용하면 가장 민감한 경로까지 열릴 수 있습니다.

배포 전에는 권한 회수 후 재요청, 기기 상태 누락, 직접 객체 ID 변경, 서비스 간 호출을 시험합니다. 서비스 자체의 신원까지 다루는 확장 논의는 [NIST SP 800-207A](https://csrc.nist.gov/pubs/sp/800/207/a/final)를 참고하세요. 객체 단위 접근 검증은 [API 권한 실습]({% post_url 2026-03-11-api-security-protection %})에서 별도로 다룹니다.
