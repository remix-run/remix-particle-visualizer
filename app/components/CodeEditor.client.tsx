import { useEffect, useRef, useCallback } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
  code: string;
  presetName: string;
  error: string | null;
  onCodeChange: (code: string) => void;
  onDone: () => void;
}

export default function CodeEditor({ code, presetName, error, onCodeChange, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;

  const handleUpdate = useCallback((update: { state: EditorState; docChanged: boolean }) => {
    if (!update.docChanged) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCodeChangeRef.current(update.state.doc.toString());
    }, 400);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.updateListener.of(handleUpdate),
        EditorView.theme({
          "&": { fontSize: "13px", height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "'JetBrains Mono', monospace", textTransform: "none" },
        }),
        keymap.of([]),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      clearTimeout(debounceRef.current);
      view.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <span className="editor-title">
          Editing: <strong>{presetName}</strong>
        </span>
        {error && <span className="editor-error">{error}</span>}
        <button className="editor-done-btn" onClick={onDone}>
          Done
        </button>
      </div>
      <div ref={containerRef} className="editor-body" />
    </div>
  );
}
