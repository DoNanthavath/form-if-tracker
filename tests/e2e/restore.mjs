// E2E: app reinstalled (empty) → restore everything from an .xlsx exported from the FORM Google Sheet.
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/node';

const d = (y, m, dd, h = 0, mi = 0) => ({ value: new Date(Date.UTC(y, m - 1, dd, h, mi)), format: h || mi ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd' });
const tm = (h, mi) => ({ value: new Date(Date.UTC(1899, 11, 30, h, mi)), format: 'hh:mm' });
const v = (x) => (x == null ? null : typeof x === 'object' ? x : { value: x });
const sheet = (name, rows) => ({ sheet: name, data: rows.map((r) => r.map(v)) });
// Shaped exactly like the Sheet FORM writes, after Google turned dates into date cells
const buf = await writeXlsxFile([
  sheet('Daily', [['date', 'kcal'], [d(2026, 11, 19), 970]]),
  sheet('Fasting', [['id', 'protocol', 'target_h', 'start', 'end', 'fasted_h', 'status', 'completed', 'edited'], ['f1', '18:6', 18, d(2026, 11, 18, 18, 0), d(2026, 11, 19, 12, 0), 18, 'ended', 'yes', 'yes']]),
  sheet('Food', [['id', 'date', 'time', 'meal', 'name', 'servings', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'has_photo', 'notes'],
    ['a', d(2026, 11, 19), tm(12, 30), 'lunch', 'ผัดวุ้นเส้นใส่เนื้อสัตว์และเห็ด', 1, 'ประมาณ 170 กรัม', 280, 12, 40, 8, 'no', 'ChatGPT (มั่นใจปานกลาง)'],
    ['b', d(2026, 11, 19), tm(12, 30), 'lunch', 'ข้าวสวย', 1, '150 g', 195, 4, 43, 0.4, 'no', '']]),
  sheet('Weight', [['id', 'date', 'kg', 'waist_cm', 'note'], ['w', d(2026, 11, 19), 84.6, null, null]]),
  sheet('Water', [['id', 'date', 'time', 'ml'], ['h', d(2026, 11, 19), tm(9, 0), 500]]),
  sheet('Activity', [['id', 'date', 'type', 'minutes', 'steps', 'kcal', 'note'], ['x', d(2026, 11, 19), 'walk', 30, 4000, null, null]]),
]).toBuffer();

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], timezoneId: 'Asia/Vientiane', locale: 'th-TH' });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-11-19T16:30:00Z'));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.FORM_URL ?? 'http://localhost:4173/form-if-tracker/');
await page.getByRole('button', { name: 'เริ่มใช้งาน' }).click();
await page.getByRole('navigation').getByRole('button', { name: 'ตั้งค่า' }).click();
await page.getByRole('button', { name: 'กู้คืนข้อมูลจาก Google Sheet' }).click();
await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'FORM.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf });
await page.getByRole('dialog').getByText('อดอาหาร 1 • อาหาร 2 • น้ำหนัก 1 • น้ำ 1 • กิจกรรม 1').waitFor();
if (process.argv[2]) await page.screenshot({ path: `${process.argv[2]}/r1-restore.png` });
await page.getByRole('dialog').getByRole('button', { name: 'กู้คืนข้อมูล' }).click();
await page.getByRole('navigation').getByRole('button', { name: 'อาหาร', exact: true }).click();
await page.getByText('ผัดวุ้นเส้นใส่เนื้อสัตว์และเห็ด').waitFor();
assert.ok((await page.locator('main').getByText('475', { exact: true }).count()) >= 1, '280 + 195 kcal restored');
await page.getByRole('navigation').getByRole('button', { name: 'อดอาหาร', exact: true }).click();
await page.getByText('สำเร็จ', { exact: true }).first().waitFor();
await page.getByRole('navigation').getByRole('button', { name: 'หน้าหลัก' }).click();
await page.getByText('84.6').first().waitFor();
assert.deepEqual(errors, []);
console.log('Restore E2E passed');
await b.close();
