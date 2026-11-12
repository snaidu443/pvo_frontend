import { useEffect, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'onBlur'> & {
  value: string;
  /** Called on blur or Enter when the text changed. Return false to reject and restore the previous value. */
  onCommit: (value: string) => boolean | void;
};

/**
 * Text input that commits like a native `change` event (blur / Enter) instead of
 * on every keystroke, matching v03 behaviour for governed values.
 */
export function CommitInput({ value, onCommit, onKeyDown, ...rest }: Props) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);

  const commit = () => {
    if (text === value) return;
    if (onCommit(text) === false) setText(value);
  };

  return (
    <input
      {...rest}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        onKeyDown?.(e);
      }}
    />
  );
}
