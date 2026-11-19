// E2E for Google Sheets sync + AI photo analysis with both external endpoints mocked.
// Usage: npm run build && npx vite preview --port 4173 &  node tests/e2e/integrations.mjs [screenshotDir]
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const URL = process.env.FORM_URL ?? 'http://localhost:4173/form-if-tracker/';
const shots = process.argv[2];
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbTESTdeployment_ID-123/exec';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], timezoneId: 'Asia/Vientiane', locale: 'th-TH', colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const snap = (n) => shots && page.screenshot({ path: `${shots}/${n}.png` });

const posts = [];
await ctx.route('https://script.google.com/**', async (route) => {
  posts.push(JSON.parse(route.request().postData()));
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/abc/edit' }) });
});
await ctx.route('https://chatgpt.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>ChatGPT stub</title>' }));
let aiRequest = null;
await ctx.route('https://api.anthropic.com/**', async (route) => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
  aiRequest = { headers: await req.allHeaders(), body: JSON.parse(req.postData()) };
  const result = { is_food: true, note: 'น้ำมันที่ใช้ผัดอาจทำให้แคลอรีสูงกว่านี้', items: [
    { name: 'ข้าวผัดหมู', portion: '1 จาน (~300 g)', kcal: 560, protein: 19, carbs: 76, fat: 20, confidence: 'medium' },
    { name: 'ไข่ดาว', portion: '1 ฟอง', kcal: 90, protein: 6, carbs: 0.5, fat: 7, confidence: 'high' },
  ] };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(result) }],
    stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1500, output_tokens: 300 },
  }) });
});

await page.goto(URL);
await page.getByRole('button', { name: 'เริ่มใช้งาน' }).click();

// ── Settings: connect Google Sheets ──
await page.getByRole('navigation').getByRole('button', { name: 'ตั้งค่า' }).click();
await page.getByLabel('URL ของเว็บแอป').fill('https://example.com/not-apps-script');
await page.getByRole('button', { name: 'เชื่อมต่อและซิงก์' }).click();
await page.getByText('URL ต้องขึ้นต้นด้วย').waitFor();
await page.getByLabel('URL ของเว็บแอป').fill(SCRIPT_URL);
await page.getByRole('button', { name: 'เชื่อมต่อและซิงก์' }).click();
await page.getByText('ซิงก์อัตโนมัติเปิดอยู่').waitFor();
assert.equal(posts.length, 1, 'initial sync posted');
assert.match(posts[0].token, /^[0-9a-f]{48}$/, 'device token sent');
await page.getByRole('link', { name: 'เปิด Google Sheet' }).waitFor();
assert.deepEqual(Object.keys(posts[0].tables).sort(), ['Activity', 'Daily', 'Fasting', 'Food', 'Water', 'Weight']);
await page.getByRole('heading', { name: 'ซิงก์กับ Google Sheets' }).scrollIntoViewIfNeeded();
await snap('i1-sheets-connected');

// ── Settings: AI key ──
await page.getByLabel('Anthropic API key').fill('sk-ant-api03-TESTKEY_abcdefghijklmnopqrstuvwxyz');
await page.getByRole('button', { name: 'บันทึก', exact: true }).last().click();
await page.getByText('sk-ant-api…wxyz').waitFor();

// ── Food: AI photo flow ──
await page.getByRole('navigation').getByRole('button', { name: 'อาหาร', exact: true }).click();
await page.getByRole('button', { name: 'เพิ่มอาหาร' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'ถ่ายรูปให้ AI วิเคราะห์' }).click();
await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: readFileSync(new globalThis.URL('../../public/pwa-512.png', import.meta.url)) });
await page.getByRole('dialog').getByLabel(/ข้อมูลเพิ่มเติม/).fill('กินหมดจาน');
await page.getByRole('dialog').getByRole('button', { name: 'วิเคราะห์' }).click();
await page.getByText('ผลการวิเคราะห์').waitFor();
assert.equal(aiRequest.headers.authorization, 'Bearer sk-ant-api03-TESTKEY_abcdefghijklmnopqrstuvwxyz');
assert.equal(aiRequest.headers['anthropic-dangerous-direct-browser-access'], 'true');
assert.equal(aiRequest.body.model, 'claude-opus-5-5');
assert.equal(aiRequest.body.fallbacks, 'default');
assert.equal(aiRequest.body.messages[0].content[0].type, 'image');
assert.match(aiRequest.body.messages[0].content[1].text, /กินหมดจาน/);
assert.equal(aiRequest.body.output_config.format.type, 'json_schema');
await snap('i2-ai-results');
// edit the egg kcal, untick nothing, save both
await page.getByRole('dialog').getByRole('button', { name: /บันทึกรายการที่เลือก · 650 kcal/ }).click();
await page.getByText('ข้าวผัดหมู').first().waitFor();
await page.waitForTimeout(300);
assert.ok((await page.locator('main').getByText('650', { exact: true }).count()) >= 1, 'daily total 560 + 90');
await snap('i3-food-after-ai');

// ── Auto-sync after the change (debounced ~4 s) ──
const deadline = Date.now() + 10000;
while (posts.length < 2 && Date.now() < deadline) await page.waitForTimeout(250);
assert.ok(posts.length >= 2, 'auto-sync after adding food');
const food = posts.at(-1).tables.Food;
assert.equal(food.rows.length, 2);
assert.ok(!JSON.stringify(posts.at(-1)).includes('base64'), 'photos never synced');

// ── ChatGPT flow (no API involved) ──
await page.getByRole('button', { name: 'เพิ่มอาหาร' }).click();
await page.getByRole('dialog').getByRole('button', { name: /วิเคราะห์รูปด้วย ChatGPT/ }).click();
const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('dialog').getByRole('button', { name: 'คัดลอกคำสั่งและเปิด ChatGPT' }).click()]);
assert.match(popup.url(), /^https:\/\/chatgpt\.com\/\?q=/);
await popup.close();
assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Reply ONLY with this JSON/);
await page.evaluate(() => navigator.clipboard.writeText('ผลครับ\n```json\n{"items":[{"name":"ส้มตำ","portion":"1 จาน","kcal":150,"protein":5,"carbs":28,"fat":2,"confidence":"medium"}],"note":""}\n```'));
await page.getByRole('dialog').getByRole('button', { name: 'วางคำตอบจาก ChatGPT' }).click();
await page.getByRole('dialog').getByRole('button', { name: /บันทึกรายการที่เลือก · 150 kcal/ }).click();
await page.getByText('ส้มตำ').first().waitFor();
await snap('i4-food-after-chatgpt');

// ── Computer setup page ──
await page.goto(URL + '#/sheets');
await page.getByRole('heading', { name: 'ตั้งค่าซิงก์ Google Sheets' }).waitFor();
await page.getByRole('button', { name: 'คัดลอกสคริปต์' }).click();
assert.match(await page.evaluate(() => navigator.clipboard.readText()), /function doPost\(e\)/);
await snap('i5-setup-page');

assert.deepEqual(errors, [], errors.join('\n'));
console.log('Integrations E2E passed');
await browser.close();
