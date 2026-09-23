export function getTravelerTypeFromBirthDate(birthDate: string): 'adult' | 'minor' {
  const trimmed = birthDate.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'adult';

  const birth = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return 'adult';

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age < 18 ? 'minor' : 'adult';
}

export function getTravelerAgeFromBirthDate(birthDate: string): number {
  const trimmed = birthDate.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;

  const birth = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return Math.max(0, age);
}

export function normalizeTravelerDetails(item: {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  document: string;
  country?: string;
  travelerType?: 'adult' | 'minor' | null;
}) {
  const birthDate = String(item.birthDate ?? '').trim();
  return {
    firstName: String(item.firstName ?? '').trim(),
    lastName: String(item.lastName ?? '').trim(),
    age: getTravelerAgeFromBirthDate(birthDate),
    birthDate,
    phone: String(item.phone ?? '').trim(),
    document: String(item.document ?? '').trim(),
    country: String(item.country ?? '').trim(),
    travelerType:
      item.travelerType === 'adult' || item.travelerType === 'minor'
        ? item.travelerType
        : getTravelerTypeFromBirthDate(birthDate),
  };
}
