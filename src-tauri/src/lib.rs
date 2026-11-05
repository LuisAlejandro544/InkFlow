/**
 * @file lib.rs
 * @description Punto de entrada nativo de Tauri v2 para Android y plataformas cruzadas.
 * Configura la inicialización móvil y expone comandos de bajo nivel para InkFlow Studio.
 */

#[tauri::command]
fn ping_engine() -> String {
    "InkFlow Studio Engine Online (Tauri v2 Nativo)".into()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ping_engine])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar InkFlow Studio en contenedor nativo");
}
