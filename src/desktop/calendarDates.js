import { dateFromKey, dateKey, validDate } from '../model.js';

export function shiftDate(key, days) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function monthKeyboardDate(key, command) {
  const date = dateFromKey(key);
  const weekday = (date.getDay() + 6) % 7;
  let target;
  switch (command) {
    case 'ArrowLeft':
      target = shiftDate(key, -1);
      break;
    case 'ArrowRight':
      target = shiftDate(key, 1);
      break;
    case 'ArrowUp':
      target = shiftDate(key, -7);
      break;
    case 'ArrowDown':
      target = shiftDate(key, 7);
      break;
    case 'Home':
      target = shiftDate(key, -weekday);
      break;
    case 'End':
      target = shiftDate(key, 6 - weekday);
      break;
    case 'PageUp':
    case 'PageDown': {
      const day = date.getDate();
      // The last day of the destination month also handles shorter months and leap days.
      date.setMonth(date.getMonth() + (command === 'PageUp' ? 0 : 2), 0);
      date.setDate(Math.min(day, date.getDate()));
      target = dateKey(date);
      break;
    }
    default:
      return undefined;
  }
  if (validDate(target)) return target;
  return target.startsWith('0000') ? '0001-01-01' : '9999-12-31';
}
