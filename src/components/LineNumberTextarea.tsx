import {
  useEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type UIEvent,
} from "react";

interface LineNumberTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  onVisibleLineChange?: (line: number) => void;
  registerScrollToLine?: (scrollToLine: (line: number) => void) => void;
  highlightedRange?: { startLine: number; endLine: number } | null;
}

export function LineNumberTextarea({
  value,
  onChange,
  onPaste,
  onKeyDown,
  readOnly,
  placeholder,
  className,
  textareaRef,
  onVisibleLineChange,
  registerScrollToLine,
  highlightedRange,
}: LineNumberTextareaProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const suppressRef = useRef(false);
  const lastVisibleLineRef = useRef(1);

  const numbers = useMemo(() => {
    const count = Math.max(1, value.split("\n").length);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [value]);

  useEffect(() => {
    if (!registerScrollToLine) {
      return;
    }

    registerScrollToLine((line) => {
      const textarea = localRef.current;
      if (!textarea) {
        return;
      }
      const computed = window.getComputedStyle(textarea);
      const parsedLineHeight = Number.parseFloat(computed.lineHeight);
      const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : 20;
      suppressRef.current = true;
      textarea.scrollTop = Math.max(0, (line - 1) * lineHeight);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textarea.scrollTop;
      }
      requestAnimationFrame(() => {
        suppressRef.current = false;
      });
    });
  }, [registerScrollToLine]);

  useEffect(() => {
    if (!highlightedRange || highlightedRange.startLine < 1) {
      return;
    }

    const textarea = localRef.current;
    if (!textarea) {
      return;
    }

    const computed = window.getComputedStyle(textarea);
    const parsedLineHeight = Number.parseFloat(computed.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : 20;
    const targetTop = (highlightedRange.startLine - 1) * lineHeight;
    const targetBottom = targetTop + lineHeight;

    if (targetTop >= textarea.scrollTop && targetBottom <= textarea.scrollTop + textarea.clientHeight) {
      return;
    }

    const centeredTop = Math.max(0, targetTop - textarea.clientHeight / 2 + lineHeight / 2);
    suppressRef.current = true;
    textarea.scrollTop = centeredTop;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
    requestAnimationFrame(() => {
      suppressRef.current = false;
    });
  }, [highlightedRange]);

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
    const computed = window.getComputedStyle(textarea);
    const parsedLineHeight = Number.parseFloat(computed.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : 20;
    const visibleLine = Math.max(1, Math.floor(textarea.scrollTop / lineHeight) + 1);

    if (!suppressRef.current && onVisibleLineChange && visibleLine !== lastVisibleLineRef.current) {
      lastVisibleLineRef.current = visibleLine;
      onVisibleLineChange(visibleLine);
    }

    if (suppressRef.current) {
      return;
    }
  };

  const handleTextareaRef = (node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (textareaRef) {
      textareaRef.current = node;
    }
  };

  return (
    <div className={`line-editor ${className ?? ""}`}>
      <div ref={gutterRef} className="line-gutter" aria-hidden="true">
        {numbers.map((line) => (
          <div
            key={line}
            className={`line-gutter-line ${highlightedRange && line >= highlightedRange.startLine && line <= highlightedRange.endLine ? "active" : ""}`}
          >
            {line}
          </div>
        ))}
      </div>
      <textarea
        ref={handleTextareaRef}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
      />
    </div>
  );
}
