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
        FocusGuardAppPolicy.warmInstalledCache(context)
        FocusGuardPrefs.setEnabled(context, true)
        FocusGuardPrefs.setStartedAt(context, System.currentTimeMillis())
        PadhAIFocusGuardService.start(context)
      }
      canStart
    }

    Function("stop") {
      FocusGuardPrefs.setEnabled(context, false)
      FocusGuardPrefs.setStartedAt(context, 0L)
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
      val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: return@Function false
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
