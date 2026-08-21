package com.padhai.focusguard

import android.content.Context
import org.json.JSONArray

internal object FocusGuardPrefs {
  private const val PREFS = "padhai_focus_guard"
  private const val BLOCKED_PACKAGES = "blocked_packages"
  private const val ALLOWED_PACKAGES = "allowed_packages"
  private const val ENABLED = "enabled"
  private const val BREAK_REQUESTED = "break_requested"

  fun get(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setPackages(context: Context, blocked: List<String>, allowed: List<String>) {
    get(context).edit()
      .putString(BLOCKED_PACKAGES, JSONArray(blocked.distinct()).toString())
      .putString(ALLOWED_PACKAGES, JSONArray(allowed.distinct()).toString())
      .apply()
  }

  fun packages(context: Context, key: String): Set<String> {
    val raw = get(context).getString(key, "[]") ?: "[]"
    return runCatching {
      val array = JSONArray(raw)
      buildSet {
        for (index in 0 until array.length()) add(array.getString(index))
      }
    }.getOrDefault(emptySet())
  }

  fun blocked(context: Context): Set<String> = packages(context, BLOCKED_PACKAGES)
  fun allowed(context: Context): Set<String> = packages(context, ALLOWED_PACKAGES)

  fun setEnabled(context: Context, enabled: Boolean) {
    get(context).edit().putBoolean(ENABLED, enabled).apply()
  }

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
