import React, { useRef, useState, useEffect } from 'react';

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

export const PinInput: React.FC<PinInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  autoFocus = true,
  disabled = false,
  className = '',
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));

  useEffect(() => {
    const chars = value.slice(0, length).split('');
    const newDigits = Array(length)
      .fill('')
      .map((_, i) => chars[i] || '');
    setDigits(newDigits);
  }, [value, length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) return;

    const char = val.slice(-1);
    const newDigits = [...digits];
    newDigits[idx] = char;
    setDigits(newDigits);

    const pinStr = newDigits.join('');
    onChange(pinStr);

    if (pinStr.length === length && onComplete) {
      onComplete(pinStr);
    }

    if (idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (!digits[idx] && idx > 0) {
        inputsRef.current[idx - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[idx] = '';
        setDigits(newDigits);
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const chars = pasted.split('');
    const newDigits = Array(length)
      .fill('')
      .map((_, i) => chars[i] || '');
    setDigits(newDigits);

    const pinStr = newDigits.join('');
    onChange(pinStr);

    if (pinStr.length === length && onComplete) {
      onComplete(pinStr);
    }

    const nextFocusIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[nextFocusIdx]?.focus();
  };

  return (
    <div
      className={`flex items-center justify-center gap-2 sm:gap-3 ${className}`}
      role="group"
      aria-label="Game PIN Input"
      onPaste={handlePaste}
    >
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete="off"
          autoFocus={autoFocus && idx === 0}
          disabled={disabled}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          aria-label={`Digit ${idx + 1}`}
          className="h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border-2 border-border bg-card text-center font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-50"
        />
      ))}
    </div>
  );
};
