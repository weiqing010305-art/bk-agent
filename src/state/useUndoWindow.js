import { useCallback, useEffect, useRef, useState } from 'react';

const WINDOW_MS = 5000;

/**
 * 5 秒可撤销窗口。
 *
 * 来源：众安银行把转账提交后留 5 秒缓冲，官方说明是为了解决「錯手轉賬」（ZA 官方原文用繁体，此处照录）。
 * 成本极低（一个倒计时），收益很大：把不可逆的恐怖操作变成可撤销的。
 *
 * 从 App.jsx 抽出来是为了守住 300 行线；它本身也是一个完整的状态机，
 * 独立成文件才好单测（倒计时结束才提交、撤销要真的清掉定时器）。
 */
export function useUndoWindow({ onCommit, onCancel }) {
  const [undo, setUndo] = useState(null);
  const timer = useRef(null);

  const open = useCallback((action, label) => {
    clearTimeout(timer.current);
    setUndo({ action, label, deadline: Date.now() + WINDOW_MS });
    timer.current = setTimeout(() => {
      timer.current = null;
      setUndo(null);
      onCommit(action);
    }, WINDOW_MS);
  }, [onCommit]);

  const cancel = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setUndo(null);
    onCancel();
  }, [onCancel]);

  /* 组件卸载时一定要清掉，否则用户离开页面后那笔钱还会"自己转出去" */
  useEffect(() => () => clearTimeout(timer.current), []);

  return { undo, open, cancel };
}
