// Previene ventana de consola adicional en Windows en modo release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    inkflow_studio_lib::run();
}
