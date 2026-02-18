import { useMemo, useState } from "react";
import { checkOllamaHealth } from "../services/translation";
import {
  createNewEngineTemplate,
  getAvailableEngines,
  markEngineDeleted,
  setDefaultEngine,
  upsertEngine,
} from "../services/engineStore";
import type { EngineStoreState, TranslatorModelConfig } from "../types";

interface EngineManagerProps {
  state: EngineStoreState;
  onChange: (next: EngineStoreState) => void;
  onLog: (level: "INFO" | "WARN" | "ERROR", message: string) => void;
}

export function EngineManager({ state, onChange, onLog }: EngineManagerProps) {
  const [editing, setEditing] = useState<Record<string, TranslatorModelConfig>>({});

  const available = useMemo(() => getAvailableEngines(state.engines), [state.engines]);

  const handleCreate = () => {
    const engine = createNewEngineTemplate();
    const next = upsertEngine(state, engine);
    onChange(next);
    setEditing((prev) => ({ ...prev, [engine.id]: engine }));
    onLog("INFO", "新增翻译引擎草稿");
  };

  const handlePatch = (id: string, patch: Partial<TranslatorModelConfig>) => {
    const base = editing[id] ?? state.engines.find((engine) => engine.id === id);
    if (!base) {
      return;
    }
    setEditing((prev) => ({ ...prev, [id]: { ...base, ...patch } }));
  };

  const handleSave = (id: string) => {
    const draft = editing[id];
    if (!draft) {
      return;
    }

    const next = upsertEngine(state, { ...draft, deletedAt: null });
    onChange(next);
    setEditing((prev) => {
      const copied = { ...prev };
      delete copied[id];
      return copied;
    });
    onLog("INFO", `保存翻译引擎：${draft.name}`);
  };

  const handleDelete = (id: string) => {
    const next = markEngineDeleted(state, id);
    onChange(next);
    onLog("WARN", `软删除翻译引擎：${id}`);
  };

  const handleToggleEnable = (engine: TranslatorModelConfig) => {
    const next = upsertEngine(state, { ...engine, enabled: !engine.enabled });
    onChange(next);
    onLog("INFO", `${engine.name} 已${engine.enabled ? "暂停" : "启用"}`);
  };

  const handleValidate = async (engine: TranslatorModelConfig) => {
    if (engine.provider === "ollama") {
      const result = await checkOllamaHealth(engine.endpoint, engine.model);
      onLog(result.reachable && result.modelInstalled ? "INFO" : "WARN", result.message);
      return;
    }

    onLog("INFO", `自定义引擎 ${engine.name} 已保存，运行时按配置调用`);
  };

  return (
    <section className="history-list">
      <header className="history-header">
        <h2>翻译引擎</h2>
        <div className="nav-buttons">
          <button type="button" onClick={handleCreate}>新增引擎</button>
          <span>可用 {available.length} 个</span>
        </div>
      </header>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>提供方</th>
              <th>接口地址</th>
              <th>模型</th>
              <th>凭据</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.engines.map((engine) => {
              const row = editing[engine.id] ?? engine;
              const deleted = Boolean(engine.deletedAt);

              return (
                <tr key={engine.id} className={deleted ? "row-deleted" : ""}>
                  <td>
                    <input
                      value={row.name}
                      onChange={(event) => handlePatch(engine.id, { name: event.target.value })}
                      disabled={deleted}
                    />
                  </td>
                  <td>
                    <select
                      value={row.provider}
                      onChange={(event) => handlePatch(engine.id, { provider: event.target.value as TranslatorModelConfig["provider"] })}
                      disabled={deleted}
                    >
                      <option value="ollama">ollama</option>
                      <option value="custom">custom</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={row.endpoint}
                      onChange={(event) => handlePatch(engine.id, { endpoint: event.target.value })}
                      disabled={deleted}
                    />
                  </td>
                  <td>
                    <input
                      value={row.model}
                      onChange={(event) => handlePatch(engine.id, { model: event.target.value })}
                      disabled={deleted}
                    />
                  </td>
                  <td>
                    {row.provider === "ollama" ? (
                      <span>免凭据</span>
                    ) : (
                      <div className="credential-cell">
                        <input
                          placeholder="token"
                          value={row.apiToken ?? ""}
                          onChange={(event) => handlePatch(engine.id, { apiToken: event.target.value })}
                          disabled={deleted}
                        />
                        <input
                          placeholder="用户名"
                          value={row.username ?? ""}
                          onChange={(event) => handlePatch(engine.id, { username: event.target.value })}
                          disabled={deleted}
                        />
                        <input
                          type="password"
                          placeholder="密码"
                          value={row.password ?? ""}
                          onChange={(event) => handlePatch(engine.id, { password: event.target.value })}
                          disabled={deleted}
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    {deleted ? "已删除" : engine.enabled ? "可用" : "暂停"}
                    {state.defaultEngineId === engine.id ? " / 默认" : ""}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => handleSave(engine.id)} disabled={deleted}>保存</button>
                      <button type="button" onClick={() => void handleValidate(row)} disabled={deleted}>检测</button>
                      <button type="button" onClick={() => handleToggleEnable(engine)} disabled={deleted}>
                        {engine.enabled ? "暂停" : "启用"}
                      </button>
                      <button type="button" onClick={() => onChange(setDefaultEngine(state, engine.id))} disabled={deleted}>
                        设为默认
                      </button>
                      <button type="button" onClick={() => handleDelete(engine.id)} disabled={deleted}>删除</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
