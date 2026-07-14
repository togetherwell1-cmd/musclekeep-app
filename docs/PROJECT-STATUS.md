# 머슬킵 — 완성본 핸드오프 (2026-07-14)

GLP-1(위고비·마운자로) 복용자가 **근육을 지키며 감량**하도록 돕는 솔로+AI 사업. 개발 코어 완성.

## 🔗 라이브 URL
| 자산 | URL | 레포 |
|---|---|---|
| 앱 (PWA) | https://togetherwell1-cmd.github.io/musclekeep-app/ | `togetherwell1-cmd/musclekeep-app` |
| 리드마그넷(자가진단 계산기) | https://togetherwell1-cmd.github.io/glp1-muscle-check/ | `togetherwell1-cmd/glp1-muscle-check` |
| 이용약관 / 개인정보 | …/musclekeep-app/terms.html · privacy.html | |

## ✅ 완성된 것
- **앱 W1~W6**: 온보딩·프로필 → 단백질 목표·근손실 위험도 → 원터치 기록(단백질·체중·운동·부작용) → AI 루틴(뭐먹지·운동, 규칙기반) → 주사일 D-day·알림·.ics 캘린더 → 주간 리포트·차트 → 구독/프리미엄(7일 무료체험, 페이월).
- **리드마그넷**: 30초 자가진단 → 단백질 목표 + 대기자 수집 + `?src=` 유입 추적 + 앱 연결 링크.
- **법률**: 이용약관·개인정보처리방침 초안(설정에 링크).
- **수익 구조**: 구독(월9,900/연79,000) + 쿠팡파트너스 단백질 링크(루틴). 이중 수익.
- **유통 전략**: hyojaitem 틱톡 → 계산기 → 앱 깔때기 (`glp1-muscle-check/docs/distribution-tiktok.md`).

## 🔌 남은 것 = "코드 자리는 준비됨, Teo 계정/결제/서류만 꽂으면 끝"
1. **결제** — 토스페이먼츠 가입 + 사업자등록/통신판매업 신고 → `app.js`의 `activateSub()`/`subPay` 스텁에 연동.
2. **도메인** — musclekeep.app 구매 → GitHub Pages 커스텀 도메인 연결.
3. **쿠팡 딥링크** — `app.js`의 `COUPANG_PRODUCTS`를 실제 파트너스 링크로 교체.
4. **대기자 수집** — Formspree 등 생성 → `glp1-muscle-check/index.html`의 `WAITLIST_ENDPOINT`.
5. **LLM 고도화(선택)** — 서버리스 + API 키 → `aiRecommend()` 훅. (규칙기반으로도 출시 가능)
6. **법률 확정** — 사업자정보 기재 + 전문가 검토. PNG 아이콘(현재 SVG).

## 🎯 가장 중요한 다음 행동 (개발 아님)
**유저 획득**: 네이버 다이어트 카페 1곳 + 스레드 90일(`glp1-muscle-check/docs/community-content.md`) **+ hyojaitem 틱톡 연계**. 첫 100명이 성패를 가름.

## 📁 문서
- `docs/roadmap.md` · `docs/launch-checklist.md` · `docs/PROJECT-STATUS.md`(이 파일)
- `glp1-muscle-check/docs/community-content.md` · `distribution-tiktok.md`
