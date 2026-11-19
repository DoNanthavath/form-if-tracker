// End-to-end smoke test against a running `vite preview` (http://localhost:4173/form-if-tracker/).
// Usage: npm run build && npx vite preview --port 4173 &  node tests/e2e/smoke.mjs [screenshotDir]
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';

const URL = process.env.FORM_URL ?? 'http://localhost:4173/form-if-tracker/';
const shots = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], timezoneId: 'Asia/Vientiane', locale: 'th-TH', colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const snap = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
const noOverflow = async (where) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(o <= 0, `horizontal overflow on ${where}: ${o}px`);
};

await page.goto(URL);
await page.getByRole('button', { name: 'เริ่มใช้งาน' }).click();
await page.waitForTimeout(400);
await noOverflow('home');
await snap('01-home');

// Start a tracked fast (back-dated suggestion) and pause/resume
await page.getByRole('button', { name: 'เริ่มอดอาหาร' }).first().click();
await page.getByRole('dialog').getByRole('button', { name: 'เริ่มอดอาหาร' }).click();
await page.getByRole('button', { name: 'หยุดพัก' }).first().waitFor();
await page.waitForTimeout(500);
await snap('02-home-fasting');

// Food: add sticky rice, half portion
await page.getByRole('navigation').getByRole('button', { name: 'อาหาร', exact: true }).click();
await page.getByRole('button', { name: 'เพิ่มอาหาร' }).click();
await page.getByRole('dialog').getByPlaceholder('ค้นหาอาหาร…').fill('ข้าวเหนียว');
await page.getByRole('dialog').getByText('ข้าวเหนียวนึ่ง').click();
await page.getByRole('dialog').getByRole('button', { name: '½', exact: true }).click();
await snap('03-food-form');
await page.getByRole('dialog').getByRole('button', { name: /บันทึก/ }).click();
await page.waitForTimeout(400);
// Add beef noodle soup, full portion
await page.getByRole('button', { name: 'เพิ่มอาหาร' }).click();
await page.getByRole('dialog').getByText('ก๋วยเตี๋ยวเนื้อ / เฝอเนื้อ').click();
await page.getByRole('dialog').getByRole('button', { name: /บันทึก/ }).click();
await page.waitForTimeout(500);
const eaten = await page.locator('main').getByText('550', { exact: true }).count();
assert.ok(eaten >= 1, 'daily total 100 + 450 = 550 kcal should be shown');
await noOverflow('food');
await snap('04-food');

// Weight
await page.getByRole('navigation').getByRole('button', { name: 'ความคืบหน้า' }).click();
await page.getByRole('button', { name: 'บันทึกน้ำหนัก' }).first().click();
await page.getByRole('dialog').getByLabel('น้ำหนัก (กก.)').fill('84.6');
await page.getByRole('dialog').getByRole('button', { name: 'บันทึก' }).click();
await page.waitForTimeout(600);
await noOverflow('progress');
await snap('05-progress');
await page.getByRole('radio', { name: 'วิเคราะห์' }).click();
await page.waitForTimeout(800);
await noOverflow('insights');
await snap('06-insights');

// Persistence across reload
await page.reload();
await page.getByRole('navigation').getByRole('button', { name: 'หน้าหลัก' }).click();
await page.getByRole('button', { name: 'หยุดพัก' }).first().waitFor();
await page.getByText('84.6').first().waitFor({ timeout: 10000 }); // weight persisted

// Offline after install (service worker)
await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
await page.getByRole('navigation').waitFor();
await page.getByText('84.6').first().waitFor({ timeout: 10000 }); // works offline
await ctx.setOffline(false);

// English + settings
await page.getByRole('navigation').getByRole('button', { name: 'ตั้งค่า' }).click();
await page.getByRole('radio', { name: 'English' }).click();
await page.getByRole('heading', { name: 'Settings' }).waitFor();
await noOverflow('settings');
await snap('07-settings-en');
await page.getByRole('navigation').getByRole('button', { name: 'Fasting' }).click();
await page.waitForTimeout(500);
await snap('08-fasting-en');

// Light theme
await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();
await page.getByRole('radio', { name: 'Light' }).click();
await page.getByRole('navigation').getByRole('button', { name: 'Home' }).click();
await page.waitForTimeout(500);
await snap('09-home-light');

assert.deepEqual(errors, [], `console errors: ${errors.join('\n')}`);
console.log('E2E smoke test passed');
await browser.close();
