package com.inkflow.studio

import android.os.Bundle

/**
 * DiagnosticMonitorActivity:
 * Actividad complementaria independiente declarada en AndroidManifest.xml con
 * android.intent.category.LAUNCHER y etiqueta "InkFlow Monitor".
 * 
 * Permite al usuario en su teléfono móvil abrir directamente la consola de Debug,
 * telemetría, RAM y LogCat del sistema sin necesidad de una computadora ni de ADB.
 */
class DiagnosticMonitorActivity : MainActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Marcar la pantalla inicial como "monitor" para que el WebView inicie directo en la consola
    intent?.putExtra("INITIAL_SCREEN", "monitor")
    super.onCreate(savedInstanceState)
  }
}
