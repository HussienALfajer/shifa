// Spike 0.3-S7 push probe. Two flavors: `compliant` (shows every message) and `noshow` (a
// second app instance that logs foreground messages without showing them, criterion 5).
// The owner may change the ids before registering them in Firebase (slice 0.3-S7b).
plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// google-services.json is the owner's untracked Firebase config (ADR-0026). Without it the
// plugin is not applied, so `flutter analyze` and `flutter test` (and CI) need no Firebase.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "dev.shifa.spike.s7push"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // flutter_local_notifications needs core library desugaring.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Spike only: never the real patient app's id.
        applicationId = "dev.shifa.spike.s7push"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // AGP 9 turns resValue off by default; the flavors name the app with it.
    buildFeatures {
        resValues = true
    }

    flavorDimensions += "behaviour"
    productFlavors {
        create("compliant") {
            dimension = "behaviour"
            resValue("string", "app_name", "مسبار التنبيهات")
        }
        create("noshow") {
            dimension = "behaviour"
            applicationIdSuffix = ".noshow"
            resValue("string", "app_name", "مسبار التنبيهات (صامت)")
        }
    }

    buildTypes {
        release {
            // Throwaway spike: debug signing so `flutter run --release` works on the emulator.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
