import React, { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';

/**
 * 5 秒可撤销条。
 *
 * 来源：众安银行把「转账」提交后留 5 秒缓冲，官方说明是为了解决"錯手轉賬"（ZA 官方原文用繁体，此处照录）。
 * 成本极低（一个倒计时），收益很大：把不可逆的恐怖操作变成可撤销的。
 * 见 doc/research/za-bank-product-layer.md §A.2.5 ④。
 *
 * 倒计时由本组件自己持有，父组件只给一个 deadline —— 这样父组件不会每秒重渲染。
 */
const TOTAL = 5000;

export default function UndoBar({ label, deadline, onCancel }) {
  const [left, setLeft] = useState(TOTAL);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 80);
    return () => clearInterval(id);
  }, [deadline]);

  const pct = Math.max(0, Math.min(100, (left / TOTAL) * 100));

  return <div className="undo-bar" role="status" aria-live="polite">
    <span className="undo-fill" style={{ width: pct + '%' }} aria-hidden="true"/>
    <span className="undo-text">{label}</span>
    <button className="undo-btn" onClick={onCancel}>
      <Undo2 size={15}/> 撤销（{Math.ceil(left / 1000)}s）
    </button>
  </div>;
}
