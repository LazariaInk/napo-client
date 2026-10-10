package com.napo.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject

object NapoAlarmScheduler {
  private const val PREFS_NAME = "napo_alarm_store"
  private const val REQUEST_CODE_OFFSET = 44000

  const val EXTRA_ID = "id"
  const val EXTRA_TITLE = "title"
  const val EXTRA_BODY = "body"
  const val EXTRA_RECURRENCE_TYPE = "recurrenceType"
  const val EXTRA_TRIGGER_AT = "triggerAtMillis"

  fun schedule(
    context: Context,
    id: String,
    title: String,
    body: String,
    triggerAtMillis: Long,
    recurrenceType: String
  ) {
    if (triggerAtMillis <= System.currentTimeMillis()) {
      return
    }

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = pendingIntent(context, id, title, body, triggerAtMillis, recurrenceType)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      alarmManager.setAlarmClock(
        AlarmManager.AlarmClockInfo(triggerAtMillis, pendingIntent),
        pendingIntent
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    } else {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    }

    saveAlarm(context, id, title, body, triggerAtMillis, recurrenceType)
  }

  fun cancel(context: Context, id: String) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(pendingIntent(context, id, "", "", 0L, "NONE"))
    removeAlarm(context, id)
  }

  fun rescheduleAll(context: Context) {
    val now = System.currentTimeMillis()
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    prefs.all.values.forEach { value ->
      val json = JSONObject(value as String)
      val id = json.getString(EXTRA_ID)
      val title = json.optString(EXTRA_TITLE, "NAPO alarma")
      val body = json.optString(EXTRA_BODY, "Ai o alarma programata.")
      val recurrenceType = json.optString(EXTRA_RECURRENCE_TYPE, "NONE")
      val triggerAtMillis = json.optLong(EXTRA_TRIGGER_AT)
      val nextTriggerAtMillis = if (triggerAtMillis <= now) {
        nextTriggerAtMillis(triggerAtMillis, recurrenceType)
      } else {
        triggerAtMillis
      }

      if (nextTriggerAtMillis > now) {
        schedule(context, id, title, body, nextTriggerAtMillis, recurrenceType)
      } else {
        removeAlarm(context, id)
      }
    }
  }

  fun rescheduleNextIfNeeded(context: Context, intent: Intent) {
    val id = intent.getStringExtra(EXTRA_ID) ?: return
    val recurrenceType = intent.getStringExtra(EXTRA_RECURRENCE_TYPE) ?: "NONE"
    val previousTriggerAtMillis = intent.getLongExtra(EXTRA_TRIGGER_AT, 0L)
    val nextTriggerAtMillis = nextTriggerAtMillis(previousTriggerAtMillis, recurrenceType)

    if (nextTriggerAtMillis <= System.currentTimeMillis()) {
      removeAlarm(context, id)
      return
    }

    schedule(
      context,
      id,
      intent.getStringExtra(EXTRA_TITLE) ?: "NAPO alarma",
      intent.getStringExtra(EXTRA_BODY) ?: "Ai o alarma programata.",
      nextTriggerAtMillis,
      recurrenceType
    )
  }

  private fun pendingIntent(
    context: Context,
    id: String,
    title: String,
    body: String,
    triggerAtMillis: Long,
    recurrenceType: String
  ): PendingIntent {
    val intent = Intent(context, NapoAlarmReceiver::class.java).apply {
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_BODY, body)
      putExtra(EXTRA_TRIGGER_AT, triggerAtMillis)
      putExtra(EXTRA_RECURRENCE_TYPE, recurrenceType)
    }

    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE_OFFSET + id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun saveAlarm(
    context: Context,
    id: String,
    title: String,
    body: String,
    triggerAtMillis: Long,
    recurrenceType: String
  ) {
    val json = JSONObject()
      .put(EXTRA_ID, id)
      .put(EXTRA_TITLE, title)
      .put(EXTRA_BODY, body)
      .put(EXTRA_TRIGGER_AT, triggerAtMillis)
      .put(EXTRA_RECURRENCE_TYPE, recurrenceType)

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(id, json.toString())
      .apply()
  }

  private fun removeAlarm(context: Context, id: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(id)
      .apply()
  }

  private fun nextTriggerAtMillis(previousTriggerAtMillis: Long, recurrenceType: String): Long {
    return when (recurrenceType) {
      "DAILY" -> previousTriggerAtMillis + 24L * 60L * 60L * 1000L
      "WEEKLY" -> previousTriggerAtMillis + 7L * 24L * 60L * 60L * 1000L
      "MONTHLY" -> addCalendarField(previousTriggerAtMillis, java.util.Calendar.MONTH, 1)
      "YEARLY" -> addCalendarField(previousTriggerAtMillis, java.util.Calendar.YEAR, 1)
      else -> 0L
    }
  }

  private fun addCalendarField(timeMillis: Long, field: Int, amount: Int): Long {
    val calendar = java.util.Calendar.getInstance().apply {
      timeInMillis = timeMillis
      add(field, amount)
    }
    return calendar.timeInMillis
  }
}
