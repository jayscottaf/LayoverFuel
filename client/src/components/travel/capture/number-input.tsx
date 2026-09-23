import { useEffect, useState, type InputHTMLAttributes } from "react";

function format(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "0";
  const f = 10 ** decimals;
  return String(Math.round(value * f) / f);
}

/** Keep digits and a single decimal point; accept a comma as the decimal separator. */
function sanitize(raw: string): string {
  const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

/**
 * Nonnegative decimal input. Holds its own text while focused so partial input
 * like "1." survives; commits a clamped number on every change.
 */
export function NumberInput({
  value,
  onValue,
  decimals = 1,
  ...rest
}: {
  value: number;
  onValue: (n: number) => void;
  decimals?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode">) {
  const [text, setText] = useState(() => format(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(format(value, decimals));
  }, [value, focused, decimals]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onFocus={e => {
        setFocused(true);
        e.currentTarget.select();
        rest.onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      onChange={e => {
        const next = sanitize(e.target.value);
        setText(next);
        const n = parseFloat(next);
        onValue(Number.isFinite(n) && n > 0 ? n : 0);
      }}
    />
  );
}
