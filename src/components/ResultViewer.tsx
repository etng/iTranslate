import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { githubLight } from "@uiw/codemirror-theme-github";
import { EditorView } from "@codemirror/view";
import { renderMarkdownToHtml } from "../services/markdown";
import {
  buildMarkdownBlocks,
  getBlockIndexByLine,
  getBlockRangeByIndex,
} from "../services/markdownBlockMap";

interface ResultViewerProps {
  markdownText: string;
  viewMode: "markdown" | "html";
  onChangeViewMode: (mode: "markdown" | "html") => void;
  onVisibleBlockChange?: (blockIndex: number | null) => void;
  registerScrollToBlock?: (scrollToBlock: (blockIndex: number) => void) => void;
  onSelectLine?: (line: number) => void;
}

export function ResultViewer({
  markdownText,
  viewMode,
  onChangeViewMode,
  onVisibleBlockChange,
  registerScrollToBlock,
  onSelectLine,
}: ResultViewerProps) {
  const blocks = useMemo(() => buildMarkdownBlocks(markdownText), [markdownText]);
  const lines = useMemo(() => markdownText.split(/\r?\n/), [markdownText]);
  const htmlBlocks = useMemo(() => blocks.map((block, index) => ({
    index,
    html: renderMarkdownToHtml(lines.slice(block.startLine - 1, block.endLine).join("\n")),
  })), [blocks, lines]);
  const markdownScrollerRef = useRef<HTMLElement | null>(null);
  const htmlScrollerRef = useRef<HTMLDivElement | null>(null);
  const markdownViewRef = useRef<EditorView | null>(null);
  const suppressRef = useRef(false);
  const [markdownEditorReady, setMarkdownEditorReady] = useState(0);

  const getActiveScroller = useCallback(() => {
    if (viewMode === "markdown") {
      return markdownScrollerRef.current;
    }
    return htmlScrollerRef.current;
  }, [viewMode]);

  const detectHtmlVisibleBlock = useCallback(() => {
    const container = htmlScrollerRef.current;
    if (!container) {
      return null;
    }
    const children = Array.from(container.querySelectorAll<HTMLElement>(".result-html-block"));
    if (children.length === 0) {
      return null;
    }
    const top = container.scrollTop;
    const found = children.find((child) => child.offsetTop + child.offsetHeight > top + 2) ?? children.at(-1) ?? null;
    if (!found) {
      return null;
    }
    const index = Number.parseInt(found.dataset.blockIndex ?? "", 10);
    return Number.isFinite(index) ? index : null;
  }, []);

  const detectMarkdownVisibleBlock = useCallback(() => {
    const view = markdownViewRef.current;
    if (!view) {
      return null;
    }
    const top = view.scrollDOM.scrollTop;
    const topLineBlock = view.lineBlockAtHeight(top);
    const topLine = view.state.doc.lineAt(topLineBlock.from).number;
    return getBlockIndexByLine(markdownText, topLine);
  }, [markdownText]);

  useEffect(() => {
    if (!registerScrollToBlock) {
      return;
    }

    registerScrollToBlock((blockIndex) => {
      if (blockIndex < 0) {
        return;
      }
      suppressRef.current = true;
      if (viewMode === "markdown") {
        const view = markdownViewRef.current;
        const range = getBlockRangeByIndex(markdownText, blockIndex);
        if (view && range) {
          const safeLine = Math.min(Math.max(range.startLine, 1), view.state.doc.lines);
          const pos = view.state.doc.line(safeLine).from;
          view.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: "start" }),
          });
        }
      } else {
        const container = htmlScrollerRef.current;
        const block = container?.querySelector<HTMLElement>(`.result-html-block[data-block-index="${blockIndex}"]`);
        if (container && block) {
          container.scrollTop = block.offsetTop;
        }
      }
      requestAnimationFrame(() => {
        suppressRef.current = false;
      });
    });
  }, [markdownText, registerScrollToBlock, viewMode]);

  useEffect(() => {
    const scroller = getActiveScroller();
    if (!scroller || !onVisibleBlockChange) {
      return;
    }

    const onScroll = () => {
      if (suppressRef.current) {
        return;
      }
      if (viewMode === "markdown") {
        onVisibleBlockChange(detectMarkdownVisibleBlock());
      } else {
        onVisibleBlockChange(detectHtmlVisibleBlock());
      }
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [detectHtmlVisibleBlock, detectMarkdownVisibleBlock, getActiveScroller, markdownEditorReady, onVisibleBlockChange, viewMode]);

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
            markdownViewRef.current = view;
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
        >
          {htmlBlocks.map((block) => (
            <article
              // 按块渲染，便于左右双栏按段落同步定位
              key={block.index}
              data-block-index={block.index}
              className="result-html-block"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
