package com.inkflow.studio

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * DiagnosticMonitorActivity:
 * Actividad independiente de Android declarada en AndroidManifest.xml con
 * android.intent.category.LAUNCHER y etiqueta "InkFlow Monitor".
 * 
 * Hereda directamente de android.app.Activity estándar del SDK para garantizar
 * 100% de compatibilidad en la compilación de Kotlin y evitar conflictos
 * de ciclo de vida con el runtime de Tauri/Wry.
 * 
 * Al iniciarse desde el launcher del teléfono, despacha un Intent directo hacia
 * MainActivity con el parámetro "INITIAL_SCREEN" = "monitor", abriendo de inmediato
 * la consola de Debug, RAM y LogCat, y cerrando su instancia (finish()).
 */
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
