import React, { useLayoutEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * 输入区：功能层，允许玻璃。
 *
 * 中文 IME 三级防护（doc/research/chatbox-best-practices.md §2.4），缺一层就会
 * 「候选框闪一下消失，根本打不了中文」：
 *   ① e.nativeEvent.isComposing
 *   ② composition 状态位（**必须用 useRef**，state 在同一帧的 keydown 里读到的是旧值）
 *   ③ Safari 兜底：Safari 确认候选词时先发 compositionend 再发 keydown，前两层全部失效
 *
 * Enter 提交走「读按钮 disabled 再 requestSubmit」——让按钮可点性成为唯一门禁，
 * 键盘与鼠标行为天然一致，不会出现「按钮灰了但回车还能发」。
 */
export default function Composer({ ctx }) {
  const { submit, draft, setDraft } = ctx;
  const ref = useRef(null);
  const composingRef = useRef(false);
  const endedAtRef = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [draft]);

  const onKeyDown = e => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing || composingRef.current) return;
    if (e.keyCode === 229) return;
    if (Math.abs(e.timeStamp - endedAtRef.current) < 500) return;
    e.preventDefault();
    const form = e.currentTarget.form;
    const btn = form && form.querySelector('button[type="submit"]');
    if (btn && !btn.disabled) form.requestSubmit();
  };

  return <div className="composer-wrap">
    <div className="composer-inner">
      <form className="composer" onSubmit={submit}>
        <textarea
          ref={ref} rows={1} aria-label="输入消息"
          placeholder="说一句话就开始，比如「给张三转 100 元」"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={e => { composingRef.current = false; endedAtRef.current = e.timeStamp; }}
        />
        <button className="send" type="submit" disabled={!draft.trim()} aria-label="发送"><ArrowUp size={18}/></button>
      </form>
      <p className="hint">演示对话由预设规则驱动，暂未接入真实 AI 或银行系统</p>
    </div>
  </div>;
}
