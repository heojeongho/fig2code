---
name: fig2code
description: 피그마 디자인을 1px 수준으로 일치하는 반응형 HTML/CSS로 퍼블리싱하고, 스크린샷 분면 비교 루프(랄프루프)로 재검증한다. 사용자가 피그마 URL을 주며 "퍼블리싱해줘", "픽셀 퍼펙트로 구현", "디자인시안과 똑같이", "랄프루프 돌려줘" 등을 요청할 때 사용. PC/모바일 프레임 기반 분기형 반응형과 아코디언·캐러셀 등 인터랙션 구현을 포함한다.
---

# Figma → Pixel-Perfect 반응형 퍼블리싱 + 검증 루프

피그마 프레임(PC/모바일)을 정적 HTML/CSS/JS로 퍼블리싱하고, 원본 렌더 이미지와
분면(quadrant) 픽셀 비교를 반복하며 시안과 일치할 때까지 수렴시키는 워크플로우.

전제: Figma MCP 서버 연결, node + playwright-core(캐시된 chromium과 버전 일치), python3 + PIL/numpy.
이 스킬 폴더의 `scripts/`에 검증 도구 템플릿이 있다 — 프로젝트에 복사해 경로만 고쳐 쓴다.

## 0. 원칙

- **텍스트·카드·버튼은 실제 HTML/CSS**로, **일러스트·사진·손글씨·로고는 에셋**으로. 판단 기준: 벡터 노드가 수십 개 뭉친 장식이면 통째로 SVG 추출.
- 목표 수치: 디자인 기준 해상도에서 **요소 bbox 오차 ≤2px**, 가우시안 블러(2px) 후 diff>25 픽셀 비율 **≤1%대** (잔여분은 Figma↔브라우저 폰트 래스터라이징 차이로 제거 불가 — 이를 사용자에게 명시).
- 모든 수치는 눈대중이 아니라 **픽셀 실측**으로 판단한다 (compare.py / PIL bbox 측정).

## 1. 구조 파악

1. `get_metadata`로 대상 페이지의 최상위 프레임(PC/모바일)과 크기 확인.
2. PC 프레임의 섹션(직계 자식 프레임) 목록과 y-오프셋을 뽑아 섹션 단위로 작업 계획을 세운다.
3. `get_screenshot`(maxDimension=프레임 높이)으로 **PC/모바일 풀샷을 원본 해상도로 저장** → `shots/figma/` (이후 모든 비교의 기준).

## 2. 섹션별 컨텍스트 수집

- 섹션마다 `get_design_context` 호출 (`excludeScreenshot: true`로 토큰 절약).
- 응답이 너무 커서 sparse metadata만 오면: 벡터 뭉치(장식)는 에셋으로 빼고, 텍스트/버튼 등 작은 서브노드만 개별 호출.
- 반환된 React+Tailwind는 **좌표·폰트·색상 소스**로만 쓴다 (grid ml/mt 값 + 섹션 원점으로 절대좌표 계산).
- 텍스트 노드의 정확한 x/y/w/h는 metadata XML에서 재확인한다.

## 3. 에셋 추출 — 함정 주의 (중요)

- 장식 벡터 그룹: `download_assets` + `defaultFormat: "svg"`.
- **함정 1**: download_assets SVG에는 페이지 배경 rect(`#F5F5F5`)와 부모 프레임 흰 rect가 박혀 나온다 → `scripts/clean_svg.py`로 제거. **반드시 `<defs>` 밖의 rect만 제거**할 것 (clipPath 안의 rect를 지우면 전부 안 보이게 됨).
- **함정 2**: download_assets **PNG export는 흰 배경이 박힌다**. 투명이 필요한 사진(누끼 등)은 응답의 `rawImages` URL(원본 업로드 이미지, RGBA 투명 유지)을 받아 CSS crop(overflow hidden + % 오프셋)으로 재현한다. 컨텍스트 코드의 inset % 값을 그대로 쓰면 된다.
- **함정 3**: export bbox는 스트로크·회전 때문에 노드 w/h보다 크다. 컨텍스트 코드의 음수 inset %로 렌더 박스를 역산해 배치하고, 최종 위치는 검증 루프에서 실측으로 보정한다.
- **함정 4**: 같은 모양이라도 PC/모바일 노드가 회전·비율이 다를 수 있다 → 프레임별로 각각 export.
- 사진은 `defaultScale: 2`(레티나). 손글씨 등 특수 폰트 텍스트는 SVG로 export(패스로 베이크됨).
- URL은 단명하므로 즉시 curl로 다운로드.

## 4. 레이아웃 — 분기형 반응형

