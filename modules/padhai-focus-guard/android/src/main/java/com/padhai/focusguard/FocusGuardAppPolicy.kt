package com.padhai.focusguard

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.telecom.TelecomManager
import android.provider.Telephony
import android.os.Build
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import java.io.ByteArrayOutputStream

internal object FocusGuardAppPolicy {
  private val knownStudyPackages = setOf(
    "com.padhai.app",
    "com.pw.live",
    "xyz.penpencil.physicswala",
    "com.unacademyapp",
    "com.allen",
    "org.khanacademy.android",
    "com.google.android.apps.classroom",
    "com.physicswallah.physicswallah",
    "com.vedantu.app",
    "com.byjus.thelearningapp",
    "com.testbook.app",
    "com.adda247.app",
    "com.embibe.embibe",
    "com.aakash.edutech",
    "com.fiitjee.fiitjee",
    "com.careerwill",
    "com.toppr.dictionary",
    "com.duolingo",
    "com.quizlet.quizletandroid",
    "com.coursera.android",
    "com.udemy.android",
  )

  private val exactHardDenyPackages = setOf(
    "com.google.android.youtube",
    "com.google.android.apps.youtube.music",
    "com.google.android.apps.youtube.kids",
    "com.instagram.android",
    "com.facebook.katana",
    "com.facebook.orca",
    "com.whatsapp",
    "com.snapchat.android",
    "com.twitter.android",
    "com.google.android.apps.playstore",
    "com.android.vending",
    "com.samsung.android.galaxy.store",
    "com.sec.android.app.samsungapps",
    "com.google.android.packageinstaller",
    "com.android.packageinstaller",
    "com.sec.android.easyMover",
    "com.android.chrome",
    "com.chrome.beta",
    "com.chrome.dev",
    "com.microsoft.emmx",
    "com.sec.android.app.sbrowser",
    "com.pubg.imobile",
    "com.tencent.ig",
    "com.dts.freefireth",
    "com.dts.freefiremax",
    "com.supercell.clashofclans",
    "com.supercell.brawlstars",
    "com.activision.callofduty.shooter",
    "com.garena.game.codm",
    "com.roblox.client",
    "com.mobile.legends",
    "com.ea.gp.fifamobile",
    "com.kiloo.subwaysurf",
  )

  private val hardDenyTokens = listOf(
    "youtube",
    "instagram",
    "facebook",
    "tiktok",
    "snapchat",
    "netflix",
    "primevideo",
    "hotstar",
    "spotify",
    "playstore",
    "galaxystore",
    "appstore",
    "vending",
    "packageinstaller",
    "freefire",
    "pubg",
    "callofduty",
    "roblox",
    "mobile.legends",
    "subway",
    "clashofclans",
    "brawlstars",
    "supercell",
    ".game.",
    ".games.",
    ".unity",
    "unity3d",
    "unreal",
    "rovio",
  )

  private val essentialSystemPackages = setOf(
    "android",
    "com.android.systemui",
    "com.android.settings",
    "com.samsung.android.settings",
    "com.google.android.permissioncontroller",
    "com.android.permissioncontroller",
  )

  data class Decision(val allowed: Boolean, val reason: String)

