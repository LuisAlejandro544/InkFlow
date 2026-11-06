/**
 * @file configure-android-native.cjs
 * @description Script determinista de configuración nativa Android para InkFlow Studio en Tauri v2.
 * 
 * Acciones:
 * 1. Inyecta permisos de Scoped Storage, vibración y WakeLock en AndroidManifest.xml.
 * 2. Inyecta largeHeap, hardwareAccelerated y requestLegacyExternalStorage en <application>.
 * 3. Configura tema Fullscreen y configChanges en <activity>.
 * 4. Inyecta Modo Pantalla Completa Inmersivo (Immersive Sticky) en MainActivity.kt.
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

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✅ AndroidManifest.xml parcheado con éxito en:', manifestPath);
  return true;
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

  const immersiveCode = `package com.inkflow.studio

import android.os.Bundle
import android.view.View
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.plugin.PluginManager

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setupImmersiveStickyMode()
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
}
`;

  fs.writeFileSync(mainActivityPath, immersiveCode, 'utf8');
  console.log('✅ MainActivity.kt configurado exitosamente con Modo Inmersivo Sticky en:', mainActivityPath);
  return true;
}

// Ejecución principal
const manifestTarget = path.resolve('src-tauri/gen/android/app/src/main/AndroidManifest.xml');
const javaTargetDir = path.resolve('src-tauri/gen/android/app/src/main/java');

console.log('🔧 Ejecutando configuración nativa para Android...');
configureAndroidManifest(manifestTarget);
configureMainActivity(javaTargetDir);
console.log('🚀 Configuración nativa completada.');
