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
  onScrollRatioChange?: (ratio: number) => void;
  registerApplyScrollRatio?: (apply: (ratio: number) => void) => void;
  highlightedRange?: { startLine: number; endLine: number } | null;
}

function calcRatio(textarea: HTMLTextAreaElement): number {
  const max = textarea.scrollHeight - textarea.clientHeight;
  if (max <= 0) {
    return 0;
  }
  return textarea.scrollTop / max;
}

function applyRatio(textarea: HTMLTextAreaElement, ratio: number): void {
  const max = textarea.scrollHeight - textarea.clientHeight;
  textarea.scrollTop = max > 0 ? max * ratio : 0;
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
  onScrollRatioChange,
  registerApplyScrollRatio,
  highlightedRange,
}: LineNumberTextareaProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const suppressRef = useRef(false);

  const numbers = useMemo(() => {
    const count = Math.max(1, value.split("\n").length);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [value]);

  useEffect(() => {
    if (!registerApplyScrollRatio) {
      return;
    }

    registerApplyScrollRatio((ratio) => {
      const textarea = localRef.current;
      if (!textarea) {
        return;
      }
      suppressRef.current = true;
      applyRatio(textarea, ratio);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textarea.scrollTop;
      }
      requestAnimationFrame(() => {
        suppressRef.current = false;
      });
    });
  }, [registerApplyScrollRatio]);

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
    if (suppressRef.current || !onScrollRatioChange) {
      return;
    }
    onScrollRatioChange(calcRatio(textarea));
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
