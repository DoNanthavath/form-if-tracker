/** "2026-03-07" → "7/3" (compact day/month axis label). */
export const dm = (date: string) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
