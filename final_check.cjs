const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // 開発サーバーではなく、ビルド後のHTMLを直接チェック（SSRなしの状態）
    const htmlPath = path.resolve('/Users/kkitase/dev/hackathon/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    await page.setContent(html);
    
    // body直下の主要コンポーネントが正しいか
    const children = await page.evaluate(() => {
      return Array.from(document.body.children).map(c => ({
        tagName: c.tagName,
        id: c.id
      })).filter(c => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE');
    });
    
    console.log('--- Body Elements Order ---');
    console.log(JSON.stringify(children, null, 2));
    
    // header が body 直下にあるか
    const headerParent = await page.evaluate(() => document.querySelector('header').parentElement.tagName);
    console.log('Header Parent:', headerParent);

    // footer が body 直下にあるか
    const footerParent = await page.evaluate(() => document.querySelector('footer').parentElement.tagName);
    console.log('Footer Parent:', footerParent);

    // モーダルが body 直下にあるか
    const modalParent = await page.evaluate(() => document.getElementById('register-modal').parentElement.tagName);
    console.log('Register Modal Parent:', modalParent);

    if (headerParent === 'BODY' && footerParent === 'BODY' && modalParent === 'BODY') {
      console.log('SUCCESS: DOM Structure is flat and correct.');
    } else {
      console.log('FAILURE: Nested structure detected!');
    }

    await browser.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
