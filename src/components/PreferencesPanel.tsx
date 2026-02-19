import { open } from "@tauri-apps/plugin-dialog";
import { CircleHelp, Eraser, FolderOpen } from "lucide-react";
import { useState } from "react";
import type { UserPreferences } from "../types";
import { isTauriRuntime } from "../utils/runtime";
import alipayPlaceholder from "../assets/payment/alipay-placeholder.svg";
import wechatPlaceholder from "../assets/payment/wechat-placeholder.svg";

interface PreferencesPanelProps {
  value: UserPreferences;
  onChange: (next: UserPreferences) => void;
}

export function PreferencesPanel({ value, onChange }: PreferencesPanelProps) {
  const [showPaymentHelp, setShowPaymentHelp] = useState(false);

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
          <button
            type="button"
            title="选择目录"
            aria-label="选择目录"
            className="icon-btn icon-only"
            onClick={() => void handleChooseDir()}
          >
            <FolderOpen size={16} />
          </button>
          <button
            type="button"
            title="清空默认目录"
            aria-label="清空默认目录"
            className="icon-btn icon-only"
            onClick={() => onChange({ ...value, epubDefaultExportDir: null })}
          >
            <Eraser size={16} />
          </button>
        </div>

        <label className="inline-check">
          {value.epubPaidUnlocked ? (
            <span className="paid-status">已诚信付费</span>
          ) : (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChange({ ...value, epubPaidUnlocked: true })}
            >
              我已诚信付费
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-only"
            title="查看付费说明"
            aria-label="查看付费说明"
            onClick={() => setShowPaymentHelp(true)}
          >
            <CircleHelp size={16} />
          </button>
        </label>
      </div>

      {showPaymentHelp ? (
        <div className="modal-mask" role="dialog" aria-modal="true" aria-label="付费说明">
          <section className="modal-card">
            <header className="history-header">
              <h3>付费说明</h3>
              <button type="button" onClick={() => setShowPaymentHelp(false)}>关闭</button>
            </header>
            <div className="wizard-form">
              <p className="status-label">
                为了控制默认任务耗时，EPUB 闭环默认仅处理前 5 章。完成付费后点击“我已诚信付费”即可开启完整导出。
              </p>
              <p className="status-label">请通过以下方式付款（示意二维码，后续可替换为真实收款码）：</p>
              <div className="payment-grid">
                <figure>
                  <img src={alipayPlaceholder} alt="支付宝付款二维码示意图" />
                  <figcaption>支付宝</figcaption>
                </figure>
                <figure>
                  <img src={wechatPlaceholder} alt="微信付款二维码示意图" />
                  <figcaption>微信</figcaption>
                </figure>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
