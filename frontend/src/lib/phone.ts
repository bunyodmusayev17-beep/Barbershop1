/** 9 ta raqamni "90 123 45 67" ko'rinishida formatlaydi (yozish davomida). */
export function formatLocalPhone(input: string): string {
  const d = input.replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
  const groups = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return groups.join(' ');
}

export function isValidLocalPhone(input: string): boolean {
  return input.replace(/\D/g, '').length === 9;
}
