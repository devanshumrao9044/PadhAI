package com.padhai.focusguard

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PadhAIFocusGuardModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is unavailable" }

  override fun definition() = ModuleDefinition {
    Name("PadhAIFocusGuard")

    Function("getStatus") {
      mapOf(
        "available" to true,
        "overlay" to canDrawOverlay(),
        "usageStats" to hasUsageStatsAccess(),
        "enabled" to FocusGuardPrefs.enabled(context),
      )
    }

    Function("configure") { blockedPackages: List<String>, ignoredAllowedPackages: List<String> ->
      // The legacy second parameter is intentionally ignored. User-managed
      // allowlisting was removed; native policy is now zero-trust and automatic.
      FocusGuardPrefs.setBlockedPackages(context, blockedPackages)
    }

    Function("refreshAppDecisionCache") {
      FocusGuardAppPolicy.warmInstalledCache(context, force = true)
      true
    }

    Function("start") {
      val canStart = canDrawOverlay() && hasUsageStatsAccess()
      if (canStart) {
        // Remove legacy JS block state before starting the native policy engine.
        FocusGuardPrefs.clearLegacyBlockedPackages(context)
        FocusGuardAppPolicy.warmInstalledCache(context)
        FocusGuardPrefs.setEnabled(context, true)
        // Do not reset an already-running native session. The overlay timer is
        // based on this persisted value and must survive app/foreground changes.
        if (FocusGuardPrefs.startedAt(context) <= 0L) {
          FocusGuardPrefs.setStartedAt(context, System.currentTimeMillis())
        }
        PadhAIFocusGuardService.start(context)
      }
      canStart
    }

    Function("stop") {
      FocusGuardPrefs.setEnabled(context, false)
      FocusGuardPrefs.setStartedAt(context, 0L)
      FocusGuardPrefs.clearRecentAllowedLaunch(context)
      PadhAIFocusGuardService.stop(context)
    }

    Function("consumeBreakRequest") {
      FocusGuardPrefs.consumeBreak(context)
    }

    Function("getInstalledApps") {
      FocusGuardAppPolicy.listInstalledApps(context)
    }

    Function("launchStudyApp") { packageName: String ->
      val decision = FocusGuardAppPolicy.decide(context, packageName)
      if (!decision.allowed || packageName == context.packageName) return@Function false
      val launchIntent = when (packageName) {
        "com.android.settings", "com.samsung.android.settings", "com.google.android.permissioncontroller", "com.android.permissioncontroller" -> Intent(Settings.ACTION_SETTINGS)
        else -> context.packageManager.getLaunchIntentForPackage(packageName)
      } ?: return@Function false
      // UsageStats may report the previous foreground activity for one or two
      // polling cycles. Mark only this policy-approved, PadhAI-initiated launch
      // for a short window so that race cannot immediately trigger the blocker.
      FocusGuardPrefs.recordAllowedLaunch(context, packageName)
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launchIntent)
      true
    }

    Function("openOverlaySettings") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("openUsageStatsSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private fun canDrawOverlay(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

  private fun hasUsageStatsAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
