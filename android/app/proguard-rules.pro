# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# AdMob (Google Mobile Ads)
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.ads.identifier.** { *; }
-dontwarn com.google.android.gms.ads.**

# RevenueCat (Purchases SDK)
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# PostHog
-keep class com.posthog.** { *; }
-dontwarn com.posthog.**