- **브레이크포인트**: ≥1024px = PC 레이아웃, <1024px = 모바일 레이아웃 (필요시 조정).
- **PC**: 섹션은 `width:100%` + 고정 높이, 내부 요소는 절대배치하되 좌표를 `left: calc(50% + (X - 중심)px)` **중앙 앵커**로 변환 → 콘텐츠 중앙 정렬 + 배경 풀블리드. 헤더/푸터처럼 엣지 기준 요소는 left/right 앵커 + 좁은 폭 보정 미디어쿼리.
- **모바일**: 섹션을 플로우로 스택(고정 높이), 요소는 중앙 앵커. 카드는 `min(디자인폭, calc(100% - 마진))`, 카드 내 우측 요소는 right 앵커. ≤380/≤360 미세 쿼리(vw 폰트, 카드 축소).
- **풀블리드 배경**(히어로 스카이라인 등): `width:100%; object-fit:cover; object-position:bottom` — 어떤 폭에서도 여백 없이 채워진다.
- 모바일 프레임의 **iOS 상태바(보통 상단 44~58px)는 제외**하고 전체 y를 시프트. 비교 시 시안도 같은 만큼 크롭.
- 폰트는 시안과 동일 웹폰트 로드(Pretendard CDN, Google Fonts 등). `-webkit-font-smoothing: antialiased`가 대체로 더 가깝다.

### 자주 터지는 CSS 함정
- **중앙정렬 텍스트의 꼬리 공백**은 HTML에서 collapse되어 수 px 시프트 → `&nbsp;`로 치환.
- 포괄 셀렉터(`.sec .abs img {width:100%}`)가 개별 크기 규칙을 특이도로 이겨 아이콘이 거대해질 수 있음 → 이미지 100% 규칙은 명시적 대상에만.
- 시맨틱 태그 교체 시 셀렉터 누락 주의 (`section` 셀렉터에 `footer`가 안 걸려 absolute 자식이 페이지 상단으로 앵커되는 사고).
- border-box + border가 있는 카드의 absolute 자식은 **패딩 박스 기준**이므로 시안 좌표에서 border 두께를 빼서 배치.

## 5. 인터랙션

시안의 정적 상태를 **기본값**으로 유지하면서 구현한다 (검증 루프가 계속 유효하도록):
- 아코디언: `grid-template-rows 0fr↔1fr` 트랜지션, 시안에서 열려 있는 항목을 기본 open.
- 무한 마퀴 캐러셀: 콘텐츠 복제 + keyframes, **t=0 위치가 시안과 일치**하도록 base left를 세트 폭만큼 보정. `prefers-reduced-motion`이면 정지(캡처 파리티용으로도 필수).
- 토글/드롭다운/햄버거/앵커 스크롤: 클래스 토글 + 트랜지션.
- 시안에 없는 콘텐츠(예: 나머지 FAQ 답변)는 placeholder로 넣고 **사용자에게 교체 필요를 명시**.

## 6. 랄프루프 (검증 반복) — 원커맨드

셋업 (프로젝트당 1회):
1. `scripts/ralph.js`, `scripts/ralph_compare.py`를 프로젝트 루트에 복사하고, `ralph.config.example.json`을 `ralph.config.json`으로 복사해 url/타깃(기준 폭·시안 이미지 경로·cropTop)을 채운다. `npm i playwright-core@<캐시된 chromium과 맞는 버전>`.
2. 시안 기준 이미지는 1단계에서 저장한 `shots/figma/*.png` 원본 해상도 풀샷.
3. `python3 -m http.server <port>`로 서빙.

루프 (수렴까지 반복, 보통 5~8회):
```
node ralph.js          # 캡처 → 2×8 분면 diff → 블러 구조 diff → PASS/FAIL 판정
node ralph.js --sweep  # + 320~2560 폭 스윕 (가로 스크롤 0, 브레이크포인트 분기 검사)
```
- FAIL이면 출력된 **히트맵(시안|웹|diff 3중 패널)**을 열어 원인을 찾고, **의심 요소는 PIL로 bbox/색상을 실측**해 오프셋을 수치로 확정한 뒤 CSS를 보정하고 다시 돌린다. 눈대중 금지.
- **원시 diff는 높은데 블러 diff가 낮으면** 폰트 래스터라이징 차이(수정 불가) — 쫓지 말 것. 블러 diff가 남는 분면이 진짜 구조 문제다.
- 판정 기준은 config의 `structuralMax`(기본 1.5%). exit code 0/1이므로 CI 게이트로도 쓸 수 있다.
- 캡처는 `--hide-scrollbars` + `reducedMotion` 에뮬레이션으로 결정론을 보장한다(마퀴·트랜지션이 t=0에 고정). 시안이 특정 상태(드롭다운 열림 등)를 보여주면 config의 `beforeCapture`에 JS 한 줄로 그 상태를 재현한다.
- 인터랙션은 `scripts/check_interactions.js`를 프로젝트에 맞게 고쳐 스모크 테스트한다.

## 7. 산출물 보고

- 최종 diff 수치(분면별 + 블러 전체), 남은 차이의 원인(폰트 래스터라이징 등), placeholder 콘텐츠 목록, 검증 도구 사용법을 요약해 전달한다.
