import {
  useEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type RefObject,
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
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onScrollRatioChange?: (ratio: number) => void;
  registerApplyScrollRatio?: (apply: (ratio: number) => void) => void;
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
}: LineNumberTextareaProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const suppressRef = useRef(false);

  const numbers = useMemo(() => {
    const count = Math.max(1, value.split("\n").length);
    return Array.from({ length: count }, (_, index) => `${index + 1}`).join("\n");
  }, [value]);

  useEffect(() => {
    if (!registerApplyScrollRatio) {
      return;
    }

    registerApplyScrollRatio((ratio) => {
      const textarea = textareaRef?.current ?? localRef.current;
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
  }, [registerApplyScrollRatio, textareaRef]);

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

  return (
    <div className={`line-editor ${className ?? ""}`}>
      <div ref={gutterRef} className="line-gutter" aria-hidden="true">
        <pre>{numbers}</pre>
      </div>
      <textarea
        ref={textareaRef ?? localRef}
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
