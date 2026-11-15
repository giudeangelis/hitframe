use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};
use tauri_plugin_opener::OpenerExt;

// Il client "app desktop" del progetto Google Hitframe. Per le app installate Google
// considera il client secret non riservato; lo passiamo comunque in fase di build.
const CLIENT_ID: &str = match option_env!("HF_GOOGLE_DESKTOP_ID") {
    Some(v) => v,
    None => "301990574899-qmkq3hm3ae06hsfk2iml1ujec3fa7bvo.apps.googleusercontent.com",
};
const CLIENT_SECRET: &str = match option_env!("HF_GOOGLE_DESKTOP_SECRET") {
    Some(v) => v,
    None => "",
};

#[derive(Serialize, Deserialize, Debug)]
pub struct Token {
    access_token: String,
    expires_in: u64,
    #[serde(default)]
    scope: String,
    #[serde(default)]
    refresh_token: Option<String>,
}

const PAGINA_OK: &str = r#"<!doctype html><html lang="it"><meta charset="utf-8"><title>Hitframe</title>
<body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0b0b0c;color:#f4f4f4;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h1 style="color:#e5ea1e">Fatto ✓</h1><p>Puoi chiudere questa scheda e tornare a Hitframe.</p></div>
<script>setTimeout(()=>window.close(),800)</script></body></html>"#;

fn casuale(n: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(n).map(char::from).collect()
}

/// Apre il browser per l'accesso Google e aspetta il ritorno sull'indirizzo locale.
#[tauri::command]
pub async fn google_accedi(app: tauri::AppHandle, scope: String, login_hint: Option<String>, scegli_account: bool) -> Result<Token, String> {
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| format!("Non riesco ad aprire la porta locale: {e}"))?;
    let porta = server.server_addr().to_ip().map(|a| a.port()).ok_or("porta locale non disponibile")?;
    let redirect = format!("http://127.0.0.1:{porta}");
    let verifier = casuale(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let stato = casuale(24);

    let mut u = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    {
        let mut q = u.query_pairs_mut();
        q.append_pair("client_id", CLIENT_ID)
            .append_pair("redirect_uri", &redirect)
            .append_pair("response_type", "code")
            .append_pair("scope", &scope)
            .append_pair("code_challenge", &challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", &stato)
            .append_pair("access_type", "offline")
            .append_pair("include_granted_scopes", "true");
        if scegli_account {
            q.append_pair("prompt", "select_account consent");
        } else {
            q.append_pair("prompt", "consent");
        }
        if let Some(h) = login_hint.filter(|h| !h.is_empty()) {
            q.append_pair("login_hint", &h);
        }
    }
    app.opener().open_url(u.as_str(), None::<&str>).map_err(|e| format!("Non riesco ad aprire il browser: {e}"))?;

    // Aspetta il ritorno da Google (massimo 5 minuti), fuori dal thread principale
    let codice = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let fine = Instant::now() + Duration::from_secs(300);
        while Instant::now() < fine {
            let Ok(Some(req)) = server.recv_timeout(Duration::from_millis(500)) else { continue };
            let completo = url::Url::parse(&format!("http://127.0.0.1{}", req.url())).map_err(|e| e.to_string())?;
            let par: std::collections::HashMap<_, _> = completo.query_pairs().into_owned().collect();
            if par.get("state").map(String::as_str) != Some(stato.as_str()) {
                let _ = req.respond(tiny_http::Response::from_string("").with_status_code(404));
                continue;
            }
            let html = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap();
            let _ = req.respond(tiny_http::Response::from_string(PAGINA_OK).with_header(html));
            if let Some(err) = par.get("error") {
                return Err(if err == "access_denied" { "Accesso a Google annullato.".into() } else { format!("Google ha risposto: {err}") });
            }
            return par.get("code").cloned().ok_or_else(|| "Risposta di Google senza codice.".to_string());
        }
        Err("Tempo scaduto: accesso a Google non completato.".into())
    })
    .await
    .map_err(|e| e.to_string())??;

    scambia(&[
        ("code", codice.as_str()),
        ("code_verifier", verifier.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("grant_type", "authorization_code"),
    ])
    .await
}

/// Rinnova l'accesso senza aprire il browser.
#[tauri::command]
pub async fn google_rinnova(refresh_token: String) -> Result<Token, String> {
    scambia(&[("refresh_token", refresh_token.as_str()), ("grant_type", "refresh_token")]).await
}

#[tauri::command]
pub fn versione_app(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

async fn scambia(extra: &[(&str, &str)]) -> Result<Token, String> {
    let mut form: Vec<(&str, &str)> = vec![("client_id", CLIENT_ID)];
    if !CLIENT_SECRET.is_empty() {
        form.push(("client_secret", CLIENT_SECRET));
    }
    form.extend_from_slice(extra);
    let r = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .await
        .map_err(|e| format!("Google non raggiungibile: {e}"))?;
    let stato = r.status();
    let testo = r.text().await.map_err(|e| e.to_string())?;
    if !stato.is_success() {
        if testo.contains("invalid_grant") {
            return Err("ACCESSO_SCADUTO".into());
        }
        return Err(format!("Accesso non riuscito ({stato}): {testo}"));
    }
    serde_json::from_str(&testo).map_err(|e| e.to_string())
}
