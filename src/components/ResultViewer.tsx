import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { githubLight } from "@uiw/codemirror-theme-github";
import { EditorView } from "@codemirror/view";
import { renderMarkdownToHtml } from "../services/markdown";

interface ResultViewerProps {
  markdownText: string;
  viewMode: "markdown" | "html";
  onChangeViewMode: (mode: "markdown" | "html") => void;
  onScrollRatioChange?: (ratio: number) => void;
  registerApplyScrollRatio?: (apply: (ratio: number) => void) => void;
  onSelectLine?: (line: number) => void;
}

function calcScrollRatio(container: HTMLElement): number {
  const max = container.scrollHeight - container.clientHeight;
  if (max <= 0) {
    return 0;
  }
  return container.scrollTop / max;
}

function applyScrollRatio(container: HTMLElement, ratio: number): void {
  const max = container.scrollHeight - container.clientHeight;
  container.scrollTop = max > 0 ? max * ratio : 0;
}

export function ResultViewer({
  markdownText,
  viewMode,
  onChangeViewMode,
  onScrollRatioChange,
  registerApplyScrollRatio,
  onSelectLine,
}: ResultViewerProps) {
  const html = renderMarkdownToHtml(markdownText);
  const markdownScrollerRef = useRef<HTMLElement | null>(null);
  const htmlScrollerRef = useRef<HTMLDivElement | null>(null);
  const suppressRef = useRef(false);
  const [markdownEditorReady, setMarkdownEditorReady] = useState(0);

  const getActiveScroller = useCallback(() => {
    if (viewMode === "markdown") {
      return markdownScrollerRef.current;
    }
    return htmlScrollerRef.current;
  }, [viewMode]);

  useEffect(() => {
    if (!registerApplyScrollRatio) {
      return;
    }

    registerApplyScrollRatio((ratio) => {
      const scroller = getActiveScroller();
      if (!scroller) {
        return;
      }
      suppressRef.current = true;
      applyScrollRatio(scroller, ratio);
      requestAnimationFrame(() => {
        suppressRef.current = false;
      });
    });
  }, [getActiveScroller, registerApplyScrollRatio]);

  useEffect(() => {
    const scroller = getActiveScroller();
    if (!scroller || !onScrollRatioChange) {
      return;
    }

    const onScroll = () => {
      if (suppressRef.current) {
        return;
      }
      onScrollRatioChange(calcScrollRatio(scroller));
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [getActiveScroller, markdownEditorReady, onScrollRatioChange]);

  const selectLineExtension = useMemo(() => {
    return EditorView.domEventHandlers({
      mousedown: (event, view) => {
        if (!onSelectLine) {
          return false;
        }
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) {
          return false;
        }
        onSelectLine(view.state.doc.lineAt(pos).number);
        return false;
      },
    });
  }, [onSelectLine]);

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
          className="result-codemirror"
          value={markdownText}
          editable={false}
          theme={githubLight}
          extensions={[
            markdown(),
            EditorView.lineWrapping,
            selectLineExtension,
          ]}
          onCreateEditor={(view) => {
            markdownScrollerRef.current = view.scrollDOM;
            setMarkdownEditorReady((value) => value + 1);
          }}
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
          height="100%"
        />
      ) : (
        <div
          ref={htmlScrollerRef}
          className="html-preview"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </section>
  );
}