  fun decide(context: Context, packageName: String): Decision {
    val normalized = packageName.trim().lowercase()
    if (normalized.isBlank()) return Decision(false, "empty_package")
    if (normalized == context.packageName.lowercase()) return Decision(true, "self")
    if (isHardDenied(normalized)) return Decision(false, "hard_deny")
    if (isEssentialSystem(context, normalized)) return Decision(true, "essential_system")
    if (normalized in knownStudyPackages) return Decision(true, "known_study")

    val appInfo = runCatching {
      context.packageManager.getApplicationInfo(packageName, PackageManager.MATCH_ALL)
    }.getOrNull() ?: return Decision(false, "not_installed")
    val versionCode = appVersionCode(context, packageName)
    val category = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) appInfo.category else ApplicationInfo.CATEGORY_UNDEFINED
    val catalogCategory = FocusGuardCatalog.categoryFor(context, packageName)
    val catalogDecision = when {
      catalogCategory == "Education" -> Decision(true, "catalog_education")
      catalogCategory == "Books & Reference" -> Decision(true, "catalog_books_reference")
      category == ApplicationInfo.CATEGORY_GAME -> Decision(false, "android_game_category")
      catalogCategory == "Entertainment" -> Decision(false, "catalog_entertainment")
      else -> null
    }
    val decision = catalogDecision
      ?: FocusGuardPrefs.cachedDecision(context, packageName, versionCode)?.let { cached ->
        Decision(cached, "cache")
      }
      ?: Decision(false, "unknown_category")
    FocusGuardPrefs.saveDecision(context, packageName, versionCode, decision.allowed)
    return decision
  }

  fun warmInstalledCache(context: Context, force: Boolean = false) {
    if (!force && FocusGuardPrefs.appDecisionCacheReady(context)) return
    val launcherIntent = android.content.Intent(android.content.Intent.ACTION_MAIN)
      .addCategory(android.content.Intent.CATEGORY_LAUNCHER)
    val packages = context.packageManager.queryIntentActivities(launcherIntent, PackageManager.MATCH_ALL)
      .asSequence()
      .mapNotNull { it.activityInfo?.applicationInfo?.packageName }
      .distinct()
      .toList()
    FocusGuardCatalog.ensureLoaded(context, packages.toSet())
    packages.forEach { decide(context, it) }
    FocusGuardPrefs.markAppDecisionCacheReady(context)
  }

  fun listInstalledApps(context: Context): List<Map<String, Any>> {
    val launcherIntent = android.content.Intent(android.content.Intent.ACTION_MAIN)
      .addCategory(android.content.Intent.CATEGORY_LAUNCHER)
    val packageManager = context.packageManager
    val apps = packageManager.queryIntentActivities(launcherIntent, PackageManager.MATCH_ALL)
      .asSequence()
      .mapNotNull { it.activityInfo?.applicationInfo }
      .filter { it.packageName != context.packageName }
      .distinctBy { it.packageName }
      .toList()
    FocusGuardCatalog.ensureLoaded(context, apps.map { it.packageName }.toSet())
    return apps.map { appInfo ->
        val decision = decide(context, appInfo.packageName)
        mapOf(
          "packageName" to appInfo.packageName,
          "label" to packageManager.getApplicationLabel(appInfo).toString(),
          "allowed" to decision.allowed,
          "reason" to decision.reason,
          "category" to (FocusGuardCatalog.categoryFor(context, appInfo.packageName) ?: applicationCategory(appInfo)),
          "iconBase64" to encodeIcon(context, appInfo),
        )
      }
      .sortedWith(compareByDescending<Map<String, Any>> { it["allowed"] == true }.thenBy { it["label"].toString().lowercase() })
      .toList()
  }

  fun isHardDenied(packageName: String): Boolean {
    val normalized = packageName.lowercase()
    return normalized in exactHardDenyPackages || hardDenyTokens.any { token -> normalized.contains(token) }
  }

  private fun applicationCategory(appInfo: ApplicationInfo): String {
    return when (appInfo.category) {
      ApplicationInfo.CATEGORY_GAME -> "Game"
      ApplicationInfo.CATEGORY_AUDIO -> "Audio"
      ApplicationInfo.CATEGORY_VIDEO -> "Video"
      ApplicationInfo.CATEGORY_IMAGE -> "Image"
      ApplicationInfo.CATEGORY_SOCIAL -> "Social"
      ApplicationInfo.CATEGORY_NEWS -> "News"
      ApplicationInfo.CATEGORY_MAPS -> "Maps"
      ApplicationInfo.CATEGORY_PRODUCTIVITY -> "Productivity"
      ApplicationInfo.CATEGORY_ACCESSIBILITY -> "Accessibility"
      else -> "Uncategorized"
    }
  }

  private fun isEssentialSystem(context: Context, packageName: String): Boolean {
    if (packageName in essentialSystemPackages) return true
    val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
    if (telecom?.defaultDialerPackage?.lowercase() == packageName) return true
    val defaultSms = runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()
    if (defaultSms?.lowercase() == packageName) return true
    return false
  }

  private fun encodeIcon(context: Context, appInfo: ApplicationInfo): String {
    return runCatching {
      val size = 48
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val drawable = appInfo.loadIcon(context.packageManager)
      drawable.setBounds(0, 0, size, size)
      drawable.draw(canvas)
      ByteArrayOutputStream().use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
      }
    }.getOrDefault("")
  }

  private fun appVersionCode(context: Context, packageName: String): Long {
    val packageInfo = runCatching {
      context.packageManager.getPackageInfo(packageName, 0)
    }.getOrNull() ?: return 0L
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      packageInfo.longVersionCode
    } else {
      @Suppress("DEPRECATION")
      packageInfo.versionCode.toLong()
    }
  }
}
