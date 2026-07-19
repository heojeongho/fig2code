const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const url = 'http://localhost:8901/index.html';
  const results = [];
  const t = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

  // ---- PC ----
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  // FAQ accordion
  const i2open = await page.$eval('.s8-i2', el => el.classList.contains('open'));
  t('PC FAQ 기본: item2 open', i2open);
  await page.click('.s8-i3 .s8-head');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    i2: document.querySelector('.s8-i2').classList.contains('open'),
    i3: document.querySelector('.s8-i3').classList.contains('open'),
    h3: document.querySelector('.s8-i3').getBoundingClientRect().height,
  }));
  t('PC FAQ 클릭: item3 open/타항목 닫힘/높이 확장', !after.i2 && after.i3 && after.h3 > 140);
  await page.click('.s8-i3 .s8-head');
  await page.waitForTimeout(400);
  const closed = await page.$eval('.s8-i3', el => el.getBoundingClientRect().height);
  t('PC FAQ 재클릭: 닫힘(103px)', Math.abs(closed - 103) < 2);

  // toggle
  await page.click('.s5-toggle');
  await page.waitForTimeout(400);
  const knob = await page.$eval('.s5-toggle .knob', el => getComputedStyle(el).transform);
  t('PC 개인/법인 토글: knob 이동', knob.includes('79'));

  // dropdown click
  await page.click('.nav-services .nav-item');
  const ddOpen = await page.$eval('.hd-dd', el => getComputedStyle(el).display === 'flex');
  t('PC 서비스 드롭다운 클릭 오픈', ddOpen);

  // anchor scroll
  await page.click('a[href="#pricing"]');
  await page.waitForTimeout(900);
  const sy = await page.evaluate(() => scrollY);
  t('PC 앵커 스크롤(#pricing)', sy > 2000);
  await ctx.close();

  // ---- Mobile ----
  ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.click('.m-header .hamb');
  const menuOpen = await page.$eval('.m-menu', el => getComputedStyle(el).display === 'flex');
  t('M 햄버거 메뉴 오픈', menuOpen);
  await page.click('.m-menu a[href="#m-pricing"]');
  await page.waitForTimeout(900);
  const msy = await page.evaluate(() => scrollY);
  const menuClosed = await page.$eval('.m-menu', el => getComputedStyle(el).display === 'none');
  t('M 메뉴 링크: 스크롤+메뉴 닫힘', msy > 2000 && menuClosed);

  await page.evaluate(() => document.querySelector('#m-help').scrollIntoView());
  await page.click('.m-fi1 .m-head');
  await page.waitForTimeout(400);
  const mfaq = await page.evaluate(() => ({
    i1: document.querySelector('.m-fi1').classList.contains('open'),
    i2: document.querySelector('.m-fi2').classList.contains('open'),
    h1: document.querySelector('.m-fi1').getBoundingClientRect().height,
  }));
  t('M FAQ: item1 열림/item2 닫힘', mfaq.i1 && !mfaq.i2 && mfaq.h1 > 120);

  await page.click('.m-toggle');
  await page.waitForTimeout(400);
  const mknob = await page.$eval('.m-toggle .knob', el => getComputedStyle(el).transform);
  t('M 토글: knob 이동', mknob.includes('79'));

  const mq = await page.evaluate(() => ({
    r1: getComputedStyle(document.querySelector('.m-rrow1')).animationName,
    r2: getComputedStyle(document.querySelector('.m-rrow2')).animationName,
    n1: document.querySelectorAll('.m-rrow1 .m-rcard').length,
  }));
  t('M 후기 마퀴 동작(row1/row2 애니메이션+복제)', mq.r1 === 'mq-left' && mq.r2 === 'mq-right' && mq.n1 === 10);
  await ctx.close();

  await browser.close();
  console.log(results.join('\n'));
})();
