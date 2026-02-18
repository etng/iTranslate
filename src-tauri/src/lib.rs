use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, Submenu};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TranslatePayload {
  endpoint: String,
  model: String,
  prompt: String,
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

#[tauri::command]
async fn translate_text(payload: TranslatePayload) -> Result<TranslateOutput, String> {
  let client = Client::new();
  let endpoint = format!("{}/api/generate", payload.endpoint.trim_end_matches('/'));

  let response = client
    .post(endpoint)
    .json(&serde_json::json!({
      "model": payload.model,
      "prompt": payload.prompt,
      "stream": false
    }))
    .send()
    .await
    .map_err(|error| format!("请求 Ollama 失败: {error}"))?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("Ollama 返回异常状态 {status}: {body}"));
  }

  let parsed = response
    .json::<OllamaGenerateResponse>()
    .await
    .map_err(|error| format!("解析 Ollama 响应失败: {error}"))?;

  Ok(TranslateOutput {
    text: parsed.response,
  })
}

#[tauri::command]
async fn check_ollama_health(payload: OllamaHealthPayload) -> Result<OllamaHealthOutput, String> {
  let client = Client::new();
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

fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
  let about = MenuItem::with_id(app, "about", "关于", true, None::<&str>)?;
  let check_update = MenuItem::with_id(app, "check-update", "检查更新", true, None::<&str>)?;

  let submenu = Submenu::with_items(app, "应用", true, &[&about, &check_update])?;
  Menu::with_items(app, &[&submenu])
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
    .invoke_handler(tauri::generate_handler![translate_text, check_ollama_health])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
