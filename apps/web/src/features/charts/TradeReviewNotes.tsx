import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY_PREFIX = 'trade-review';

function storageKey(accountId: string, dateStr: string, symbol: string): string {
  return `${STORAGE_KEY_PREFIX}-${accountId}-${dateStr}-${symbol}`;
}

type Props = {
  accountId: string;
  /** 日期 yyyy-MM-dd */
  dateStr: string;
  symbol: string;
};

export default function TradeReviewNotes({
  accountId,
  dateStr,
  symbol,
}: Props) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const key = storageKey(accountId, dateStr, symbol);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setValue(raw ?? '');
    } catch {
      setValue('');
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, value);
        setSaved(true);
        if (savedHideRef.current) clearTimeout(savedHideRef.current);
        savedHideRef.current = setTimeout(() => setSaved(false), 1500);
      } catch {
        setSaved(false);
      }
      saveTimeoutRef.current = null;
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedHideRef.current) clearTimeout(savedHideRef.current);
    };
  }, [key, value]);

  return (
    <div className="trade-review-notes">
      <div className="trade-review-notes-header">
        <h3>交易复盘笔记</h3>
        {saved && <span className="trade-review-saved">已自动保存</span>}
      </div>
      <textarea
        className="trade-review-textarea"
        placeholder="记录当日该交易对的复盘：入场理由、出场原因、盈亏归因、下次改进…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        aria-label="交易复盘笔记"
      />
    </div>
  );
}
