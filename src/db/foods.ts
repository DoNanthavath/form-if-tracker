import type { FoodItem } from '../lib/types';

/**
 * Starter personal food database. All values are rough ESTIMATES for typical
 * home-style / street-food portions in Laos & Thailand (or generic references for
 * Western items). Real portions and recipes vary widely – every item is editable.
 * No branded products are included.
 */
type Seed = Omit<FoodItem, 'builtin' | 'updatedAt'>;

const SEEDS: Seed[] = [
  { id: 'f-beef-noodle', nameTh: 'ก๋วยเตี๋ยวเนื้อ / เฝอเนื้อ', nameEn: 'Beef noodle soup', servingTh: '1 ชาม', servingEn: '1 bowl', kcal: 450, protein: 28, carbs: 55, fat: 12, category: 'meal' },
  { id: 'f-sticky-rice', nameTh: 'ข้าวเหนียวนึ่ง', nameEn: 'Sticky rice', servingTh: '1 ปั้น (~100 g)', servingEn: '1 portion (~100 g)', kcal: 200, protein: 4, carbs: 44, fat: 0.5, category: 'side' },
  { id: 'f-grilled-chicken', nameTh: 'ไก่ย่าง', nameEn: 'Grilled chicken', servingTh: '1 น่อง/สะโพก (~150 g)', servingEn: '1 leg/thigh (~150 g)', kcal: 300, protein: 30, carbs: 2, fat: 19, category: 'protein' },
  { id: 'f-fried-rice', nameTh: 'ข้าวผัด', nameEn: 'Fried rice', servingTh: '1 จาน', servingEn: '1 plate', kcal: 550, protein: 18, carbs: 75, fat: 20, category: 'meal' },
  { id: 'f-papaya-salad', nameTh: 'ตำหมากหุ่ง / ส้มตำ', nameEn: 'Papaya salad', servingTh: '1 จาน', servingEn: '1 plate', kcal: 150, protein: 5, carbs: 28, fat: 2, category: 'side' },
  { id: 'f-watermelon', nameTh: 'แตงโม', nameEn: 'Watermelon', servingTh: '1 ถ้วย หั่นเต๋า (~150 g)', servingEn: '1 cup diced (~150 g)', kcal: 46, protein: 0.9, carbs: 11.5, fat: 0.2, category: 'fruit' },
  { id: 'f-caesar', nameTh: 'ซีซาร์สลัด (มีน้ำสลัด)', nameEn: 'Caesar salad (with dressing)', servingTh: '1 จาน', servingEn: '1 plate', kcal: 330, protein: 9, carbs: 14, fat: 27, category: 'meal' },
  { id: 'f-fries', nameTh: 'เฟรนช์ฟรายส์', nameEn: 'French fries', servingTh: '1 ที่ขนาดกลาง (~115 g)', servingEn: '1 medium serving (~115 g)', kcal: 365, protein: 4, carbs: 48, fat: 17, category: 'side' },
  { id: 'f-burger', nameTh: 'เบอร์เกอร์เนื้อ', nameEn: 'Beef burger', servingTh: '1 ชิ้น (เนื้อ 1 แผ่น)', servingEn: '1 burger (single patty)', kcal: 540, protein: 28, carbs: 40, fat: 29, category: 'meal' },
  { id: 'f-americano', nameTh: 'อเมริกาโน่เย็น (ไม่หวาน)', nameEn: 'Iced Americano (unsweetened)', servingTh: '1 แก้ว', servingEn: '1 glass', kcal: 10, protein: 0.5, carbs: 1.5, fat: 0, category: 'drink' },
  { id: 'f-soy-milk', nameTh: 'นมถั่วเหลือง (หวาน)', nameEn: 'Soy milk (sweetened)', servingTh: '1 แก้ว (250 ml)', servingEn: '1 glass (250 ml)', kcal: 130, protein: 7, carbs: 15, fat: 4, category: 'drink' },
  { id: 'f-cocoa-milk', nameTh: 'โกโก้นม', nameEn: 'Cocoa milk', servingTh: '1 แก้ว (250 ml)', servingEn: '1 glass (250 ml)', kcal: 200, protein: 8, carbs: 30, fat: 6, category: 'drink' },
  { id: 'f-laap', nameTh: 'ลาบไก่ / ลาบเนื้อ', nameEn: 'Laap (chicken/beef)', servingTh: '1 จาน', servingEn: '1 plate', kcal: 250, protein: 25, carbs: 8, fat: 13, category: 'protein' },
  { id: 'f-khao-piak', nameTh: 'ข้าวเปียกเส้น', nameEn: 'Khao piak sen', servingTh: '1 ชาม', servingEn: '1 bowl', kcal: 400, protein: 20, carbs: 55, fat: 10, category: 'meal' },
  { id: 'f-jasmine-rice', nameTh: 'ข้าวสวย', nameEn: 'Steamed jasmine rice', servingTh: '1 ถ้วย (~160 g)', servingEn: '1 cup (~160 g)', kcal: 205, protein: 4.3, carbs: 45, fat: 0.4, category: 'side' },
  { id: 'f-egg', nameTh: 'ไข่ต้ม', nameEn: 'Boiled egg', servingTh: '1 ฟอง', servingEn: '1 egg', kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, category: 'protein' },
  { id: 'f-chicken-breast', nameTh: 'อกไก่ต้ม/ย่าง', nameEn: 'Chicken breast (cooked)', servingTh: '100 g', servingEn: '100 g', kcal: 165, protein: 31, carbs: 0, fat: 3.6, category: 'protein' },
  { id: 'f-banana', nameTh: 'กล้วย', nameEn: 'Banana', servingTh: '1 ผลกลาง', servingEn: '1 medium', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, category: 'fruit' },
  { id: 'f-tom-yum', nameTh: 'ต้มยำ (น้ำใส)', nameEn: 'Tom yum (clear)', servingTh: '1 ชาม', servingEn: '1 bowl', kcal: 180, protein: 18, carbs: 10, fat: 7, category: 'meal' },
  { id: 'f-plain-yogurt', nameTh: 'โยเกิร์ตกรีกไม่หวาน', nameEn: 'Plain Greek yogurt', servingTh: '1 ถ้วย (~170 g)', servingEn: '1 cup (~170 g)', kcal: 100, protein: 17, carbs: 6, fat: 0.7, category: 'snack' },
];

export function builtinFoods(now = Date.now()): FoodItem[] {
  return SEEDS.map((s) => ({ ...s, builtin: true, updatedAt: now }));
}
