package com.napo.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

class NapoAlarmReceiver : BroadcastReceiver() {
  companion object {
    fun notificationIdForReminder(reminderId: String): Int {
      return 99000 + reminderId.hashCode()
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val activityIntent = Intent(context, NapoAlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtras(intent)
    }

    showFullScreenAlarm(context, activityIntent, intent)

    try {
      context.startActivity(activityIntent)
    } catch (_: Exception) {
      // Android and some OEM builds may block direct background launches.
      // The full-screen alarm notification above is the official fallback.
    }

    NapoAlarmScheduler.rescheduleNextIfNeeded(context, intent)
  }

  private fun showFullScreenAlarm(context: Context, activityIntent: Intent, sourceIntent: Intent) {
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = "napo-native-alarms"
    val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "NAPO alarme",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Alarme locale NAPO"
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        enableVibration(true)
        setSound(
          alarmUri,
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
      }

      notificationManager.createNotificationChannel(channel)
    }

    val reminderId = sourceIntent.getStringExtra(NapoAlarmScheduler.EXTRA_ID) ?: "unknown"
    val title = sourceIntent.getStringExtra(NapoAlarmScheduler.EXTRA_TITLE) ?: "NAPO alarma"
    val body = sourceIntent.getStringExtra(NapoAlarmScheduler.EXTRA_BODY) ?: "Ai o alarma programata."
    val pendingIntent = PendingIntent.getActivity(
      context,
      88000 + reminderId.hashCode(),
      activityIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setSound(alarmUri)
      .setVibrate(longArrayOf(0, 700, 400, 700))
      .setContentIntent(pendingIntent)
      .setFullScreenIntent(pendingIntent, true)
      .build()

    notificationManager.notify(notificationIdForReminder(reminderId), notification)
  }
}
