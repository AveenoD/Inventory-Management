# ===== Google ML Kit Barcode Scanning (used by mobile_scanner) =====
# ML Kit loads internal classes via reflection; R8 must not rename/remove them.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.internal.mlkit_vision_barcode.**

# mobile_scanner plugin
-keep class dev.steenbakker.mobile_scanner.** { *; }
-dontwarn dev.steenbakker.mobile_scanner.**

# Keep ML Kit text/vision common (defensive)
-keep class com.google.android.gms.common.** { *; }

# Flutter
-keep class io.flutter.** { *; }
-dontwarn io.flutter.**
