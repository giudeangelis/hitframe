// Niente finestra della console su Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hitframe_lib::run()
}
