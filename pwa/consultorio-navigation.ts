export type PatientListItem = {
  id: number; name: string; createdAt: string; phone?: string; cpf?: string; nickname?: string;
  tags?: string; goal?: string; biologicalCondition?: string;
};
export type PatientSort = 'name' | 'created' | 'activity';
export type PatientFilter = 'all' | 'withPlan' | 'withoutPlan' | 'upcoming' | 'withoutRecord' | 'gestante' | 'lactante';
export type ActivityStamp = {patientId: number; date: string};
export type CalendarView = 'month' | 'week' | 'list';

export function keepPatientDraft<T extends {patientId: number | null}>(current: T, loaded: T): T {
  return current.patientId === loaded.patientId ? current : loaded;
}

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function patientTags(value = '') {
  return [...new Set(value.split(/[,;\n]+/).map(tag => tag.trim().replace(/^#+/, '')).filter(Boolean))];
}

export function patientLastActivity(patient: PatientListItem, activity: readonly ActivityStamp[] = []) {
  return activity.filter(item => item.patientId === patient.id && item.date).reduce((latest, item) => item.date > latest ? item.date : latest, patient.createdAt);
}

export function listPatients<T extends PatientListItem>(patients: readonly T[], options: {
  query?: string; sort: PatientSort; filter?: PatientFilter; tag?: string;
  plannedPatientIds?: readonly number[]; upcomingPatientIds?: readonly number[]; recordPatientIds?: readonly number[];
  activity?: readonly ActivityStamp[];
}): T[] {
  const terms = normalizeSearch(options.query ?? '').split(/\s+/).filter(Boolean);
  const planned = new Set(options.plannedPatientIds);
  const upcoming = new Set(options.upcomingPatientIds);
  const recorded = new Set(options.recordPatientIds);
  const tag = normalizeSearch(options.tag ?? '');
  const filtered = patients.filter(patient => {
    const searchable = normalizeSearch([patient.name, patient.nickname, patient.phone, patient.cpf, patient.tags, patient.goal,
      patient.phone?.replace(/\D/g, ''), patient.cpf?.replace(/\D/g, '')].filter(Boolean).join(' '));
    if (!terms.every(term => searchable.includes(term))) return false;
    if (tag && !patientTags(patient.tags).some(value => normalizeSearch(value) === tag)) return false;
    switch (options.filter) {
      case 'withPlan': return planned.has(patient.id);
      case 'withoutPlan': return !planned.has(patient.id);
      case 'upcoming': return upcoming.has(patient.id);
      case 'withoutRecord': return !recorded.has(patient.id);
      case 'gestante': return patient.biologicalCondition === 'Gestante';
      case 'lactante': return patient.biologicalCondition === 'Lactante';
      default: return true;
    }
  });
  const collator = new Intl.Collator('pt-BR', {sensitivity: 'base', numeric: true});
  const lastActivity = new Map(patients.map(patient => [patient.id, patient.createdAt]));
  for (const item of options.activity ?? []) {
    if (item.date > (lastActivity.get(item.patientId) ?? '')) lastActivity.set(item.patientId, item.date);
  }
  return filtered.sort((a, b) => {
    const byName = () => collator.compare(a.name, b.name) || a.id - b.id;
    if (options.sort === 'created') return b.createdAt.localeCompare(a.createdAt) || byName();
    if (options.sort === 'activity') return (lastActivity.get(b.id) ?? '').localeCompare(lastActivity.get(a.id) ?? '') || byName();
    return byName();
  });
}

function calendarDate(day: string) {
  const [year, month, date] = day.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12));
}

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }

export function shiftCalendarDay(day: string, offset: number) {
  const date = calendarDate(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return dateKey(date);
}

export function calendarDays(anchor: string, view: 'month' | 'week') {
  const date = calendarDate(anchor);
  if (view === 'month') date.setUTCDate(1);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const start = dateKey(date);
  return Array.from({length: view === 'month' ? 42 : 7}, (_, index) => shiftCalendarDay(start, index));
}

export function calendarRange(anchor: string, view: CalendarView) {
  if (view !== 'list') {
    const days = calendarDays(anchor, view);
    return {start: days[0], end: days[days.length - 1]};
  }
  const date = calendarDate(anchor);
  date.setUTCDate(1);
  const start = dateKey(date);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return {start, end: dateKey(date)};
}

export function shiftCalendarPeriod(anchor: string, view: CalendarView, direction: number) {
  if (view === 'week') return shiftCalendarDay(anchor, direction * 7);
  const date = calendarDate(anchor);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + direction);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return dateKey(date);
}

export function appointmentsOnDay<T extends {id: number; startsAt: string}>(appointments: readonly T[], day: string): T[] {
  return appointments.filter(appointment => appointment.startsAt.slice(0, 10) === day)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
}
