import React, { useLayoutEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * 输入区：功能层，允许玻璃。
 *
 * 中文 IME 三级防护（doc/research/chatbox-best-practices.md §2.4），缺一层就会
 * 「候选框闪一下消失，根本打不了中文」：
 *   ① e.nativeEvent.isComposing
 *   ② composition 状态位（**必须用 useRef**，state 在同一帧的 keydown 里读到的是旧值）
 *   ③ Safari 兜底：只忽略 compositionend 同帧的确认回车，不吞掉之后主动按下的回车
 *
 * Enter 提交走「读按钮 disabled 再 requestSubmit」——让按钮可点性成为唯一门禁，
 * 键盘与鼠标行为天然一致，不会出现「按钮灰了但回车还能发」。
 */
export default function Composer({ ctx }) {
  const { submit, draft, setDraft } = ctx;
  const ref = useRef(null);
  const composingRef = useRef(false);
  const endedAtRef = useRef(null);

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
    const elapsed = endedAtRef.current === null ? null : e.timeStamp - endedAtRef.current;
    endedAtRef.current = null;
    if (elapsed !== null && elapsed >= 0 && elapsed < 16) return;
    e.preventDefault();
    if (e.repeat) return;
    const form = e.currentTarget.form;
    const btn = form && form.querySelector('button[type="submit"]');
    if (btn && !btn.disabled) form.requestSubmit();
  };

  return <div className="composer-wrap">
    <div className="composer-inner">
      {/* placeholder 保留具体例子而不是「或选择上方的快捷功能」：
          入口在欢迎消息里，往上滚就看不见了，「上方」会变成假指路。 */}
      <form className="composer" onSubmit={submit}>
        <textarea
          ref={ref} rows={1} aria-label="输入消息" aria-keyshortcuts="Enter" enterKeyHint="send"
          placeholder="给王佩兰转 100 元"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={e => { composingRef.current = false; endedAtRef.current = e.timeStamp; }}
        />
        <button className="send" type="submit" disabled={!draft.trim() || ctx.agent?.busy} aria-label="发送"><ArrowUp size={18}/></button>
      </form>
      {/* 这里曾经有一行「演示对话由预设规则驱动，暂未接入真实 AI 或银行系统」。
          删掉的理由不是"少写一个字"，而是：**输入框下面挂免责声明，是在用文字替设计道歉。**
          placeholder 已经把「能做什么」示范清楚了（给张三转 100 元）。
          边界说明属于交付文档，不属于界面。 */}
    </div>
  </div>;
}
