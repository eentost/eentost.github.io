---
layout: single
title: SQL 매개변수화와 소유권 검사는 서로 다른 문제를 해결한다
categories: cybersecurity development secure-coding
tags: secure-coding practices input-validation error-handling authentication
excerpt: 메모리 SQLite에서 따옴표가 든 이름을 안전하게 검색하고, 사용자별 조회 조건까지 검증하는 작은 회귀 테스트를 만듭니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 최초 게시일과 주소를 유지했습니다. 모든 입력은 교육용 합성 데이터입니다.

SQL 인젝션을 막았는데도 다른 사람의 문서가 보일 수 있습니다. 매개변수화는 입력이 SQL 명령으로 해석되는 것을 막는 데 쓰입니다. “이 사용자가 이 행을 읽어도 되는가”는 별도의 인가 문제입니다. 두 경계를 같은 예제로 확인하면 코드 리뷰에서 놓치기 쉽던 조건을 드러낼 수 있습니다.

## 실습의 데이터와 신뢰 경계

이 예제는 Python 3의 `sqlite3`와 메모리 데이터베이스를 사용합니다. 파일을 만들거나 외부 데이터베이스에 연결하지 않습니다. 사용자 `alice`와 `bob`, 문서 세 개는 모두 합성 데이터입니다. `actor`는 인증을 마친 서버 세션에서 가져왔다고 가정합니다. URL 쿼리에서 사용자가 보낸 `actor=alice`를 그대로 사용하면 소유권 조건이 있어도 안전하지 않습니다.

| 값 | 출처와 처리 |
|---|---|
| actor | 검증된 서버 인증 문맥 |
| title | 사용자 검색 입력, SQL 매개변수로 전달 |
| 테이블·열 이름 | 코드에서 고정 |
| owner 조건 | 조회 쿼리 안에 포함 |

## 두 조건을 함께 검증하는 코드

```python
import sqlite3

db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, owner TEXT, title TEXT)")
db.executemany("INSERT INTO notes VALUES (?, ?, ?)", [
    (1, "alice", "O'Reilly memo"),
    (2, "bob", "private note"),
    (3, "alice", "public checklist"),
])

def find_notes(actor, title):
    if actor not in {"alice", "bob"}:
        raise PermissionError("authenticated actor required")
    return db.execute(
        "SELECT id, title FROM notes WHERE owner = ? AND title = ? ORDER BY id",
        (actor, title),
    ).fetchall()

assert find_notes("alice", "O'Reilly memo") == [(1, "O'Reilly memo")]
assert find_notes("alice", "private note") == []
assert find_notes("bob", "private note") == [(2, "private note")]
assert find_notes("alice", "' OR '1'='1") == []
try:
    find_notes(None, "public checklist")
except PermissionError:
    pass
else:
    raise AssertionError("anonymous request accepted")
assert db.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 3
db.close()
print("6 query, authorization and integrity checks passed")
```

기대 출력:

```text
6 query, authorization and integrity checks passed
```

`O'Reilly memo`는 따옴표가 들어간 정상 입력입니다. 특수문자를 전부 지우는 방식은 이 값을 손상시킵니다. 매개변수화한 쿼리에서는 따옴표를 문자열 데이터로 전달할 수 있습니다. 네 번째 검사의 SQL처럼 보이는 입력도 제목과 비교할 값 하나로 처리됩니다. 존재하지 않는 제목이므로 빈 목록이 나옵니다. 이 검사는 외부 시스템에 공격 요청을 보내지 않습니다.

## 검사가 하나씩 지키는 경계

첫 번째 검사는 정상 입력을 불필요하게 거부하지 않는지 확인합니다. 두 번째와 세 번째를 함께 봐야 소유권 조건의 의미가 드러납니다. 문서는 존재하지만 `alice`에게는 보이지 않고 소유자 `bob`에게는 보입니다. 네 번째 검사는 입력을 쿼리 문법과 분리합니다. 다섯 번째는 인증 문맥 누락 시 실패하도록 합니다. 마지막은 조회 실험 이후 행의 수가 바뀌지 않았는지 확인합니다.

여기서 `WHERE owner = ?`를 제거하면 매개변수화는 그대로인데 두 번째 검사가 실패합니다. 반대로 제목을 f-string으로 이어 붙이면 소유권 조건의 모양이 있어도 쿼리 경계가 깨질 수 있습니다. 코드 리뷰에서는 “안전한 DB API를 썼는가”와 “대상 행의 권한을 검사했는가”를 각각 질문해야 합니다.

## 이 코드를 그대로 서비스로 쓰면 부족한 부분

`actor` 허용 목록은 두 테스트 계정만 있는 실습 장치입니다. 실제 서비스의 인증이나 세션 검증을 대체하지 않습니다. 또한 단순 소유 모델에는 팀 공유, 관리자 역할, 삭제된 계정, 조직 간 격리 같은 규칙이 없습니다. 그런 정책을 추가할 때는 허용 사례뿐 아니라 거부 사례도 먼저 기록해야 합니다.

매개변수 자리에 테이블 이름이나 `ORDER BY` 열 이름을 넣어 식별자를 선택하려 해서는 안 됩니다. 동적 정렬이 필요하면 `{"title": "title", "id": "id"}`처럼 코드가 정한 열 이름 중에서 고릅니다. 이 예제는 정렬을 `id`로 고정하여 그 문제를 만들지 않습니다. 데이터베이스별 드라이버는 매개변수 표기법이 다를 수 있으므로 `?`를 모든 제품에 그대로 복사하지 않습니다.

이 실험은 동시성, 트랜잭션 롤백, 연결 풀, 속도 제한 또는 대규모 쿼리 비용을 검증하지 않습니다. 운영 환경에서는 데이터베이스 계정 권한도 필요한 테이블과 작업으로 제한하고, 예외를 응답할 때 쿼리나 비밀 값을 노출하지 않도록 별도로 확인해야 합니다.

## 코드 리뷰에 사용할 짧은 절차

1. 사용자 입력이 SQL 문자열에 직접 이어지는 지점을 찾습니다.
2. 값은 드라이버의 매개변수 API로 옮기고 식별자는 고정하거나 허용 목록으로 제한합니다.
3. 인증된 사용자와 대상 행을 연결하는 조건을 확인합니다.
4. 정상 따옴표 입력, 다른 소유자, 미인증 요청의 회귀 검사를 함께 실행합니다.
5. 프레임워크나 드라이버를 바꿀 때 같은 결과를 다시 확인합니다.

## 참고 자료

- [Python sqlite3: SQL placeholders](https://docs.python.org/3/library/sqlite3.html#how-to-use-placeholders-to-bind-values-in-sql-queries): 문자열 조합 대신 값 바인딩을 사용하는 방법.
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html): 매개변수화, 허용 목록과 최소 권한.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): 요청마다 인가를 검사하는 원칙.
