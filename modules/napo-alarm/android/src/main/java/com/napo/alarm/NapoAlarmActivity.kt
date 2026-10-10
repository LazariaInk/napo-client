package com.napo.alarm

import android.app.Activity
import android.app.NotificationManager
import android.app.KeyguardManager
import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class NapoAlarmActivity : Activity() {
  private var ringtone: Ringtone? = null
  private var vibrator: Vibrator? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    startAlarmSound()
    startVibration()
    renderContent()
  }

  override fun onDestroy() {
    stopAlarm()
    super.onDestroy()
  }

  private fun showOverLockScreen() {
    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
    )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      keyguardManager.requestDismissKeyguard(this, null)
    }
  }

  private fun renderContent() {
    val title = intent.getStringExtra(NapoAlarmScheduler.EXTRA_TITLE) ?: "NAPO alarma"
    val body = intent.getStringExtra(NapoAlarmScheduler.EXTRA_BODY) ?: "Ai o alarma programata."

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(48, 48, 48, 48)
      setBackgroundColor(android.graphics.Color.WHITE)
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    val titleView = TextView(this).apply {
      text = title
      textSize = 28f
      gravity = Gravity.CENTER
      setTextColor(android.graphics.Color.rgb(23, 23, 23))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    val bodyView = TextView(this).apply {
      text = body
      textSize = 18f
      gravity = Gravity.CENTER
      setTextColor(android.graphics.Color.rgb(80, 80, 80))
      setPadding(0, 24, 0, 44)
    }

    val stopButton = Button(this).apply {
      text = "Opreste alarma"
      textSize = 18f
      setOnClickListener {
        stopAlarm()
        finish()
      }
    }

    root.addView(titleView)
    root.addView(bodyView)
    root.addView(stopButton)
    setContentView(root)
  }

  private fun startAlarmSound() {
    val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

    ringtone = RingtoneManager.getRingtone(applicationContext, alarmUri)?.apply {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      }
      play()
    }
  }

  private fun startVibration() {
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
      manager.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

    val pattern = longArrayOf(0, 700, 400, 700)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(pattern, 0)
    }
  }

  private fun stopAlarm() {
    val reminderId = intent.getStringExtra(NapoAlarmScheduler.EXTRA_ID)
    if (reminderId != null) {
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.cancel(NapoAlarmReceiver.notificationIdForReminder(reminderId))
    }

    ringtone?.stop()
    ringtone = null
    vibrator?.cancel()
    vibrator = null
  }
}
