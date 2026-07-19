# fig2code

피그마 디자인을 **1px 수준으로 일치하는 반응형 HTML/CSS**로 퍼블리싱하고,
스크린샷 분면 비교 루프(랄프루프)로 자동 재검증하는 Claude Code 스킬입니다.

- PC/모바일 프레임 기반 **분기형 반응형** (중앙 앵커 + 풀블리드 배경, 320~2560px)
- Figma MCP 에셋 추출의 함정(배경 rect, 흰 배경 PNG, clipPath 파손 등) 회피 절차 내장
- **원커맨드 검증**: `node ralph.js` — 캡처 → 2×8 분면 diff → 블러 구조 diff → PASS/FAIL(exit 0/1, CI 게이트 가능)
- 아코디언·마퀴 캐러셀·토글 등 인터랙션 패턴 포함

## 설치

### 방법 1 — 플러그인 마켓플레이스 (권장)
Claude Code에서:
```
/plugin marketplace add heojeongho/fig2code
/plugin install fig2code@fig2code
```

### 방법 2 — 스킬 폴더 복사
```
git clone https://github.com/heojeongho/fig2code.git
cp -r fig2code/plugins/fig2code/skills/fig2code ~/.claude/skills/   # 개인 설치
# 또는 팀 레포에: cp -r ... <repo>/.claude/skills/
```

### 방법 3 — Claude 데스크탑/웹 채팅 (Claude Code 미사용 시)
`plugins/fig2code/skills/fig2code`를 zip으로 묶어
설정 → 기능(Capabilities) → 스킬에 업로드하거나, `PROMPT.md`를 단일 프롬프트로 사용하세요.

## 사용

피그마 URL과 함께 요청하면 됩니다:
```
/fig2code https://www.figma.com/design/... 이 페이지 픽셀 퍼펙트로 퍼블리싱하고 랄프루프 돌려줘
```

전제: Figma MCP 서버 연결, node + playwright-core, python3 + Pillow/numpy.

## 검증 루프 (ralph loop)

```
node ralph.js          # 캡처 → 분면 diff → 블러 구조 diff → PASS/FAIL
node ralph.js --sweep  # + 320~2560 폭 반응형 스윕
```

수렴 기준: 블러(2px) diff ≤ 1.5% (잔여분은 Figma↔브라우저 폰트 래스터라이징 차이).
자세한 워크플로우는 `plugins/fig2code/skills/fig2code/SKILL.md` 참고.

## 토큰 사용량 — 일반 Figma MCP 원샷 대비

fig2code는 검증 루프만큼 토큰을 더 씁니다. 랜딩 1페이지(PC 1920×8220 + 모바일 393×7204,
10개 섹션) 레퍼런스 구현 기준의 대략적인 추정치입니다:

| 단계 | 일반 MCP 원샷 | fig2code 추가분 | 비고 |
|---|---|---|---|
| 디자인 컨텍스트 수집 | ~60–90K | 거의 동일 | 섹션 분할 호출이라 총량은 비슷, 대형 응답은 파일로 우회 |
| 시안 레퍼런스 풀샷 | – | **~0** | URL+curl로 받아 컨텍스트에 이미지를 태우지 않음 |
| 에셋 추출 | 소량 | +5–10K | download_assets 텍스트 응답 |
| 검증 루프(랄프루프) | – | +20–40K | 회당 diff 표(~1K) + 히트맵 2–4장(장당 ~1–1.5K) × 5–8회 |
| 폭 스윕·인터랙션 테스트 | – | +2–5K | 텍스트 로그 위주 |
| **합계** | **1×** | **≈ 1.3–1.6×** | 추가분 대부분이 검증 루프 |

이 오버헤드로 얻는 것: 레퍼런스 구현에서 **육안으로는 못 잡는 결함 8건**을 검출했습니다
(배경색과 색차 31의 흰 배경 이미지, 카드 높이 2px 누적 오프셋, 공백 collapse로 인한 3px
중앙 시프트, 리팩터링 회귀로 사라진 푸터 등). 검증 루프는 CSS 리팩터링의 회귀 테스트
역할도 하므로, 수정 라운드가 많을수록 상대적 비용은 내려갑니다.

### 스킬에 내장된 토큰 절약 원칙

- `get_design_context`에 `excludeScreenshot: true` — 스크린샷은 필요할 때 URL+curl로만
- 이미지(시안·에셋)는 base64로 컨텍스트에 넣지 않고 **디스크로 직행**
- 토큰 한도를 넘는 대형 metadata 응답은 저장된 파일을 python으로 파싱 (전체 재독 금지)
- 히트맵은 상위 분면만 열람하고, 오프셋 판단은 이미지 눈대중 대신 **PIL bbox 수치 실측** 우선

## License

MIT
