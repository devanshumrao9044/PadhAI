# Focus app catalog

`focus-app-catalog-v1.zip` is generated from the public Kaggle dataset [`gauthamp10/google-playstore-apps`](https://www.kaggle.com/datasets/gauthamp10/google-playstore-apps). The source snapshot was collected in June 2021; it is not live Play Store data.

The archive contains sorted package-ID text files for the `Education`, `Educational`, and `Books & Reference` categories, plus entertainment/game-oriented categories used for the blocking profile. The complete 2.3-million-row CSV is not bundled. The native module scans the archive once and retains only matches for launchable packages on the current device.

The catalog is a classification input, not the security boundary. Native hard-deny rules run first and always override catalog entries. Unknown, malformed, missing, or stale package IDs remain blocked. A future remote catalog must be signed and verified before replacing this bundled catalog; an unsigned public file must never auto-allow an app.

To regenerate the archive after obtaining a newer dataset:

```bash
python3 scripts/build_padhai_catalog.py
cp catalog/focus-app-catalog-v1.zip modules/padhai-focus-guard/android/src/main/assets/focus-app-catalog-v1.zip
```

The generator intentionally stores package IDs only, so app labels and descriptions cannot silently grant access. Android signing-certificate verification should be added to a future catalog revision before supporting remote self-updates.
