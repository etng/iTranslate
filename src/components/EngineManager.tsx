import { useMemo, useState } from "react";
import { Activity, Power, Save, ShieldCheck, Star, Trash2 } from "lucide-react";
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
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [providerFilter, setProviderFilter] = useState<"" | TranslatorModelConfig["provider"]>("");
  const [statusFilter, setStatusFilter] = useState<"" | "available" | "paused" | "deleted">("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const available = useMemo(() => getAvailableEngines(state.engines), [state.engines]);
  const filteredEngines = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return state.engines.filter((engine) => {
      if (providerFilter && engine.provider !== providerFilter) {
        return false;
      }

      if (statusFilter === "available" && (engine.deletedAt || !engine.enabled)) {
        return false;
      }
      if (statusFilter === "paused" && (engine.deletedAt || engine.enabled)) {
        return false;
      }
      if (statusFilter === "deleted" && !engine.deletedAt) {
        return false;
      }

      if (!search) {
        return true;
      }
      const text = `${engine.name}\n${engine.endpoint}\n${engine.model}`.toLowerCase();
      return text.includes(search);
    });
  }, [keyword, providerFilter, state.engines, statusFilter]);
  const selectableFilteredIds = useMemo(() => {
    return filteredEngines.filter((engine) => !engine.deletedAt).map((engine) => engine.id);
  }, [filteredEngines]);
  const validSelectedIds = useMemo(() => {
    const idSet = new Set(state.engines.map((engine) => engine.id));
    return selectedIds.filter((id) => idSet.has(id));
  }, [selectedIds, state.engines]);
  const allSelected = selectableFilteredIds.length > 0
    && selectableFilteredIds.every((id) => validSelectedIds.includes(id));

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
    setSaveErrors((prev) => {
      if (!prev[id]) {
        return prev;
      }
      const copied = { ...prev };
      delete copied[id];
      return copied;
    });
  };

  const handleSave = (id: string) => {
    const draft = editing[id];
    if (!draft) {
      return;
    }

    const missing: string[] = [];
    if (!draft.name.trim()) {
      missing.push("名称");
    }
    if (!draft.endpoint.trim()) {
      missing.push("接口地址");
    }
    if (!draft.model.trim()) {
      missing.push("模型");
    }
    if (missing.length > 0) {
      const message = `保存失败：请填写${missing.join("、")}`;
      setSaveErrors((prev) => ({ ...prev, [id]: message }));
      onLog("WARN", `${draft.name || "未命名引擎"} ${message}`);
      return;
    }

    let endpoint: URL;
    try {
      endpoint = new URL(draft.endpoint);
    } catch {
      const message = "保存失败：接口地址必须是有效 URL";
      setSaveErrors((prev) => ({ ...prev, [id]: message }));
      onLog("WARN", `${draft.name || "未命名引擎"} ${message}`);
      return;
    }
    if (!/^https?:$/.test(endpoint.protocol)) {
      const message = "保存失败：接口地址仅支持 http/https";
      setSaveErrors((prev) => ({ ...prev, [id]: message }));
      onLog("WARN", `${draft.name || "未命名引擎"} ${message}`);
      return;
    }

    const next = upsertEngine(state, { ...draft, deletedAt: null });
    onChange(next);
    setSaveErrors((prev) => {
      const copied = { ...prev };
      delete copied[id];
      return copied;
    });
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
    setSaveErrors((prev) => {
      const copied = { ...prev };
      delete copied[id];
      return copied;
    });
    onLog("WARN", `软删除翻译引擎：${id}`);
  };

  const handleToggleEnable = (engine: TranslatorModelConfig) => {
    const next = upsertEngine(state, { ...engine, enabled: !engine.enabled });
    onChange(next);
    onLog("INFO", `${engine.name} 已${engine.enabled ? "暂停" : "启用"}`);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const handleSelectAllFiltered = () => {
    if (allSelected) {
      setSelectedIds(validSelectedIds.filter((id) => !selectableFilteredIds.includes(id)));
      return;
    }

    setSelectedIds(() => {
      const merged = new Set([...validSelectedIds, ...selectableFilteredIds]);
      return Array.from(merged);
    });
  };

  const handleBatchToggleEnable = (enabled: boolean) => {
    if (validSelectedIds.length === 0) {
      return;
    }
    const selectedSet = new Set(validSelectedIds);
    const nextEngines = state.engines.map((engine) => {
      if (!selectedSet.has(engine.id) || engine.deletedAt) {
        return engine;
      }
      return { ...engine, enabled };
    });
    onChange({ ...state, engines: nextEngines });
    onLog("INFO", `批量${enabled ? "启用" : "暂停"}引擎：${validSelectedIds.length} 个`);
  };

  const handleBatchDelete = () => {
    if (validSelectedIds.length === 0) {
      return;
    }
    const selectedSet = new Set(validSelectedIds);
    const nextEngines = state.engines.map((engine) => {
      if (!selectedSet.has(engine.id) || engine.deletedAt) {
        return engine;
      }
      return { ...engine, enabled: false, deletedAt: new Date().toISOString() };
    });
    const nextDefault = selectedSet.has(state.defaultEngineId ?? "") ? null : state.defaultEngineId;
    onChange({ engines: nextEngines, defaultEngineId: nextDefault });
    setSelectedIds([]);
    onLog("WARN", `批量删除引擎：${selectedSet.size} 个`);
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
          <button type="button" onClick={() => handleBatchToggleEnable(true)} disabled={validSelectedIds.length === 0}>
            批量启用
          </button>
          <button type="button" onClick={() => handleBatchToggleEnable(false)} disabled={validSelectedIds.length === 0}>
            批量暂停
          </button>
          <button type="button" onClick={handleBatchDelete} disabled={validSelectedIds.length === 0}>批量删除</button>
          <span>可用 {available.length} 个 / 筛选后 {filteredEngines.length} 个</span>
        </div>
      </header>

      <section className="history-filters">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索名称/地址/模型"
          aria-label="引擎搜索"
        />
        <select
          value={providerFilter}
          onChange={(event) => setProviderFilter(event.target.value as "" | TranslatorModelConfig["provider"])}
          aria-label="筛选提供方"
        >
          <option value="">全部提供方</option>
          <option value="ollama">ollama</option>
          <option value="custom">custom</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "" | "available" | "paused" | "deleted")}
          aria-label="筛选引擎状态"
        >
          <option value="">全部状态</option>
          <option value="available">可用</option>
          <option value="paused">暂停</option>
          <option value="deleted">已删除</option>
        </select>
      </section>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAllFiltered}
                  aria-label="全选引擎"
                />
              </th>
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
            {filteredEngines.map((engine) => {
              const row = editing[engine.id] ?? engine;
              const deleted = Boolean(engine.deletedAt);

              return (
                <tr key={engine.id} className={deleted ? "row-deleted" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={validSelectedIds.includes(engine.id)}
                      onChange={() => handleToggleSelect(engine.id)}
                      disabled={deleted}
                      aria-label={`选择引擎-${engine.name}`}
                    />
                  </td>
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
                      <button
                        type="button"
                        title="保存"
                        aria-label="保存"
                        className="icon-btn icon-only"
                        onClick={() => handleSave(engine.id)}
                        disabled={deleted}
                      >
                        <Save size={16} />
                      </button>
                      <button
                        type="button"
                        title="检测"
                        aria-label="检测"
                        className="icon-btn icon-only"
                        onClick={() => void handleValidate(row)}
                        disabled={deleted}
                      >
                        <ShieldCheck size={16} />
                      </button>
                      <button
                        type="button"
                        title={engine.enabled ? "暂停" : "启用"}
                        aria-label={engine.enabled ? "暂停" : "启用"}
                        className="icon-btn icon-only"
                        onClick={() => handleToggleEnable(engine)}
                        disabled={deleted}
                      >
                        {engine.enabled ? <Power size={16} /> : <Activity size={16} />}
                      </button>
                      <button
                        type="button"
                        title="设为默认"
                        aria-label="设为默认"
                        className="icon-btn icon-only"
                        onClick={() => onChange(setDefaultEngine(state, engine.id))}
                        disabled={deleted}
                      >
                        <Star size={16} />
                      </button>
                      <button
                        type="button"
                        title="删除"
                        aria-label="删除"
                        className="icon-btn icon-only"
                        onClick={() => handleDelete(engine.id)}
                        disabled={deleted}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {saveErrors[engine.id] ? <p className="field-error">{saveErrors[engine.id]}</p> : null}
                  </td>
                </tr>
              );
            })}
            {filteredEngines.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">没有符合条件的引擎</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
