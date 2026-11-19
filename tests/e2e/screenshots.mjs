// Captures Home/Fasting/Food/Settings in dark and light into one grid: node tests/e2e/screenshots.mjs <dir>
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
const dir = process.argv[2];
const b = await chromium.launch();
const out = [];
for (const scheme of ['dark', 'light']) {
  const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], timezoneId: 'Asia/Vientiane', locale: 'th-TH', deviceScaleFactor: 1, colorScheme: scheme });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T06:30:00Z'));
  await p.goto('http://localhost:4173/form-if-tracker/');
  await p.getByRole('button', { name: 'เริ่มใช้งาน' }).click();
  await p.evaluate(async () => {
    const req = indexedDB.open('form-if-tracker');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const tx = db.transaction(['fasts', 'weights', 'foods', 'water'], 'readwrite');
    const H = 3600e3, now = Date.now();
    tx.objectStore('fasts').put({ id: 'b', protocol: '18:6', targetHours: 18, startAt: now - 43.5 * H, endAt: now - 25.5 * H, pauses: [], status: 'ended', edited: false, createdAt: now, updatedAt: now });
    tx.objectStore('fasts').put({ id: 'c', protocol: '18:6', targetHours: 18, startAt: now - 19.5 * H, endAt: now - 1.5 * H, pauses: [], status: 'ended', edited: false, createdAt: now, updatedAt: now });
    tx.objectStore('weights').put({ id: 'w1', date: '2026-11-18', kg: 85, waistCm: null, note: '', createdAt: now, updatedAt: now });
    tx.objectStore('weights').put({ id: 'w2', date: '2026-11-20', kg: 84.2, waistCm: null, note: '', createdAt: now, updatedAt: now });
    tx.objectStore('foods').put({ id: 'f1', date: '2026-11-20', time: '12:10', at: now - 1.3 * H, mealType: 'lunch', name: 'ก๋วยเตี๋ยวเนื้อ', foodItemId: null, quantity: 1, unit: '1 ชาม', kcal: 450, protein: 28, carbs: 55, fat: 12, photo: null, notes: '', createdAt: now, updatedAt: now });
    tx.objectStore('foods').put({ id: 'f2', date: '2026-11-20', time: '12:15', at: now - 1.2 * H, mealType: 'lunch', name: 'ไข่ต้ม', foodItemId: null, quantity: 2, unit: '1 ฟอง', kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6, photo: null, notes: '', createdAt: now, updatedAt: now });
    tx.objectStore('water').put({ id: 'h', date: '2026-11-20', at: now, ml: 1250 });
    await new Promise((r) => (tx.oncomplete = r));
  });
  await p.reload();
  await p.waitForTimeout(700);
  if (scheme === 'light') { await p.getByRole('navigation').getByRole('button', { name: 'ตั้งค่า' }).click(); await p.getByRole('radio', { name: 'สว่าง' }).click(); }
  for (const tab of ['หน้าหลัก', 'อดอาหาร', 'อาหาร', 'ตั้งค่า']) {
    await p.getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
    await p.waitForTimeout(500);
    const f = `${dir}/a-${scheme}-${out.length}.png`;
    await p.screenshot({ path: f });
    out.push(f);
  }
  await ctx.close();
}
const imgs = out.map((f) => `<img src="data:image/png;base64,${readFileSync(f).toString('base64')}">`).join('');
const p = await b.newPage({ viewport: { width: 393 * 4 + 50, height: 852 * 2 + 30 } });
await p.setContent(`<body style="margin:0;background:#777;display:grid;grid-template-columns:repeat(4,393px);gap:10px;padding:10px">${imgs}</body>`);
await p.screenshot({ path: `${dir}/apple-grid.png` });
await b.close();
console.log('ok');
