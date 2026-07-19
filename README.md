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

## License

MIT
