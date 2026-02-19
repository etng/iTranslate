use reqwest::Client;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::Emitter;
use tauri::Manager;
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct HistoryRecord {
  id: String,
  title: String,
  created_at: String,
  source_language: String,
  target_language: String,
  input_raw: String,
  input_markdown: String,
  output_markdown: String,
  provider: String,
  model: String,
  engine_id: String,
  engine_name: String,
  engine_deleted: bool,
  source_type: Option<String>,
  source_book_name: Option<String>,
  source_chapter_file: Option<String>,
  source_chapter_index: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameHistoryPayload {
  id: String,
  title: String,
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| format!("创建目录失败: {error}"))?;
  }
  Ok(())
}

fn resolve_history_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let config_dir = app
    .path()
    .app_config_dir()
    .map_err(|error| format!("获取应用配置目录失败: {error}"))?;
  Ok(config_dir.join("iTranslate").join("history.db"))
}

fn open_history_db(app: &tauri::AppHandle) -> Result<Connection, String> {
  let db_path = resolve_history_db_path(app)?;
  ensure_parent_dir(&db_path)?;
  let conn = Connection::open(db_path).map_err(|error| format!("打开历史数据库失败: {error}"))?;
  conn.execute_batch(
    r#"
    CREATE TABLE IF NOT EXISTS translation_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source_language TEXT NOT NULL,
      target_language TEXT NOT NULL,
      input_raw TEXT NOT NULL,
      input_markdown TEXT NOT NULL,
      output_markdown TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      engine_id TEXT NOT NULL,
      engine_name TEXT NOT NULL,
      engine_deleted INTEGER NOT NULL DEFAULT 0,
      source_type TEXT,
      source_book_name TEXT,
      source_chapter_file TEXT,
      source_chapter_index INTEGER
    );
    "#,
  ).map_err(|error| format!("初始化历史数据库失败: {error}"))?;
  for sql in [
    "ALTER TABLE translation_history ADD COLUMN source_type TEXT",
    "ALTER TABLE translation_history ADD COLUMN source_book_name TEXT",
    "ALTER TABLE translation_history ADD COLUMN source_chapter_file TEXT",
    "ALTER TABLE translation_history ADD COLUMN source_chapter_index INTEGER",
  ] {
    let _ = conn.execute(sql, []);
  }
  Ok(conn)
}

fn query_all_history(conn: &Connection) -> Result<Vec<HistoryRecord>, String> {
  let mut stmt = conn
    .prepare(
      r#"
      SELECT
        id, title, created_at, source_language, target_language,
        input_raw, input_markdown, output_markdown,
        provider, model, engine_id, engine_name, engine_deleted,
        source_type, source_book_name, source_chapter_file, source_chapter_index
      FROM translation_history
      ORDER BY created_at DESC
      "#,
    )
    .map_err(|error| format!("准备历史查询失败: {error}"))?;

  let rows = stmt
    .query_map([], |row| {
      Ok(HistoryRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        created_at: row.get(2)?,
        source_language: row.get(3)?,
        target_language: row.get(4)?,
        input_raw: row.get(5)?,
        input_markdown: row.get(6)?,
        output_markdown: row.get(7)?,
        provider: row.get(8)?,
        model: row.get(9)?,
        engine_id: row.get(10)?,
        engine_name: row.get(11)?,
        engine_deleted: row.get::<_, i64>(12)? == 1,
        source_type: row.get(13)?,
        source_book_name: row.get(14)?,
        source_chapter_file: row.get(15)?,
        source_chapter_index: row.get(16)?,
      })
    })
    .map_err(|error| format!("查询历史失败: {error}"))?;

  let mut records = Vec::new();
  for row in rows {
    records.push(row.map_err(|error| format!("读取历史记录失败: {error}"))?);
  }
  Ok(records)
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
    .post(&endpoint);

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

#[tauri::command]
async fn history_list(app: tauri::AppHandle) -> Result<Vec<HistoryRecord>, String> {
  let conn = open_history_db(&app)?;
  query_all_history(&conn)
}

