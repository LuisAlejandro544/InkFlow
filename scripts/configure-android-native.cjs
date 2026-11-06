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

  // 5. Inyectar Actividad de Diagnóstico & Debug si no está presente
  if (!manifest.includes('DiagnosticMonitorActivity')) {
    const monitorActivitySnippet = `
        <!-- App Acompañante de Diagnóstico & Debug:
             Aparece como app independiente ("InkFlow Monitor") en el teléfono del usuario -->
        <activity
            android:name=".DiagnosticMonitorActivity"
            android:label="InkFlow Monitor"
            android:icon="@mipmap/ic_launcher"
            android:exported="true"
            android:theme="@android:style/Theme.NoTitleBar"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|uiMode"
            android:windowSoftInputMode="adjustResize|stateHidden"
            android:launchMode="singleTask"
            android:screenOrientation="unspecified">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>`;
    manifest = manifest.replace(/<\/application>/, monitorActivitySnippet);
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

function copyKotlinDatabaseFiles(javaAppDir) {
  const sourceDbDir = path.resolve('src/kotlin-core/database');
  if (!fs.existsSync(sourceDbDir)) {
    console.warn('⚠️ Directorio de base de datos Room src/kotlin-core/database no encontrado');
    return;
  }

  const targetDbDir = path.join(javaAppDir, 'com/inkflow/studio/database');
  if (!fs.existsSync(targetDbDir)) {
    fs.mkdirSync(targetDbDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDbDir);
  for (const file of files) {
    if (file.endsWith('.kt')) {
      const srcPath = path.join(sourceDbDir, file);
      const destPath = path.join(targetDbDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Archivo Room ${file} copiado con éxito a:`, destPath);
    }
  }
}

function configureGradleRoomDependencies(gradleDir) {
  // Buscar build.gradle o build.gradle.kts en src-tauri/gen/android/app
  const ktsPath = path.join(gradleDir, 'build.gradle.kts');
  const groovyPath = path.join(gradleDir, 'build.gradle');

  if (fs.existsSync(ktsPath)) {
    let content = fs.readFileSync(ktsPath, 'utf8');
    // Limpiar cualquier referencia obsoleta o inválida a sqlite-bundled
    content = content.replace(/.*androidx\.sqlite:sqlite-bundled.*\n?/g, '');
    
    if (!content.includes('androidx.room:room-runtime')) {
      const roomDeps = `
    // Dependencias nativas de InkFlow Studio (Room, Coroutines y Core KTX)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
`;
      content = content.replace(/(dependencies\s*\{)/, `$1${roomDeps}`);
      console.log('✅ Dependencias de Android Jetpack Room y Corrutinas inyectadas en build.gradle.kts');
    }
    fs.writeFileSync(ktsPath, content, 'utf8');
  } else if (fs.existsSync(groovyPath)) {
    let content = fs.readFileSync(groovyPath, 'utf8');
    // Limpiar cualquier referencia obsoleta o inválida a sqlite-bundled
    content = content.replace(/.*androidx\.sqlite:sqlite-bundled.*\n?/g, '');
    
    if (!content.includes('androidx.room:room-runtime')) {
      const roomDeps = `
    // Dependencias nativas de InkFlow Studio (Room, Coroutines y Core KTX)
    implementation 'androidx.room:room-runtime:2.6.1'
    implementation 'androidx.room:room-ktx:2.6.1'
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3'
`;
      content = content.replace(/(dependencies\s*\{)/, `$1${roomDeps}`);
      console.log('✅ Dependencias de Android Jetpack Room y Corrutinas inyectadas en build.gradle');
    }
    fs.writeFileSync(groovyPath, content, 'utf8');
  }
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
import app.tauri.plugin.TauriActivity
import app.tauri.plugin.PluginManager
import com.inkflow.studio.platform.AndroidGalleryManager
import com.inkflow.studio.platform.AndroidScreenWakeLockManager
import com.inkflow.studio.platform.InkFlowJavascriptInterface
import com.inkflow.studio.database.RoomStorageManager

open class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setupImmersiveStickyMode()
    setupNativeJavascriptBridge()
  }

  /**
   * Ciclo de vida oficial de Tauri v2 en Android:
   * onWebViewCreate se ejecuta exactamente en el momento en que Tauri crea la instancia de WebView,
   * permitiendo inyectar InkFlowNativeBridge antes de que la página web termine de evaluar sus scripts.
   */
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    attachNativeBridge(webView)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      setupImmersiveStickyMode()
      setupNativeJavascriptBridge()
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

  /**
   * Conecta de forma determinista la interfaz nativa al WebView configurando
   * permisos de ejecución Javascript y almacenamiento local.
   */
  private fun attachNativeBridge(webView: WebView) {
    try {
      webView.settings.javaScriptEnabled = true
      webView.settings.domStorageEnabled = true
      val galleryManager = AndroidGalleryManager(this)
      val wakeLockManager = AndroidScreenWakeLockManager(this)
      val roomStorageManager = RoomStorageManager(this)
      val bridge = InkFlowJavascriptInterface(this, galleryManager, wakeLockManager, roomStorageManager)
      webView.addJavascriptInterface(bridge, "InkFlowNativeBridge")
      val initialScreen = intent?.getStringExtra("INITIAL_SCREEN") ?: ""
      if (initialScreen.isNotEmpty()) {
        webView.evaluateJavascript("window.__INKFLOW_INITIAL_SCREEN = '$initialScreen';", null)
      }
      println("✅ InkFlowNativeBridge con Android Jetpack Room inyectado con éxito en WebView")
    } catch (e: Exception) {
      println("⚠️ Error inyectando InkFlowNativeBridge: " + e.message)
    }
  }

  private fun setupNativeJavascriptBridge() {
    window.decorView.post {
      try {
        val webView = findWebView(window.decorView)
        if (webView != null) {
          attachNativeBridge(webView)
        }
      } catch (e: Exception) {
        println("⚠️ Error en setupNativeJavascriptBridge: " + e.message)
      }
    }
  }
}
`;

  fs.writeFileSync(mainActivityPath, code, 'utf8');
  console.log('✅ MainActivity.kt configurado exitosamente con Modo Inmersivo y puente InkFlowNativeBridge con Room');

  // Generar la actividad compañera de Diagnóstico y Debug heredando de android.app.Activity
  const diagPath = path.join(path.dirname(mainActivityPath), 'DiagnosticMonitorActivity.kt');
  const diagCode = `package com.inkflow.studio

import android.app.Activity
import android.content.Intent
import android.os.Bundle

class DiagnosticMonitorActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val targetIntent = Intent(this, MainActivity::class.java).apply {
      putExtra("INITIAL_SCREEN", "monitor")
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    startActivity(targetIntent)
    finish()
  }
}
`;
  fs.writeFileSync(diagPath, diagCode, 'utf8');
  console.log('✅ DiagnosticMonitorActivity.kt generado exitosamente en:', diagPath);

  return true;
}

function configureGradleProperties(androidDir) {
  if (!fs.existsSync(androidDir)) return;
  const propPath = path.join(androidDir, 'gradle.properties');
  let content = fs.existsSync(propPath) ? fs.readFileSync(propPath, 'utf8') : '';
  const additions = [
    'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8',
    'kotlin.daemon.jvmargs=-Xmx1536m',
    'android.useAndroidX=true',
    'android.enableJetifier=true'
  ];
  for (const item of additions) {
    const key = item.split('=')[0];
    if (!content.includes(key)) {
      content += `\n${item}`;
    }
  }
  fs.writeFileSync(propPath, content, 'utf8');
  console.log('✅ gradle.properties configurado con flags de memoria y AndroidX');
}

// Ejecución principal
const manifestTarget = path.resolve('src-tauri/gen/android/app/src/main/AndroidManifest.xml');
const javaTargetDir = path.resolve('src-tauri/gen/android/app/src/main/java');
const resTargetDir = path.resolve('src-tauri/gen/android/app/src/main/res');
const appGradleDir = path.resolve('src-tauri/gen/android/app');

console.log('🔧 Ejecutando configuración nativa para Android con soporte Room Database...');
configureAndroidManifest(manifestTarget);
ensureFilePathsXml(resTargetDir);
copyKotlinPlatformBridge(javaTargetDir);
copyKotlinDatabaseFiles(javaTargetDir);
configureGradleRoomDependencies(appGradleDir);
configureGradleProperties(path.resolve('src-tauri/gen/android'));
configureMainActivity(javaTargetDir);
console.log('🚀 Configuración nativa completada.');

