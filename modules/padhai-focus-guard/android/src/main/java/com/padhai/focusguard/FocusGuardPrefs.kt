package com.padhai.focusguard

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object FocusGuardPrefs {
  private const val PREFS = "padhai_focus_guard"
  private const val BLOCKED_PACKAGES = "blocked_packages"
  private const val APP_DECISION_CACHE = "app_decision_cache"
  private const val APP_CACHE_READY = "app_cache_ready"
  private const val ENABLED = "enabled"
  private const val BREAK_REQUESTED = "break_requested"
  private const val STARTED_AT = "started_at"
  // Bump whenever the classifier, hard-deny rules, or verified study catalog changes.
  private const val POLICY_REVISION = "2026-08-25-study-catalog-2"

  fun get(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /**
   * The second argument is retained only for binary/source compatibility with
   * older JS bundles. It is deliberately ignored so no user-managed allowlist
   * can be persisted anymore.
   */
  fun setPackages(context: Context, blocked: List<String>, ignoredAllowed: List<String> = emptyList()) {
    setBlockedPackages(context, blocked)
  }

  fun setBlockedPackages(context: Context, blocked: List<String>) {
    val normalized = JSONArray(blocked.distinct()).toString()
    val preferences = get(context)
    if (preferences.getString(BLOCKED_PACKAGES, null) == normalized) return
    preferences.edit()
      .putString(BLOCKED_PACKAGES, normalized)
      .remove(APP_DECISION_CACHE)
      .putBoolean(APP_CACHE_READY, false)
      .apply()
  }

  fun blocked(context: Context): Set<String> = packages(context, BLOCKED_PACKAGES)

  fun packages(context: Context, key: String): Set<String> {
    val raw = get(context).getString(key, "[]") ?: "[]"
    return runCatching {
      val array = JSONArray(raw)
      buildSet {
        for (index in 0 until array.length()) add(array.getString(index))
      }
    }.getOrDefault(emptySet())
  }

  fun cachedDecision(context: Context, packageName: String, versionCode: Long): Boolean? {
    val raw = get(context).getString(APP_DECISION_CACHE, "{}") ?: "{}"
    return runCatching {
      val entry = JSONObject(raw).optJSONObject(packageName) ?: return null
      if (entry.optLong("versionCode", Long.MIN_VALUE) != versionCode) return null
      if (entry.optString("policyRevision", "") != POLICY_REVISION) return null
      if (!entry.has("allowed")) null else entry.optBoolean("allowed")
    }.getOrNull()
  }

  fun saveDecision(context: Context, packageName: String, versionCode: Long, allowed: Boolean) {
    val preferences = get(context)
    val raw = preferences.getString(APP_DECISION_CACHE, "{}") ?: "{}"
    val cache = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
    cache.put(packageName, JSONObject()
      .put("versionCode", versionCode)
      .put("policyRevision", POLICY_REVISION)
      .put("allowed", allowed))
    preferences.edit().putString(APP_DECISION_CACHE, cache.toString()).apply()
  }

  fun clearDecisionCache(context: Context) {
    get(context).edit().remove(APP_DECISION_CACHE).putBoolean(APP_CACHE_READY, false).apply()
  }

  fun appDecisionCacheReady(context: Context): Boolean = get(context).getBoolean(APP_CACHE_READY, false)

  fun markAppDecisionCacheReady(context: Context) {
    get(context).edit().putBoolean(APP_CACHE_READY, true).apply()
  }

  fun setEnabled(context: Context, enabled: Boolean) {
    get(context).edit().putBoolean(ENABLED, enabled).apply()
  }

  fun setStartedAt(context: Context, epochMs: Long) {
    get(context).edit().putLong(STARTED_AT, epochMs).apply()
  }

  fun startedAt(context: Context): Long = get(context).getLong(STARTED_AT, 0L)

  fun enabled(context: Context): Boolean = get(context).getBoolean(ENABLED, false)

  fun requestBreak(context: Context) {
    get(context).edit().putBoolean(BREAK_REQUESTED, true).apply()
  }

  fun consumeBreak(context: Context): Boolean {
    val requested = get(context).getBoolean(BREAK_REQUESTED, false)
    if (requested) get(context).edit().putBoolean(BREAK_REQUESTED, false).apply()
    return requested
  }
}
