import { open } from "@tauri-apps/plugin-dialog";
import type { UserPreferences } from "../types";
import { isTauriRuntime } from "../utils/runtime";

interface PreferencesPanelProps {
  value: UserPreferences;
  onChange: (next: UserPreferences) => void;
}

export function PreferencesPanel({ value, onChange }: PreferencesPanelProps) {
  const handleChooseDir = async () => {
    if (isTauriRuntime()) {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") {
        return;
      }
      onChange({ ...value, epubDefaultExportDir: selected });
      return;
    }
    const entered = window.prompt("请输入默认导出目录路径", value.epubDefaultExportDir ?? "");
    if (entered && entered.trim()) {
      onChange({ ...value, epubDefaultExportDir: entered.trim() });
    }
  };

  return (
    <section className="history-list">
      <header className="history-header">
        <h2>用户偏好</h2>
      </header>

      <div className="wizard-form">
        <label>
          默认 EPUB 作者
          <input
            value={value.epubDefaultAuthor}
            onChange={(event) => onChange({ ...value, epubDefaultAuthor: event.target.value })}
          />
        </label>

        <label>
          默认导出目录
          <input value={value.epubDefaultExportDir ?? ""} readOnly placeholder="未设置" />
        </label>

        <div className="table-actions">
          <button type="button" onClick={() => void handleChooseDir()}>选择目录</button>
          <button type="button" onClick={() => onChange({ ...value, epubDefaultExportDir: null })}>清空默认目录</button>
        </div>
      </div>
    </section>
  );
}
