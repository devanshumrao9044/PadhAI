package com.padhai.focusguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.TimeUnit

class PadhAIFocusGuardService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var blockOverlay: View? = null
  private var focusOverlay: View? = null
  private var focusTimerText: TextView? = null
  private var firstBlockedAt = 0L
  private var lastBlockedPackage: String? = null

  private val poll = object : Runnable {
    override fun run() {
      if (!FocusGuardPrefs.enabled(this@PadhAIFocusGuardService)) {
        removeBlockOverlay()
        removeFocusOverlay()
        stopSelf()
        return
      }
      checkForegroundPackage()
      handler.postDelayed(this, POLL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    startForegroundIfPossible()
    handler.post(poll)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    removeBlockOverlay()
    removeFocusOverlay()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun checkForegroundPackage() {
    val foreground = currentForegroundPackage() ?: return
    val decision = FocusGuardAppPolicy.decide(this, foreground)
    // The native policy is the single source of truth. Do not let a legacy
    // persisted JS blocked list override a verified catalog decision.
    val isBlocked = !decision.allowed

    if (foreground == applicationContext.packageName) {
      firstBlockedAt = 0L
      lastBlockedPackage = null
      removeBlockOverlay()
      removeFocusOverlay()
      return
    }

    if (!isBlocked) {
      firstBlockedAt = 0L
      lastBlockedPackage = null
      removeBlockOverlay()
      showFocusOverlay()
      return
    }

    removeFocusOverlay()
    val now = System.currentTimeMillis()
    if (lastBlockedPackage != foreground) {
      lastBlockedPackage = foreground
      firstBlockedAt = now
      showBlockOverlay()
    } else if (now - firstBlockedAt >= WARNING_GRACE_MS) {
      FocusGuardPrefs.requestBreak(this)
      showBlockOverlay(broken = true)
    }
  }

  private fun currentForegroundPackage(): String? {
    val usageStats = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
    val end = System.currentTimeMillis()
    val begin = end - TimeUnit.SECONDS.toMillis(10)
    val events = usageStats.queryEvents(begin, end)
    val event = UsageEvents.Event()
    var latestPackage: String? = null
    var latestTime = 0L
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED && event.timeStamp >= latestTime) {
        latestTime = event.timeStamp
        latestPackage = event.packageName
      }
    }
    return latestPackage
  }

  private fun showFocusOverlay() {
    if (!Settings.canDrawOverlays(this)) return
    val manager = getSystemService(WINDOW_SERVICE) as WindowManager
    if (focusOverlay == null) {
      val layout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(22, 10, 22, 10)
        setBackgroundColor(Color.parseColor("#E62B1B4D"))
      }
      val title = TextView(this).apply {
        text = "PadhAI Focus  "
        textSize = 12f
        setTextColor(Color.WHITE)
      }
      focusTimerText = TextView(this).apply {
        textSize = 14f
        setTextColor(Color.WHITE)
        setTypeface(typeface, android.graphics.Typeface.BOLD)
      }
      layout.addView(title)
      layout.addView(focusTimerText)
      focusOverlay = layout
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
      }
      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT,
      ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = 24
      }
      runCatching { manager.addView(layout, params) }
    }
    val elapsedSeconds = if (FocusGuardPrefs.startedAt(this) > 0L) {
      ((System.currentTimeMillis() - FocusGuardPrefs.startedAt(this)) / 1000L).coerceAtLeast(0L)
    } else {
      0L
    }
    focusTimerText?.text = formatElapsed(elapsedSeconds)
  }

  private fun removeFocusOverlay() {
    val view = focusOverlay ?: return
    val manager = getSystemService(WINDOW_SERVICE) as WindowManager
    runCatching { manager.removeView(view) }
    focusOverlay = null
    focusTimerText = null
  }

  private fun showBlockOverlay(broken: Boolean = false) {
    if (!Settings.canDrawOverlays(this)) return
    val manager = getSystemService(WINDOW_SERVICE) as WindowManager
    if (blockOverlay == null) {
      val layout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(48, 48, 48, 48)
        setBackgroundColor(Color.parseColor("#F8F7FF"))
      }
      val title = TextView(this).apply {
        textSize = 24f
        setTextColor(Color.parseColor("#2B1B4D"))
        gravity = Gravity.CENTER
      }
      val body = TextView(this).apply {
        textSize = 16f
        setTextColor(Color.parseColor("#554B6B"))
        gravity = Gravity.CENTER
        setPadding(0, 24, 0, 24)
      }
      val returnButton = Button(this).apply {
        text = "Return to PadhAI"
        setOnClickListener { openPadhAI() }
      }
      layout.addView(title)
      layout.addView(body)
      layout.addView(returnButton)
      layout.tag = OverlayParts(title, body)
      blockOverlay = layout
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
      }
      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT,
      ).apply { gravity = Gravity.CENTER }
      runCatching { manager.addView(layout, params) }
    }

    val parts = (blockOverlay as? LinearLayout)?.tag as? OverlayParts ?: return
    parts.title.text = if (broken) "Focus session paused" else "Focus mode is active"
    parts.body.text = if (broken) {
      "This app is blocked by PadhAI's automatic Focus policy. Return to PadhAI to end the session."
    } else {
      "Return to PadhAI. Only verified study or essential system apps can run during Focus."
    }
  }

  private fun removeBlockOverlay() {
    val view = blockOverlay ?: return
    val manager = getSystemService(WINDOW_SERVICE) as WindowManager
    runCatching { manager.removeView(view) }
    blockOverlay = null
  }

  private fun openPadhAI() {
    val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse("padhai://focus/active"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    runCatching { startActivity(intent) }
  }

  private fun startForegroundIfPossible() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "PadhAI Focus Guard", NotificationManager.IMPORTANCE_LOW)
    getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    val notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("PadhAI Focus mode")
      .setContentText("Focus Guard is active")
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setOngoing(true)
      .build()
    runCatching { startForeground(NOTIFICATION_ID, notification) }
  }

  private fun formatElapsed(seconds: Long): String {
    val minutes = seconds / 60L
    val remainingSeconds = seconds % 60L
    return "%02d:%02d".format(minutes, remainingSeconds)
  }

  private data class OverlayParts(val title: TextView, val body: TextView)

  companion object {
    private const val POLL_MS = 750L
    private const val WARNING_GRACE_MS = 5_000L
    private const val CHANNEL_ID = "padhai_focus_guard"
    private const val NOTIFICATION_ID = 4431
    fun start(context: Context) {
      if (!FocusGuardPrefs.enabled(context)) return
      val intent = Intent(context, PadhAIFocusGuardService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, PadhAIFocusGuardService::class.java))
    }
  }
}
