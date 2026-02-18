use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{Duration, Instant};
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TranslatePayload {
  endpoint: String,
  model: String,
  prompt: String,
  api_token: Option<String>,
  username: Option<String>,
  password: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OllamaHealthPayload {
  endpoint: String,
  model: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranslateOutput {
  text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaHealthOutput {
  reachable: bool,
  model_installed: bool,
  models: Vec<String>,
  message: String,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
  response: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
  models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
  name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveBinaryPayload {
  path: String,
  bytes: Vec<u8>,
}

#[tauri::command]
async fn translate_text(payload: TranslatePayload) -> Result<TranslateOutput, String> {
  let started_at = Instant::now();
  log::info!(
    "translate_text start endpoint={} model={} prompt_chars={}",
    payload.endpoint,
    payload.model,
    payload.prompt.chars().count()
  );

  let client = Client::builder()
    .timeout(Duration::from_secs(180))
    .build()
    .map_err(|error| format!("创建 HTTP 客户端失败: {error}"))?;
  let endpoint = format!("{}/api/generate", payload.endpoint.trim_end_matches('/'));

  let mut request = client
    .post(endpoint);

  if let Some(token) = &payload.api_token {
    if !token.is_empty() {
      request = request.bearer_auth(token);
    }
  }

  if let (Some(username), Some(password)) = (&payload.username, &payload.password) {
    if !username.is_empty() || !password.is_empty() {
      request = request.basic_auth(username, Some(password));
    }
  }

  let response = request
    .json(&serde_json::json!({
      "model": payload.model,
      "prompt": payload.prompt,
      "stream": false
    }))
    .send()
    .await
    .map_err(|error| {
      log::error!("translate_text request error endpoint={} error={}", endpoint, error);
      format!("请求 Ollama 失败: {error}")
    })?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    log::error!("translate_text bad status endpoint={} status={} body={}", endpoint, status, body);
    return Err(format!("Ollama 返回异常状态 {status}: {body}"));
  }

  let parsed = response
    .json::<OllamaGenerateResponse>()
    .await
    .map_err(|error| {
      log::error!("translate_text parse error endpoint={} error={}", endpoint, error);
      format!("解析 Ollama 响应失败: {error}")
    })?;

  log::info!(
    "translate_text done endpoint={} model={} elapsed_ms={}",
    payload.endpoint,
    payload.model,
    started_at.elapsed().as_millis()
  );

  Ok(TranslateOutput {
    text: parsed.response,
  })
}

#[tauri::command]
async fn check_ollama_health(payload: OllamaHealthPayload) -> Result<OllamaHealthOutput, String> {
  let client = Client::builder()
    .timeout(Duration::from_secs(15))
    .build()
    .map_err(|error| format!("创建 HTTP 客户端失败: {error}"))?;
  let endpoint = format!("{}/api/tags", payload.endpoint.trim_end_matches('/'));

  let response = client
    .get(endpoint)
    .send()
    .await
    .map_err(|error| format!("无法访问 Ollama 服务: {error}"))?;

  if !response.status().is_success() {
    return Ok(OllamaHealthOutput {
      reachable: false,
      model_installed: false,
      models: vec![],
      message: format!("Ollama 服务响应异常：{}", response.status()),
    });
  }

  let parsed = response
    .json::<OllamaTagsResponse>()
    .await
    .map_err(|error| format!("解析 Ollama 模型列表失败: {error}"))?;

  let models = parsed.models.into_iter().map(|model| model.name).collect::<Vec<_>>();
  let model_installed = models
    .iter()
    .any(|name| name == &payload.model || name.starts_with(&format!("{}:", payload.model)));

  let message = if model_installed {
    format!("检查通过：检测到模型 {}", payload.model)
  } else {
    format!("Ollama 可访问，但未检测到模型 {}", payload.model)
  };

  Ok(OllamaHealthOutput {
    reachable: true,
    model_installed,
    models,
    message,
  })
}

#[tauri::command]
async fn save_binary_file(payload: SaveBinaryPayload) -> Result<(), String> {
  fs::write(payload.path, payload.bytes).map_err(|error| format!("写入文件失败: {error}"))
}

fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
  let about = MenuItem::with_id(app, "about", "关于", true, None::<&str>)?;
  let check_update = MenuItem::with_id(app, "check-update", "检查更新", true, None::<&str>)?;
  let app_separator = PredefinedMenuItem::separator(app)?;
  let edit_separator_1 = PredefinedMenuItem::separator(app)?;
  let edit_separator_2 = PredefinedMenuItem::separator(app)?;

  let cut = PredefinedMenuItem::cut(app, None::<&str>)?;
  let copy = PredefinedMenuItem::copy(app, None::<&str>)?;
  let paste = PredefinedMenuItem::paste(app, None::<&str>)?;
  let undo = PredefinedMenuItem::undo(app, None::<&str>)?;
  let redo = PredefinedMenuItem::redo(app, None::<&str>)?;
  let select_all = PredefinedMenuItem::select_all(app, None::<&str>)?;

  let app_submenu = Submenu::with_items(app, "应用", true, &[&about, &app_separator, &check_update])?;
  let edit_submenu = Submenu::with_items(
    app,
    "编辑",
    true,
    &[&undo, &redo, &edit_separator_1, &cut, &copy, &paste, &edit_separator_2, &select_all],
  )?;

  Menu::with_items(app, &[&app_submenu, &edit_submenu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      let menu = build_app_menu(app.handle())?;
      app.set_menu(menu)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      Ok(())
    })
    .on_menu_event(|app, event| {
      match event.id().as_ref() {
        "about" => {
          let _ = app.emit("menu://about", ());
        }
        "check-update" => {
          let _ = app.emit("menu://check-update", ());
        }
        _ => {}
      }
    })
    .invoke_handler(tauri::generate_handler![translate_text, check_ollama_health, save_binary_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
