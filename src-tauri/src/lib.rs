//! Hitframe desktop: la stessa app web, in una finestra sua.
//! L'unica parte nativa è l'accesso a Google: Google non permette il login dentro le app,
//! quindi si apre il browser del computer (flusso OAuth per app installate, con PKCE e
//! indirizzo di ritorno locale 127.0.0.1). Il refresh token permette di non rifare l'accesso.

mod google;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![google::google_accedi, google::google_rinnova, google::versione_app])
        .run(tauri::generate_context!())
        .expect("errore all'avvio di Hitframe");
}
