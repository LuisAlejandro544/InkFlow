/**
 * @file lib.rs
 * @description Punto de entrada nativo de Tauri v2 para Android y plataformas cruzadas.
 * Configura la inicialización móvil y expone comandos de bajo nivel para InkFlow Studio.
 * 
 * Funcionalidades nativas:
 * - Ping del motor Wasm/Tauri
 * - Guardado directo en la carpeta pública Pictures/InkFlow Studio con indexación inmediata en Galería de Android
 */

use std::fs;
use std::path::{Path, PathBuf};

/// Decodificador Base64 ultraligero y autónomo sin dependencias externas
fn decode_base64_data(input: &str) -> Option<Vec<u8>> {
    let clean = input.trim();
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0;
    for &b in clean.as_bytes() {
        let val = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\r' | b'\n' | b' ' => continue,
            _ => return None,
        } as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Some(out)
}

/// Localiza o crea el directorio de destino Pictures/InkFlow Studio
fn resolve_pictures_directory() -> PathBuf {
    // 1. Rutas de almacenamiento externo estándar en Android (Scoped Storage y Directorio Público Pictures)
    let candidates = [
        "/storage/emulated/0/Pictures/InkFlow Studio",
        "/sdcard/Pictures/InkFlow Studio",
        "/storage/emulated/0/DCIM/InkFlow Studio",
        "/sdcard/DCIM/InkFlow Studio",
    ];

    for candidate in candidates {
        let path = Path::new(candidate);
        if path.exists() {
            return path.to_path_buf();
        }
        if fs::create_dir_all(path).is_ok() {
            return path.to_path_buf();
        }
    }

    // 2. Si es desktop o entorno de desarrollo local, usar la carpeta de Imágenes del usuario
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join("Pictures").join("InkFlow Studio");
        if fs::create_dir_all(&p).is_ok() {
            return p;
        }
    }

    // 3. Fallback relativo
    let fallback = PathBuf::from("Pictures/InkFlow Studio");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

#[tauri::command]
fn ping_engine() -> String {
    "InkFlow Studio Engine Online (Tauri v2 Nativo)".into()
}

/**
 * Guarda directamente la ilustración en la carpeta pública Pictures/InkFlow Studio del teléfono.
 * Notifica de inmediato al MediaScanner de Android para que la obra aparezca en la Galería de Fotos.
 */
#[tauri::command]
fn save_image_to_gallery(
    image_bytes: Option<Vec<u8>>,
    base64_data: Option<String>,
    file_name: String,
) -> Result<String, String> {
    // Obtener los bytes reales de la imagen
    let bytes = if let Some(b) = image_bytes {
        if !b.is_empty() {
            b
        } else if let Some(ref s) = base64_data {
            decode_base64_data(s).ok_or_else(|| "Formato Base64 inválido".to_string())?
        } else {
            return Err("Datos binarios vacíos".to_string());
        }
    } else if let Some(ref s) = base64_data {
        decode_base64_data(s).ok_or_else(|| "Formato Base64 inválido".to_string())?
    } else {
        return Err("No se proporcionaron datos de imagen".to_string());
    };

    if bytes.is_empty() {
        return Err("El contenido del archivo está vacío".to_string());
    }

    let pictures_dir = resolve_pictures_directory();
    if !pictures_dir.exists() {
        if let Err(e) = fs::create_dir_all(&pictures_dir) {
            return Err(format!("No se pudo crear la carpeta Pictures/InkFlow Studio: {}", e));
        }
    }

    // Sanitizar nombre de archivo evitando caracteres ilegales en filesystem
    let clean_name = file_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let final_name = if clean_name.is_empty() {
        format!("obra_{}.png", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0))
    } else {
        clean_name
    };

    let target_path = pictures_dir.join(&final_name);

    // Escribir bytes al almacenamiento físico del dispositivo
    if let Err(e) = fs::write(&target_path, &bytes) {
        return Err(format!("Error escribiendo en {}: {}", target_path.display(), e));
    }

    // Indexación automática para la Galería de Fotos en Android
    #[cfg(target_os = "android")]
    {
        let file_uri = format!("file://{}", target_path.display());
        let _ = std::process::Command::new("am")
            .args(["broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", &file_uri])
            .spawn();
    }

    Ok(target_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ping_engine, save_image_to_gallery])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar InkFlow Studio en contenedor nativo");
}
