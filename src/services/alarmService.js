import { Platform } from 'react-native';
import NapoAlarm from '../../modules/napo-alarm';

const LOCAL_ALARM_CHANNEL = 'LOCAL_ALARM';
const PENDING_STATUS = 'PENDING';

function isAndroid() {
  return Platform.OS === 'android';
}

function isNativeAlarmAvailable() {
  return Boolean(NapoAlarm?.isAvailable?.());
}

function isLocalAlarmReminder(reminder) {
  return reminder?.preferredChannel === LOCAL_ALARM_CHANNEL;
}

function hasRequiredAlarmFields(reminder) {
  return Boolean(reminder?.id && reminder?.remindAt);
}

function logAlarmAction(action, payload) {
  console.log(`[alarmService] ${action}`, payload);
}

function warnSkipped(action, reason, payload) {
  console.warn(`[alarmService] skipped ${action}: ${reason}`, payload);
}

function parseReminderDate(remindAt) {
  const date = new Date(remindAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function addMonths(date, amount) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + amount);
  return nextDate;
}

function addYears(date, amount) {
  const nextDate = new Date(date);
  nextDate.setFullYear(nextDate.getFullYear() + amount);
  return nextDate;
}

function nextTriggerDate(reminder) {
  const firstDate = parseReminderDate(reminder.remindAt);
  if (!firstDate) return null;

  const recurrenceType = reminder.recurrenceType || 'NONE';
  const now = new Date();

  if (firstDate > now || recurrenceType === 'NONE') {
    return firstDate;
  }

  let candidate = new Date(firstDate);

  while (candidate <= now) {
    if (recurrenceType === 'DAILY') {
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    } else if (recurrenceType === 'WEEKLY') {
      candidate = new Date(candidate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (recurrenceType === 'MONTHLY') {
      candidate = addMonths(candidate, 1);
    } else if (recurrenceType === 'YEARLY') {
      candidate = addYears(candidate, 1);
    } else {
      return null;
    }
  }

  return candidate;
}

function buildNativeAlarm(reminder) {
  const triggerDate = nextTriggerDate(reminder);
  if (!triggerDate || triggerDate.getTime() <= Date.now()) {
    return null;
  }

  return {
    id: String(reminder.id),
    title: reminder.title || 'NAPO alarma',
    body: reminder.messageToSend || reminder.description || 'Ai o alarma programata.',
    triggerAtMillis: triggerDate.getTime(),
    recurrenceType: reminder.recurrenceType || 'NONE',
  };
}

async function ensureCanUseNativeAlarm(action, payload) {
  if (!isAndroid()) {
    warnSkipped(action, 'native alarms are implemented only for Android for now', { platform: Platform.OS });
    return false;
  }

  if (!isNativeAlarmAvailable()) {
    warnSkipped(action, 'NapoAlarm native module is not available; rebuild the Android development app', payload);
    return false;
  }

  return true;
}

export async function scheduleReminderAlarm(reminder) {
  if (!isLocalAlarmReminder(reminder)) {
    warnSkipped('schedule', 'not a local alarm reminder', { id: reminder?.id, preferredChannel: reminder?.preferredChannel });
    return false;
  }

  if (!hasRequiredAlarmFields(reminder)) {
    warnSkipped('schedule', 'missing reminder.id or reminder.remindAt', reminder);
    return false;
  }

  if (!(await ensureCanUseNativeAlarm('schedule', reminder))) {
    return false;
  }

  const alarm = buildNativeAlarm(reminder);
  if (!alarm) {
    warnSkipped('schedule', 'invalid or past non-recurring reminder.remindAt', reminder);
    return false;
  }

  try {
    await NapoAlarm.scheduleAlarm(alarm.id, alarm.title, alarm.body, alarm.triggerAtMillis, alarm.recurrenceType);
    logAlarmAction('scheduled Android native alarm', alarm);
    return true;
  } catch (exception) {
    warnSkipped('schedule', exception.message, exception);
    return false;
  }
}

export async function cancelReminderAlarm(reminderId) {
  if (!reminderId) {
    warnSkipped('cancel', 'missing reminder id', { reminderId });
    return false;
  }

  if (!(await ensureCanUseNativeAlarm('cancel', { reminderId }))) {
    return false;
  }

  try {
    await NapoAlarm.cancelAlarm(String(reminderId));
    logAlarmAction('cancelled Android native alarm', { id: reminderId });
    return true;
  } catch (exception) {
    warnSkipped('cancel', exception.message, exception);
    return false;
  }
}

export async function rescheduleReminderAlarm(reminder) {
  if (!isLocalAlarmReminder(reminder)) {
    warnSkipped('reschedule', 'not a local alarm reminder', { id: reminder?.id, preferredChannel: reminder?.preferredChannel });
    return false;
  }

  if (!hasRequiredAlarmFields(reminder)) {
    warnSkipped('reschedule', 'missing reminder.id or reminder.remindAt', reminder);
    return false;
  }

  await cancelReminderAlarm(reminder.id);
  return scheduleReminderAlarm(reminder);
}

export async function syncReminderAlarms(reminders = []) {
  if (!Array.isArray(reminders)) {
    warnSkipped('sync', 'reminders is not an array', reminders);
    return;
  }

  const pendingLocalAlarms = reminders.filter((reminder) => {
    return reminder?.status === PENDING_STATUS && isLocalAlarmReminder(reminder);
  });

  logAlarmAction('syncing pending Android native alarms', {
    received: reminders.length,
    localAlarmCount: pendingLocalAlarms.length,
  });

  await Promise.all(pendingLocalAlarms.map(scheduleReminderAlarm));
}
