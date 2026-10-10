package com.napo.alarm

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NapoAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NapoAlarm")

    Function("isAvailable") {
      true
    }

    AsyncFunction("scheduleAlarm") { id: String, title: String?, body: String?, triggerAtMillis: Double, recurrenceType: String? ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      requestNotificationPermissionIfNeeded()

      NapoAlarmScheduler.schedule(
        context,
        id,
        title ?: "NAPO alarma",
        body ?: "Ai o alarma programata.",
        triggerAtMillis.toLong(),
        recurrenceType ?: "NONE"
      )

      true
    }

    AsyncFunction("cancelAlarm") { id: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      NapoAlarmScheduler.cancel(context, id)
      true
    }
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return
    }

    val activity = appContext.currentActivity ?: return
    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
      return
    }

    ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 24051)
  }
}