#[tauri::command]
async fn history_upsert(app: tauri::AppHandle, payload: HistoryRecord) -> Result<Vec<HistoryRecord>, String> {
  let conn = open_history_db(&app)?;
  conn
    .execute(
      r#"
      INSERT INTO translation_history (
        id, title, created_at, source_language, target_language,
        input_raw, input_markdown, output_markdown,
        provider, model, engine_id, engine_name, engine_deleted,
        source_type, source_book_name, source_chapter_file, source_chapter_index
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        created_at=excluded.created_at,
        source_language=excluded.source_language,
        target_language=excluded.target_language,
        input_raw=excluded.input_raw,
        input_markdown=excluded.input_markdown,
        output_markdown=excluded.output_markdown,
        provider=excluded.provider,
        model=excluded.model,
        engine_id=excluded.engine_id,
        engine_name=excluded.engine_name,
        engine_deleted=excluded.engine_deleted,
        source_type=excluded.source_type,
        source_book_name=excluded.source_book_name,
        source_chapter_file=excluded.source_chapter_file,
        source_chapter_index=excluded.source_chapter_index
      "#,
      params![
        payload.id,
        payload.title,
        payload.created_at,
        payload.source_language,
        payload.target_language,
        payload.input_raw,
        payload.input_markdown,
        payload.output_markdown,
        payload.provider,
        payload.model,
        payload.engine_id,
        payload.engine_name,
        if payload.engine_deleted { 1 } else { 0 },
        payload.source_type,
        payload.source_book_name,
        payload.source_chapter_file,
        payload.source_chapter_index,
      ],
    )
    .map_err(|error| format!("写入历史失败: {error}"))?;
  query_all_history(&conn)
}

#[tauri::command]
async fn history_replace_all(app: tauri::AppHandle, payload: Vec<HistoryRecord>) -> Result<Vec<HistoryRecord>, String> {
  let mut conn = open_history_db(&app)?;
  let tx = conn.transaction().map_err(|error| format!("开启事务失败: {error}"))?;
  tx.execute("DELETE FROM translation_history", [])
    .map_err(|error| format!("清理历史失败: {error}"))?;
  for item in payload {
    tx.execute(
      r#"
      INSERT INTO translation_history (
        id, title, created_at, source_language, target_language,
        input_raw, input_markdown, output_markdown,
        provider, model, engine_id, engine_name, engine_deleted,
        source_type, source_book_name, source_chapter_file, source_chapter_index
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
      "#,
      params![
        item.id,
        item.title,
        item.created_at,
        item.source_language,
        item.target_language,
        item.input_raw,
        item.input_markdown,
        item.output_markdown,
        item.provider,
        item.model,
        item.engine_id,
        item.engine_name,
        if item.engine_deleted { 1 } else { 0 },
        item.source_type,
        item.source_book_name,
        item.source_chapter_file,
        item.source_chapter_index,
      ],
    )
    .map_err(|error| format!("批量写入历史失败: {error}"))?;
  }
  tx.commit().map_err(|error| format!("提交事务失败: {error}"))?;
  query_all_history(&conn)
}

#[tauri::command]
async fn history_delete(app: tauri::AppHandle, id: String) -> Result<Vec<HistoryRecord>, String> {
  let conn = open_history_db(&app)?;
  conn
    .execute("DELETE FROM translation_history WHERE id = ?1", params![id])
    .map_err(|error| format!("删除历史失败: {error}"))?;
  query_all_history(&conn)
}

#[tauri::command]
async fn history_rename(app: tauri::AppHandle, payload: RenameHistoryPayload) -> Result<Vec<HistoryRecord>, String> {
  let conn = open_history_db(&app)?;
  conn
    .execute(
      "UPDATE translation_history SET title = ?1 WHERE id = ?2",
      params![payload.title, payload.id],
    )
    .map_err(|error| format!("更新历史标题失败: {error}"))?;
  query_all_history(&conn)
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
    .invoke_handler(tauri::generate_handler![
      translate_text,
      check_ollama_health,
      save_binary_file,
      history_list,
      history_upsert,
      history_replace_all,
      history_delete,
      history_rename
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
