package com.napo.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NapoAlarmBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      NapoAlarmScheduler.rescheduleAll(context)
    }
  }
}
