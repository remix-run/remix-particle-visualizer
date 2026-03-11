import type { ValidationResult } from "./types";

const FORBIDDEN_PATTERNS = [
  /\bdocument\b/,
  /\bwindow\b/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\beval\b/,
  /\bFunction\s*\(/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bprocess\b/,
  /\b__proto__\b/,
  /\.prototype\b/,
  /\bglobalThis\b/,
  /\bself\b/,
  /\blocation\b/,
  /\bnavigator\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\bcrypto\b/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\balert\s*\(/,
  /\bconfirm\s*\(/,
  /\bprompt\s*\(/,
];

function scanPatterns(code: string): string | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      const match = code.match(pattern);
      return `Forbidden pattern detected: "${match?.[0]}"`;
    }
  }
  return null;
}

function dryRun(code: string): string | null {
  try {
    const fn = new Function(
      "i", "count", "target", "color", "time", "THREE", "addControl", "setInfo", "annotate",
      code
    );

    const mockTarget = { set(_x: number, _y: number, _z: number) {}, x: 0, y: 0, z: 0 };
    const mockColor = {
      setHSL(_h: number, _s: number, _l: number) {},
      set(_c: unknown) {},
      r: 0, g: 0, b: 0,
    };
    const mockAddControl = (_id: string, _label: string, _min: number, _max: number, initial: number) => initial;
    const mockSetInfo = () => {};
    const mockAnnotate = () => {};
    const mockTHREE = { Vector3: class { constructor() {} set() {} }, Color: class {} };

    fn(0, 1, mockTarget, mockColor, 0, mockTHREE, mockAddControl, mockSetInfo, mockAnnotate);
    return null;
  } catch (err) {
    return `Runtime error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export function validate(code: string): ValidationResult {
  const patternError = scanPatterns(code);
  if (patternError) {
    return { valid: false, error: patternError };
  }

  const runtimeError = dryRun(code);
  if (runtimeError) {
    return { valid: false, error: runtimeError };
  }

  return { valid: true };
}
