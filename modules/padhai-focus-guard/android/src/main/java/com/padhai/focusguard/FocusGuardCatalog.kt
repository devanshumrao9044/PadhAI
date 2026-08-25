package com.padhai.focusguard

import android.content.Context
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.util.zip.ZipInputStream

/**
 * Reads the generated Play Store category catalog without loading the full CSV
 * or retaining every package name in memory. The archive is scanned once per
 * process and only installed/queried package IDs are retained.
 */
internal object FocusGuardCatalog {
  private const val ASSET_NAME = "focus-app-catalog-v1.zip"
  private val lock = Any()

  @Volatile
  private var loaded = false
  private var indexedTargets: Set<String> = emptySet()
  private var decisions: Map<String, String> = emptyMap()

  fun ensureLoaded(context: Context, targetPackages: Set<String>) {
    val normalizedTargets = targetPackages
      .asSequence()
      .map { it.trim().lowercase() }
      .filter { it.isNotBlank() }
      .toSet()
    if (loaded && indexedTargets.containsAll(normalizedTargets)) return
    synchronized(lock) {
      if (loaded && indexedTargets.containsAll(normalizedTargets)) return
      val targets = normalizedTargets
        .asSequence()
        .map { it.trim().lowercase() }
        .filter { it.isNotBlank() }
        .toSet()
      val found = mutableMapOf<String, String>()

      runCatching {
        context.assets.open(ASSET_NAME).use { asset ->
          ZipInputStream(BufferedInputStream(asset)).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
              if (!entry.isDirectory && entry.name.endsWith(".txt")) {
                val category = categoryForEntry(entry.name)
                if (category != null) {
                  val reader = BufferedReader(InputStreamReader(zip, StandardCharsets.UTF_8))
                  var line = reader.readLine()
                  while (line != null) {
                    val packageName = line.trim().lowercase()
                    if (packageName in targets) found[packageName] = category
                    line = reader.readLine()
                  }
                }
              }
              zip.closeEntry()
              entry = zip.nextEntry
            }
          }
        }
      }

      decisions = decisions + found
      indexedTargets = indexedTargets + targets
      loaded = true
    }
  }

  fun categoryFor(context: Context, packageName: String): String? {
    val normalized = packageName.trim().lowercase()
    ensureLoaded(context, setOf(normalized))
    return decisions[normalized]
  }

  private fun categoryForEntry(entryName: String): String? {
    val fileName = entryName.substringAfterLast('/').removeSuffix(".txt")
    return when {
      fileName == "allow_education" || fileName == "allow_educational" -> "Education"
      fileName == "allow_books_and_reference" -> "Books & Reference"
      fileName.startsWith("block_") -> "Entertainment"
      else -> null
    }
  }
}
