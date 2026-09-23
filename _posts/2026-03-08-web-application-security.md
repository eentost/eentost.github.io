---
layout: single
title: HTML 이스케이프 하나로 모든 XSS를 막을 수 없는 이유
date: 2026-03-08
categories: cybersecurity web-security
tags: owasp sql-injection xss csrf
excerpt: 같은 사용자 입력이 HTML 본문·속성·URL에 들어갈 때 필요한 처리를 구분하고, 문자열 실험으로 확인합니다.
lang: ko
last_modified_at: '2026-09-23'
---

> 2026-09-23 전면 개정. 기존 주소와 최초 게시일은 유지했습니다. 아래 데이터와 계정은 교육용 합성 예제이며 실제 서비스나 침해 사고를 나타내지 않습니다.

입력에서 `<`를 지우면 XSS 방어가 끝날까요? 사용자 값이 들어가는 위치에 따라 브라우저의 해석 방식이 달라집니다. 평문으로 보여 줄 이름, 링크의 URL, JavaScript 안의 문자열은 같은 규칙으로 처리할 수 없습니다. 이 글은 공격 코드를 실행하는 대신 **정상 텍스트가 마크업으로 해석되지 않게 만드는 경계**를 살펴봅니다.

## 입력 검증과 출력 인코딩의 역할

입력 검증은 서비스가 허용할 값의 범위를 확인합니다. 출력 인코딩은 허용된 값을 특정 문법 안에 안전한 데이터로 넣는 처리입니다. 예를 들어 이름에 `&`가 들어가는 것은 정상일 수 있습니다. 이를 무조건 거부하는 대신 HTML에 출력할 때 `&amp;`로 표현합니다. 반대로 허용하지 않는 URL 스킴은 HTML 이스케이프를 해도 허용되는 값으로 바뀌지 않습니다.

[OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)는 출력 문맥별 방어를 구분합니다. 아래 실습은 HTML 텍스트와 따옴표로 감싼 일반 속성에 한정됩니다. 이벤트 핸들러, JavaScript, CSS 문맥의 인코더로 복사해 사용해서는 안 됩니다.

## 문자열만으로 비교하는 로컬 실험

Python 3 표준 라이브러리의 `html.escape`를 사용합니다. 브라우저를 열거나 HTML을 실행하지 않고 문자열만 출력합니다. 입력의 `<b>`는 평문으로 보여 주려는 합성 내용입니다.

```python
from html import escape
from urllib.parse import urlsplit

value = '<b>sample & "quote"</b>'
print("text:", escape(value, quote=False))
print("attribute:", escape(value, quote=True))

def link_for(raw_url):
    parsed = urlsplit(raw_url)
    if parsed.scheme != "https" or parsed.hostname != "example.org":
        return "rejected"
    if parsed.username is not None or parsed.password is not None:
        return "rejected"
    if parsed.port not in (None, 443):
        return "rejected"
    return '<a href="' + escape(raw_url, quote=True) + '">reference</a>'

print(link_for('https://example.org/?q=notes&lang=ko'))
print(link_for('http://example.org/'))
```

```text
text: &lt;b&gt;sample &amp; "quote"&lt;/b&gt;
attribute: &lt;b&gt;sample &amp; &quot;quote&quot;&lt;/b&gt;
<a href="https://example.org/?q=notes&amp;lang=ko">reference</a>
rejected
```

URL은 먼저 이 예제의 목적지 정책인 HTTPS·단일 호스트·기본 포트를 검사하고, 그 뒤 따옴표 속성에 맞게 인코딩합니다. `example.org`는 문서용 도메인이며 실제 요청을 보내지 않습니다. 파서 자체를 범용 URL 검증기로 믿어서는 안 됩니다. 잘못된 포트처럼 `ValueError`가 날 수 있는 입력은 애플리케이션 경계에서 오류로 처리해야 합니다. [Python urllib.parse 문서](https://docs.python.org/3/library/urllib.parse.html#url-parsing-security)도 파싱과 검증을 구분합니다.

## 어디에 넣는지 알아야 방어를 고를 수 있다

| 출력 위치 | 우선 선택 | 피해야 할 오해 |
|---|---|---|
| 일반 텍스트 노드 | 프레임워크 자동 이스케이프 또는 `textContent` | HTML 태그를 허용해도 된다는 뜻 아님 |
| 따옴표로 감싼 일반 속성 | 속성에 맞는 인코딩 | 속성 이름까지 사용자에게 맡기지 않기 |
| `href`·`src` URL | 목적지 정책 검증 후 속성 인코딩 | 이스케이프가 위험한 스킴을 차단하지 않음 |
| JavaScript 코드 내부 | 사용자 값을 코드에 직접 섞지 않는 구조 | HTML 이스케이프를 JS 인코더로 쓰지 않기 |
| 사용자가 작성한 서식 HTML | 검증된 정화 라이브러리와 허용 정책 | 정규식으로 태그 몇 개만 지우면 충분하지 않음 |

‘입력할 때 한 번 이스케이프해 저장’하는 방식은 같은 데이터를 다른 문맥에 쓰기 어렵게 만들고 이중 이스케이프 문제도 만듭니다. 가능한 한 원래 의미의 데이터를 저장하고 출력 경계에서 문맥에 맞게 처리합니다. 어떤 값이 이미 정화된 HTML인지도 타입이나 인터페이스로 구분하면 실수를 줄일 수 있습니다.

## 실제 페이지에서 검증할 항목

이 실험의 출력을 브라우저에 적용하는 제품에서는 문자 표시와 DOM 구조를 각각 확인해야 합니다. `<b>`가 굵은 글씨가 아니라 글자 그대로 보이는지, 속성이 새로 만들어지지 않는지 확인합니다. 자동 이스케이프를 끄는 템플릿 기능, `innerHTML`, HTML을 직접 반환하는 Markdown 설정이 있다면 별도로 검토합니다. 일부 안전한 값으로 한 번 통과한 것은 모든 입력의 안전성 증명이 아닙니다.

[MDN textContent 문서](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)는 텍스트를 다루는 DOM API의 동작을 설명합니다. CSP는 추가 방어로 검토할 수 있지만 잘못된 출력 처리를 대체하지 않습니다. 이 글의 결론은 특정 문자열 필터의 추천이 아니라, 데이터를 해석하는 다음 문법을 확인하고 그 경계에서 처리하자는 것입니다.
