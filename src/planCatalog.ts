const frequencies = [
  { days: 2, price: 1750 },
  { days: 3, price: 2100 },
  { days: 5, price: 2600 },
]
const durations = [
  { label: 'Mensual', months: 1 },
  { label: 'Trimestral', months: 3 },
  { label: 'Semestral', months: 6 },
  { label: 'Anual', months: 12 },
]
export const planCatalog = durations.flatMap(duration => frequencies.map(frequency => ({
  name: duration.label + ' · ' + frequency.days + ' días por semana',
  months: duration.months,
  days: frequency.days,
  price: frequency.price * duration.months,
})))
