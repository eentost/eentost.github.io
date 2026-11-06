# eentost.github.io SEO 운영 및 검색 색인 가이드

## 코드 적용 범위
- 검색 가능 HTML 페이지별 고유 title, description, canonical, robots=index/follow
- Open Graph / Twitter summary_large_image 및 사이트 대표 이미지
- Schema.org JSON-LD (WebSite, WebPage, CollectionPage, Article, TechArticle, WebApplication, VideoGame)
- robots.txt에서 전체 공개 페이지 크롤링 허용 및 sitemap.xml 위치 고지
- HTML 소스 기반 sitemap 생성·기존 noindex 페이지 제외·최근 Git 커밋 날짜로 lastmod 설정
- GitHub Actions에서 메타데이터·JSON-LD·이미지·캐노니컬 검증 및 사이트맵 자동 갱신

## 콘텐츠를 추가하거나 수정할 때
```sh
python3 scripts/seo_sitemap.py --validate
python3 scripts/seo_sitemap.py --write
python3 scripts/seo_sitemap.py --check
```
수정 파일만 커밋하면 master 푸시 시 GitHub Actions가 검증 및 sitemap.xml 갱신을 진행합니다. 검색엔진은 등록만으로 검색 순위를 보장하지 않습니다.

## Google Search Console (사이트 소유자 작업 필요)
1. https://search.google.com/search-console 접속, URL 접두어 속성으로 https://eentost.github.io/ 등록
2. 표시되는 HTML 파일 또는 메타 태그 방식으로 실제 소유권 인증 (검증 토큰을 임의로 만들거나 비밀정보를 게시하지 않음)
3. Sitemaps 메뉴에서 sitemap.xml 제출
4. URL 검사에서 메인/설치 가이드/게임/계산기 등 개별 페이지의 색인 현황 확인
5. 페이지 색인, 실적(검색어·노출·클릭·CTR·순위), Core Web Vitals 보고서 모니터링
6. 과거 URL 삭제가 필요한 경우 Google Search Console 삭제 도구 또는 실제 삭제+404/410/noindex 정책으로 처리; 단순 사이트맵 제거는 색인 삭제가 아님

## 네이버 서치어드바이저 (사이트 소유자 작업 필요)
1. https://searchadvisor.naver.com 로그인 후 https://eentost.github.io 등록
2. 사이트 소유 확인에 발급된 태그/파일을 적용
3. 사이트맵 https://eentost.github.io/sitemap.xml 제출
4. 수집/색인/진단 및 검색 노출 상태를 확인
5. 과거 색인된 페이지 정리는 네이버의 검색 제외 요청/삭제·404·noindex 정책을 상황에 맞게 적용

## 실제 유입·성능 검증
- Search Console과 네이버 서치어드바이저의 실측 색인 수 및 유입 통계는 계정 권한이 있어야만 확인 가능
- Lighthouse/PageSpeed Insights(https://pagespeed.web.dev/)로 모바일/데스크톱 Core Web Vitals를 별도로 측정
- GA4 방문 분석은 assets/analytics-config.js에 실제 측정 ID가 설정되고 사용자 동의를 얻은 경우에만 수집됨
- 배포 직후 검색결과 노출/상위 순위는 자동 보장되지 않음
- 사이트맵 페이지 수: 40 (404 제외, 각 경로별 고유 URL)
