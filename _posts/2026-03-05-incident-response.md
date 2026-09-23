---
layout: single
title: "서로 다른 시간대의 사고 로그를 UTC 타임라인으로 재구성하기"
date: 2026-03-05
categories: incident-response cybersecurity
tags: incident-handling timeline utc evidence
lang: ko
last_modified_at: 2026-09-23
excerpt: "합성 로그 네 건을 UTC로 정렬하고, 시계 오차와 수집 지연 때문에 단정할 수 없는 내용을 분리합니다."
---

사고 기록을 시간순으로 정렬했는데 다운로드가 로그인보다 먼저 나타난다면, 곧바로 인증 우회라고 결론 내릴 수 있을까요? 먼저 시간대, 장비 시계, 수집 시각을 확인해야 합니다. 이 글의 목표는 로그를 많이 모으는 것이 아니라 **관찰된 순서와 입증된 인과관계를 구분하는 작은 타임라인**을 만드는 것입니다.

> 2026-09-23 개정: 기존 일반론을 전면 재작성했습니다. 아래 계정·사건·시간은 합성 데이터입니다. 실제 사고 분석이나 현장 경험을 주장하지 않습니다.

## 원본 시각과 정규화 시각을 함께 보관하기

분석용 표에는 이벤트 ID, 출처, 원본 시각, UTC 시각, 사건 종류를 둡니다. 원본을 UTC 값으로 덮어쓰면 파싱이 잘못됐을 때 되돌아가기 어렵습니다. 시간대가 없는 `09:01`은 한국 시각인지 UTC인지 알 수 없으므로 임의로 추정하지 않고 미확정 항목으로 분리해야 합니다.

[NIST SP 800-86](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-86.pdf)은 사고 대응에 포렌식 기법을 통합하는 지침입니다. 이 예제에서는 원본을 보존하고 변환 과정을 설명하는 접근을 채택합니다. 시간순 정렬 자체가 법적 증거능력이나 수집 과정의 적법성을 보장하지는 않습니다.

## 실행 가능한 네 건의 예제

Python 3 표준 라이브러리만 사용하며 모든 처리는 메모리에서 끝납니다. `timeline.py`로 저장해 실행합니다. 같은 계정 이름이 보였다는 가상의 상황이지만, 이를 실제 동일 사용자라고 확정하지는 않습니다.

```python
from datetime import datetime, timezone

rows = [
    ("A", "identity", "2026-09-01T09:00:10+09:00", "login_ok"),
    ("B", "application", "2026-09-01T00:00:45+00:00", "export_requested"),
    ("C", "proxy", "2026-08-31T20:01:00-04:00", "download_response"),
    ("D", "collector", "2026-09-01T00:03:00+00:00", "alert_received"),
]
normalized = []
for event_id, source, raw, event in rows:
    parsed = datetime.fromisoformat(raw)
    if parsed.utcoffset() is None:
        raise ValueError("timezone missing: " + event_id)
    normalized.append((parsed.astimezone(timezone.utc), event_id, source, event))
for timestamp, event_id, source, event in sorted(normalized):
    print(event_id, timestamp.isoformat(), source, event)
print("A_to_C_seconds:", int((normalized[2][0] - normalized[0][0]).total_seconds()))
```

실행 결과:

```text
A 2026-09-01T00:00:10+00:00 identity login_ok
B 2026-09-01T00:00:45+00:00 application export_requested
C 2026-09-01T00:01:00+00:00 proxy download_response
D 2026-09-01T00:03:00+00:00 collector alert_received
A_to_C_seconds: 50
```

원본 날짜만 보면 C는 전날 사건처럼 보이지만 UTC에서는 A보다 50초 뒤입니다. [Python datetime 문서](https://docs.python.org/3/library/datetime.html)의 시간대 인식 객체와 `astimezone` 변환을 사용한 이유입니다. 시간대 정보를 단순히 교체하는 방식은 같은 순간을 다른 시간대로 변환하는 것과 다릅니다.

## 이 표에서 말할 수 있는 것과 없는 것

A는 인증 시스템이 성공 이벤트를 기록했다는 사실입니다. 정상 사용자가 직접 로그인했다는 증거는 아닙니다. B는 내보내기 요청 기록이고 C는 프록시의 응답 기록입니다. 응답 코드와 바이트 수가 없으므로 파일 전체가 전달됐다고 단정할 수 없습니다. D는 수집기의 경보 수신 시각입니다. 공격 시작 시각으로 쓰면 탐지 시간을 잘못 계산하게 됩니다.

A와 C가 50초 떨어졌다는 계산도 두 장비 시계가 정확하다는 조건부 결과입니다. 가령 각 시계의 오차 범위를 독립적으로 ±40초라고 확인했다면 실제 간격은 -30초부터 130초까지 가능하며 순서가 뒤집힐 수 있습니다. 반대로 ±2초라면 46~54초가 되어 순서는 유지됩니다. 이 오차는 예시 가정이며 실제 로그에서 자동으로 얻어지는 값이 아닙니다. 동기화 상태나 신뢰할 수 있는 공통 이벤트와의 비교 자료가 필요합니다.

## 검증 절차와 다음 수집 항목

우선 A의 `+09:00`을 제거한 복사본으로 코드를 실행해 `timezone missing: A` 오류가 나는지 확인합니다. 미확정 시각을 조용히 섞지 않는 검증입니다. 이어 입력 행 순서를 뒤집어도 출력 순서가 같은지 확인합니다. 동일 시각이 여럿이면 현재 코드는 ID 순서로 표시할 수 있지만, 그 순서는 사건의 선후관계를 뜻하지 않습니다.

조사 메모에는 “A 이후 C 관측, 시계 정확도 미검증”처럼 증거와 조건을 함께 적습니다. 다음 자료는 세션 ID, 요청 ID, 응답 상태, 전송 바이트 수, 서버의 작업 완료 기록입니다. IP 주소만 같다고 연결하지 않습니다. 프록시나 공유 출구 때문에 여러 사용자가 한 주소로 보일 수 있기 때문입니다. 수집 지연을 계산하려면 각 이벤트의 발생 시각과 수신 시각이 모두 있어야 합니다. D 하나로 A·B·C 각각의 지연을 계산할 수 없습니다.

## 대응 결정으로 이어지는 기록

타임라인의 목적은 보기 좋은 정렬이 아니라 다음 조치를 설명하는 것입니다. 계정 세션 중지 여부를 판단할 담당자, 추가 수집 항목, 판단 시점, 아직 미확인인 가설을 같은 사건 기록에 남깁니다. 원본 로그, 수집 도구·시간, 파일 해시, 접근 기록은 별도로 보존하고 분석용 복사본에서 작업합니다. 해시는 수집 이후 바이트 동일성 확인에 도움이 되지만 수집 전 내용이 사실이었다는 보증은 아닙니다.

현재 사고 대응의 상위 지침인 [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)은 대응을 위험관리 활동과 연결합니다. 이 글의 네 건만으로 침해 여부를 확정할 수는 없습니다. 대신 시간 변환 오류를 제거하고, 근거 없는 인과 추정을 줄이며, 어떤 자료를 더 확보해야 결론이 달라지는지 명확하게 만드는 데 사용할 수 있습니다.
