/**
 * state/useThreadScroll.js —— 滚动锚定
 * ============================================================================
 * 实现依据 doc/research/chatbox-best-practices.md §3.4（四家开源实现横向对比后的合成方案）：
 *
 *  · **非对称迟滞**：向上脱离 24px 就停止跟随，但必须回到距底 32px 以内才恢复跟随。
 *    对称阈值在流式输出时永远吸附不上（底部是移动靶）。
 *  · **每帧直写 scrollTop**：LibreChat 注释原文 ——
 *    "每帧直写读起来是文字向上流动，145ms 节流读起来是线程在抽搐"。
 *  · **意图优先**：wheel / touchmove 方向比 scroll 位置更早表达用户意图。
 *  · **依赖里必须含最后一条内容**：只订阅数量的话，流式期间长度变了但数量没变，不会滚。
 *
 * 不引入 use-stick-to-bottom（MIT，778★）—— 算法 60 行，没必要加依赖。
 */

import { useCallback, useEffect, useRef } from 'react';

const REATTACH_PX = 32;   // 距底多少像素内算"在底部"
const DETACH_PX = 24;     // 用户向上滚动多少像素就脱离跟随

export function useThreadScroll(signal) {
  const scrollRef = useRef(null);
  const followRef = useRef(true);
  const lastTopRef = useRef(-1);   // -1 = 还没有样本，避免首个 scroll 事件误判

  const atBottom = useCallback(el => {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= REATTACH_PX;
  }, []);

  // 用户意图：一旦向上滑就立刻脱离，不等 scroll 事件
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const up = () => { followRef.current = false; };
    const onWheel = e => { if (e.deltaY < 0) up(); };
    let lastY = null;
    const onTouchStart = e => { lastY = e.touches[0].clientY; };
    const onTouchMove = e => {
      if (lastY === null) return;
      if (e.touches[0].clientY > lastY) up();   // 手指下移 = 内容上滚
      lastY = e.touches[0].clientY;
    };
    const onKey = e => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) up(); };
    const onScroll = () => {
      const top = el.scrollTop;
      if (lastTopRef.current >= 0 && top < lastTopRef.current - DETACH_PX) up();
      lastTopRef.current = top;
      if (atBottom(el)) followRef.current = true;   // 回到底部就恢复跟随
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('keydown', onKey);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('scroll', onScroll);
    };
  }, [atBottom]);

  // 内容变化后跟随。rAF 里直写 scrollTop，不用 behavior:'smooth'（每个 token 起一次动画会互相打断）
  useEffect(() => {
    if (!followRef.current) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    const id = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    return () => cancelAnimationFrame(id);
  }, [signal]);

  /**
   * 显式发送（打字回车、点功能卡）时强制恢复跟随。
   * 理由：用户主动发起一次对话，就应该看到回复；
   * 「不要拽用户」只适用于流式增长这种被动变化。
   */
  const resumeFollow = useCallback(() => { followRef.current = true; }, []);

  return { scrollRef, resumeFollow, isFollowing: () => followRef.current };
}
