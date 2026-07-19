#!/usr/bin/env node
/* ralph.js — 랄프루프 원커맨드 러너
 *
 *   node ralph.js            캡처 → 분면 diff → 블러 구조 diff → 판정 리포트
 *   node ralph.js --sweep    + 다중 폭 스윕(가로 스크롤/높이/레이아웃 분기 검사)
 *
 * 설정: ralph.config.json (같은 폴더)
 *   {
 *     "url": "http://localhost:8901/index.html",
 *     "outDir": "shots/ralph",
 *     "structuralMax": 1.5,          // 블러 diff>25 허용 상한(%) — 초과 시 FAIL
 *     "targets": [
 *       { "name": "pc",     "width": 1920, "ref": "shots/figma/pc_full.png",     "cropTop": 0  },
 *       { "name": "mobile", "width": 393,  "ref": "shots/figma/mobile_full.png", "cropTop": 58 }
 *     ],
 *     "sweepWidths": [320, 360, 375, 393, 414, 430, 768, 834, 1024, 1280, 1440, 1920, 2560],
 *     "sweepBreakpoint": 1024        // 이상=PC 루트, 미만=모바일 루트 (.pc-root/.m-root)
 *   }
 *
 * exit code: 0 = PASS, 1 = FAIL (CI 게이트로 사용 가능)
 */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'ralph.config.json'), 'utf8'));
const SWEEP = process.argv.includes('--sweep');
const pad = (s, n) => String(s).padEnd(n);
let failed = false;

(async () => {
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  fs.mkdirSync(cfg.outDir, { recursive: true });

  console.log('━━━ RALPH LOOP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ---- 1) capture + compare per target ----
  for (const t of cfg.targets) {
    const ctx = await browser.newContext({ viewport: { width: t.width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' }); // 마퀴/트랜지션을 t=0에 고정
    await page.goto(cfg.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    if (t.beforeCapture) await page.evaluate(t.beforeCapture); // 예: 드롭다운 open
    const shot = path.join(cfg.outDir, `${t.name}_full.png`);
    await page.screenshot({ path: shot, fullPage: true });
    await ctx.close();

    const json = execFileSync('python3', [path.join(__dirname, 'ralph_compare.py'),
      t.ref, shot, String(t.cropTop || 0), cfg.outDir, t.name]).toString();
    const r = JSON.parse(json);

    const sizeOk = r.sizeMatch;
    const structOk = r.blurredPct <= (cfg.structuralMax ?? 1.5);
    if (!sizeOk || !structOk) failed = true;

    console.log(`\n[${t.name}] ${t.width}px  ref=${r.refSize.join('x')} web=${r.webSize.join('x')}  ${sizeOk ? '✓ size' : '✗ SIZE MISMATCH'}`);
    console.log(`  구조 diff(블러2px, >25): ${r.blurredPct}%  (>50: ${r.blurredPct50}%)  기준 ≤${cfg.structuralMax ?? 1.5}%  → ${structOk ? 'PASS' : 'FAIL'}`);
    console.log('  원시 분면 상위:');
    for (const q of r.quadrants.slice(0, 4))
      console.log(`    ${pad(q.tag, 5)} y${q.y[0]}-${q.y[1]}  diff%=${pad(q.pct, 6)} mean=${q.mean}`);
    console.log('  구조(블러) 분면 상위:');
    for (const q of r.blurredQuadrants.slice(0, 3))
      console.log(`    ${pad(q.tag, 5)} ${q.pct}%`);
    console.log(`  히트맵: ${r.triptychs.join(', ')}`);
  }

  // ---- 2) width sweep ----
  if (SWEEP && cfg.sweepWidths) {
    console.log('\n━━━ WIDTH SWEEP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const w of cfg.sweepWidths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(cfg.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const info = await page.evaluate((bp) => {
        const de = document.documentElement;
        const pc = document.querySelector('.pc-root'), m = document.querySelector('.m-root');
        const mode = pc && getComputedStyle(pc).display !== 'none' ? 'PC' : 'M';
        return { cw: de.clientWidth, sw: de.scrollWidth, mode,
                 modeOk: bp ? (de.clientWidth >= bp) === (mode === 'PC') : true,
                 bodyH: Math.round(document.body.scrollHeight) };
      }, cfg.sweepBreakpoint);
      const ovf = info.sw > info.cw;
      if (ovf || !info.modeOk) failed = true;
      console.log(`  w=${pad(w, 5)} ${info.mode}  overflowX=${ovf ? '✗ YES' : 'no'}  breakpoint=${info.modeOk ? 'ok' : '✗ WRONG'}  bodyH=${info.bodyH}`);
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n━━━ 결과: ${failed ? '✗ FAIL — 히트맵 확인 후 수정하고 다시 돌리세요' : '✓ PASS'} ━━━`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
