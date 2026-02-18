import { useMemo, useState } from "react";
import type { LanguageOption, TranslatorModelConfig } from "../types";

interface EpubImportWizardProps {
  open: boolean;
  running: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  selectedEngineId: string;
  languages: LanguageOption[];
  engines: TranslatorModelConfig[];
  progress: { current: number; total: number; message: string };
  onClose: () => void;
  onStart: (payload: {
    file: File;
    sourceLanguage: string;
    targetLanguage: string;
    engineId: string;
  }) => void;
}

export function EpubImportWizard({
  open,
  running,
  sourceLanguage,
  targetLanguage,
  selectedEngineId,
  languages,
  engines,
  progress,
  onClose,
  onStart,
}: EpubImportWizardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [localSourceLanguage, setLocalSourceLanguage] = useState(sourceLanguage);
  const [localTargetLanguage, setLocalTargetLanguage] = useState(targetLanguage);
  const [localEngineId, setLocalEngineId] = useState(selectedEngineId);

  const canStart = useMemo(
    () => Boolean(file) && Boolean(localEngineId) && !running,
    [file, localEngineId, running],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="modal-mask" role="dialog" aria-modal="true" aria-label="EPUB 闭环翻译">
      <section className="modal-card">
        <header className="history-header">
          <h3>EPUB 闭环翻译</h3>
          <button type="button" onClick={onClose} disabled={running}>关闭</button>
        </header>

        <div className="wizard-form">
          <label>
            选择 EPUB 文件
            <input
              type="file"
              accept=".epub,application/epub+zip"
              aria-label="选择EPUB文件"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
              }}
              disabled={running}
            />
          </label>
          <label>
            源语言
            <select
              value={localSourceLanguage}
              onChange={(event) => setLocalSourceLanguage(event.target.value)}
              disabled={running}
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            目标语言
            <select
              value={localTargetLanguage}
              onChange={(event) => setLocalTargetLanguage(event.target.value)}
              disabled={running}
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            翻译引擎
            <select
              value={localEngineId}
              onChange={(event) => setLocalEngineId(event.target.value)}
              disabled={running}
            >
              <option value="">请选择引擎</option>
              {engines.map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {engine.name}
                </option>
              ))}
            </select>
          </label>
          <p className="status-label">
            闭环流程：拆解 EPUB {"->"} 批量翻译写入历史 {"->"} 自动导出“_已翻译.epub”
          </p>
          {file ? (
            <p className="status-label">当前文件：{file.name}</p>
          ) : null}
          {running ? (
            <p className="status-label">
              进度：{progress.current}/{progress.total} {progress.message}
            </p>
          ) : null}
        </div>

        <footer className="table-actions">
          <button type="button" onClick={onClose} disabled={running}>取消</button>
          <button
            type="button"
            className="icon-btn primary"
            disabled={!canStart}
            onClick={() => {
              if (!file) {
                return;
              }
              onStart({
                file,
                sourceLanguage: localSourceLanguage,
                targetLanguage: localTargetLanguage,
                engineId: localEngineId,
              });
            }}
          >
            {running ? "处理中..." : "开始闭环翻译"}
          </button>
        </footer>
      </section>
    </div>
  );
}
