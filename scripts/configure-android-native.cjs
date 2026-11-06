/**
 * @file configure-android-native.cjs
 * @description Script determinista de configuración nativa Android para InkFlow Studio en Tauri v2.
 * 
 * Acciones:
 * 1. Inyecta permisos de Scoped Storage, vibración y WakeLock en AndroidManifest.xml.
 * 2. Inyecta largeHeap, hardwareAccelerated y requestLegacyExternalStorage en <application>.
 * 3. Inyecta FileProvider para compartir ilustraciones con WhatsApp, Instagram, Google Fotos, etc.
 * 4. Genera res/xml/file_paths.xml con rutas de caché y Pictures/InkFlow Studio.
 * 5. Copia el puente nativo Kotlin (AndroidPlatformBridge.kt) al paquete de compilación Android.
 * 6. Inyecta Modo Pantalla Completa Inmersivo y @JavascriptInterface InkFlowNativeBridge en MainActivity.kt.
 */

const fs = require('fs');
const path = require('path');

function configureAndroidManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ AndroidManifest.xml no encontrado en:', manifestPath);
    return false;
  }

  let manifest = fs.readFileSync(manifestPath, 'utf8');

  // 1. Inyectar permisos de Scoped Storage y rendimiento dentro de <manifest>
  const permissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
    '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />'
  ];

  for (const perm of permissions) {
    const match = perm.match(/android:name="([^"]+)"/);
    if (match && !manifest.includes(match[1])) {
      manifest = manifest.replace(/(<manifest[^>]*>)/, `$1\n    ${perm}`);
    }
  }

  // 2. Inyectar largeHeap, hardwareAccelerated y requestLegacyExternalStorage en <application>
  if (!manifest.includes('android:largeHeap')) {
    manifest = manifest.replace(
      /(<application)/,
      `$1 android:largeHeap="true" android:hardwareAccelerated="true" android:requestLegacyExternalStorage="true"`
    );
  }

  // 3. Inyectar configChanges, windowSoftInputMode y theme fullscreen en <activity>
  if (manifest.includes('android:configChanges')) {
    manifest = manifest.replace(
      /android:configChanges="[^"]*"/,
      'android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|uiMode"'
    );
  } else {
    manifest = manifest.replace(
      /(<activity[^>]*)/,
      '$1 android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|uiMode"'
    );
  }

  if (!manifest.includes('android:windowSoftInputMode')) {
    manifest = manifest.replace(
      /(<activity[^>]*)/,
      '$1 android:windowSoftInputMode="adjustResize|stateHidden"'
    );
  } else {
    manifest = manifest.replace(
      /android:windowSoftInputMode="[^"]*"/,
      'android:windowSoftInputMode="adjustResize|stateHidden"'
    );
  }

  if (!manifest.includes('android:theme')) {
    manifest = manifest.replace(
      /(<activity[^>]*)/,
      '$1 android:theme="@android:style/Theme.NoTitleBar.Fullscreen"'
    );
  }

  // 4. Inyectar FileProvider para compartir imágenes si no está presente
  if (!manifest.includes('androidx.core.content.FileProvider')) {
    const fileProviderSnippet = `
        <!-- FileProvider para compartir ilustraciones de InkFlow Studio -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="com.inkflow.studio.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>`;
    manifest = manifest.replace(/<\/application>/, fileProviderSnippet);
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✅ AndroidManifest.xml parcheado con éxito en:', manifestPath);
  return true;
}

