// E2E: a fast left running past its goal can be ended at the time eating actually started.
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
const shots = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], timezoneId: 'Asia/Vientiane', locale: 'th-TH' });
const page = await ctx.newPage();
// Replay the real situation: started Wed 18 Nov 18:00, now Thu 19 Nov 23:06 (Vientiane)
await page.clock.setFixedTime(new Date('2026-11-19T16:06:00Z'));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.FORM_URL ?? 'http://localhost:4173/form-if-tracker/');
await page.getByRole('button', { name: 'เริ่มใช้งาน' }).click();
const start = '2026-11-18T18:00';
await page.getByRole('button', { name: 'เริ่มอดอาหาร' }).first().click();
await page.getByRole('dialog').getByLabel('เวลาเริ่ม').fill(start);
await page.getByRole('dialog').getByRole('button', { name: 'เริ่มอดอาหาร' }).click();
const nudge = page.getByRole('button', { name: /เกินเป้าหมายมา 11 ชม\. แล้ว/ });
await nudge.waitFor();
await page.getByText(/19, 12:00/).first().waitFor(); // goal shows the real time 18h was reached
if (shots) await page.screenshot({ path: `${shots}/e1-overtime.png` });
await nudge.click();
const dlg = page.getByRole('dialog');
await dlg.getByText(/คุณเริ่มกินมื้อแรกเมื่อไหร่/).waitFor();
await dlg.getByRole('button', { name: /^เวลาเริ่มช่วงกินตามแผน/ }).click();
await dlg.getByText('สำเร็จ', { exact: true }).waitFor();
if (shots) await page.screenshot({ path: `${shots}/e2-end-sheet.png` });
await dlg.getByText('18:00 ชม.').waitFor(); // exactly 18 h
await dlg.getByRole('button', { name: 'เริ่มกิน (จบการอด)' }).click();
await page.getByRole('navigation').getByRole('button', { name: 'อดอาหาร', exact: true }).click();
await page.getByText('สำเร็จ', { exact: true }).first().waitFor();
await page.getByText('แก้ไขเวลา').first().waitFor();
assert.deepEqual(errors, []);
console.log('End-fast E2E passed');
await b.close();
