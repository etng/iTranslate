import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { githubLight } from "@uiw/codemirror-theme-github";
import { renderMarkdownToHtml } from "../services/markdown";

interface ResultViewerProps {
  markdownText: string;
  viewMode: "markdown" | "html";
  onChangeViewMode: (mode: "markdown" | "html") => void;
}

export function ResultViewer({ markdownText, viewMode, onChangeViewMode }: ResultViewerProps) {
  const html = renderMarkdownToHtml(markdownText);

  return (
    <section className="result-panel">
      <header className="result-header">
        <h3>翻译结果</h3>
        <div className="switches">
          <button
            type="button"
            className={viewMode === "markdown" ? "active" : ""}
            onClick={() => onChangeViewMode("markdown")}
          >
            Markdown
          </button>
          <button
            type="button"
            className={viewMode === "html" ? "active" : ""}
            onClick={() => onChangeViewMode("html")}
          >
            HTML 预览
          </button>
        </div>
      </header>

      {viewMode === "markdown" ? (
        <CodeMirror
          value={markdownText}
          editable={false}
          theme={githubLight}
          extensions={[markdown()]}
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
          height="100%"
        />
      ) : (
        <div className="html-preview" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </section>
  );
}