function ensureFilePathsXml(resDir) {
  if (!fs.existsSync(resDir)) {
    console.warn('⚠️ Directorio res no encontrado en:', resDir);
    return;
  }
  const xmlDir = path.join(resDir, 'xml');
  if (!fs.existsSync(xmlDir)) {
    fs.mkdirSync(xmlDir, { recursive: true });
  }

  const filePathsContent = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="shared_drawings" path="shared_drawings" />
    <external-path name="external_pictures" path="Pictures/InkFlow Studio" />
    <external-files-path name="external_files" path="." />
</paths>
`;
  const filePath = path.join(xmlDir, 'file_paths.xml');
  fs.writeFileSync(filePath, filePathsContent, 'utf8');
  console.log('✅ res/xml/file_paths.xml generado exitosamente en:', filePath);
}

function copyKotlinPlatformBridge(javaAppDir) {
  const sourceBridge = path.resolve('src/kotlin-core/AndroidPlatformBridge.kt');
  if (!fs.existsSync(sourceBridge)) {
    console.warn('⚠️ Archivo de origen AndroidPlatformBridge.kt no encontrado');
    return;
  }

  // Destino dentro de com/inkflow/studio/platform
  const targetDir = path.join(javaAppDir, 'com/inkflow/studio/platform');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetBridge = path.join(targetDir, 'AndroidPlatformBridge.kt');
  fs.copyFileSync(sourceBridge, targetBridge);
  console.log('✅ AndroidPlatformBridge.kt copiado con éxito a:', targetBridge);
}

function findMainActivity(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.kt') {
      return full;
    }
  }
  return null;
}

function configureMainActivity(javaDir) {
  const mainActivityPath = findMainActivity(javaDir);
  if (!mainActivityPath) {
    console.warn('⚠️ No se encontró MainActivity.kt en:', javaDir);
    return false;
  }

  const code = `package com.inkflow.studio

import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.plugin.PluginManager
import com.inkflow.studio.platform.AndroidGalleryManager
import com.inkflow.studio.platform.AndroidScreenWakeLockManager
import com.inkflow.studio.platform.InkFlowJavascriptInterface

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setupImmersiveStickyMode()
    setupNativeJavascriptBridge()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      setupImmersiveStickyMode()
    }
  }

  private fun setupImmersiveStickyMode() {
    try {
      WindowCompat.setDecorFitsSystemWindows(window, false)
      val insetsController = WindowCompat.getInsetsController(window, window.decorView)
      insetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      insetsController.hide(WindowInsetsCompat.Type.systemBars())
    } catch (_: Exception) {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_FULLSCREEN
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      )
    }
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(i))
        if (found != null) return found
      }
    }
    return null
  }

  private fun setupNativeJavascriptBridge() {
    window.decorView.post {
      try {
        val webView = findWebView(window.decorView)
        if (webView != null) {
          val galleryManager = AndroidGalleryManager(this)
          val wakeLockManager = AndroidScreenWakeLockManager(this)
          val bridge = InkFlowJavascriptInterface(this, galleryManager, wakeLockManager)
          webView.settings.javaScriptEnabled = true
          webView.settings.domStorageEnabled = true
          webView.addJavascriptInterface(bridge, "InkFlowNativeBridge")
          println("✅ InkFlowNativeBridge (@JavascriptInterface) inyectado con éxito en WebView")
        }
      } catch (e: Exception) {
        println("⚠️ Error inyectando InkFlowNativeBridge: " + e.message)
      }
    }
  }
}
`;

  fs.writeFileSync(mainActivityPath, code, 'utf8');
  console.log('✅ MainActivity.kt configurado exitosamente con Modo Inmersivo y puente InkFlowNativeBridge');
  return true;
}

// Ejecución principal
const manifestTarget = path.resolve('src-tauri/gen/android/app/src/main/AndroidManifest.xml');
const javaTargetDir = path.resolve('src-tauri/gen/android/app/src/main/java');
const resTargetDir = path.resolve('src-tauri/gen/android/app/src/main/res');

console.log('🔧 Ejecutando configuración nativa para Android...');
configureAndroidManifest(manifestTarget);
ensureFilePathsXml(resTargetDir);
copyKotlinPlatformBridge(javaTargetDir);
configureMainActivity(javaTargetDir);
console.log('🚀 Configuración nativa completada.');
