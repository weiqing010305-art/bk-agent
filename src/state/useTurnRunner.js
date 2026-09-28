import { useCallback } from 'react';
import { applyMessages } from '../a2ui/apply.js';
import { fromAction, fromText, parseIntent } from '../agent/planner.js';
import { buildTaskGraph, withOrder, interrupt, rollback, handoff, nextRunnable } from '../agent/taskGraph.js';

/** 需要拆解成 DAG 的复杂任务。简单的查询不建图 —— 那是噪音。 */
const COMPLEX = new Set(['transfer.scheduled', 'transfer.aa', 'occasion', 'bills', 'report']);

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * 回合执行：把一次请求变成一条对话回合。
 *
 * 从 App.jsx 抽出来 —— 它是「输入 → 计划 → A2UI 信封 → 落进会话」这一整条链，
 * 与 UI 无关，而且 App 已经贴着 300 行线。
 *
 * 两个入口共用同一个内核：
 *   runText   业务层 —— 先过注入筛查，再识别意图
 *   runAction 产品层 —— 跳过意图理解，直接开功能
 * 两条路最终都落到同一份 A2UI 信封上，这正是「统一入口」的证据。
 */
export function useTurnRunner({ history, a2ui, turns, ctxFor, record, resumeFollow, startTransfer, screen, setPreviewId, contacts = [] }) {
  /**
   * 任务编排的执行控制（赛题点名要求「中断、回退、人工接管」）。
   * 图存在回合上，所以每个任务各自独立；操作只改自己那一个。
   */
  const taskControl = useCallback((turnId, op) => {
    history.patchTurns(ts => ts.map(t => {
      if (t.id !== turnId || !t.task) return t;
      let g = t.task;
      if (op === 'interrupt') g = interrupt(g);
      else if (op === 'resume') g = { ...g, interrupted: false, handoff: null };
      else if (op === 'handoff') {
        const n = nextRunnable(g) || g.nodes.find(x => x.status === 'pending') || g.nodes[0];
        g = handoff(g, n.id, '你把这一步接过去了');
      } else if (op === 'rollback') {
        const doneIds = g.order.filter(id => g.nodes.find(x => x.id === id).status === 'done');
        const target = doneIds[doneIds.length - 1] || g.order[0];
        g = rollback(g, target);
      }
      return { ...t, task: g };
    }));
  }, [history]);

  /** 先占位再填充：surface 数据立刻可用，但那条消息先显示骨架，隔一拍才落内容。 */
  const settle = useCallback(turnId => {
    setTimeout(() => {
      history.patchTurns(ts => ts.map(x => (x.id === turnId ? { ...x, pending: false } : x)));
    }, 420);
  }, [history]);

  const runText = useCallback(text => {
    /* 入口筛查：纵深防御第二层（第一层是结构性白名单，见 services/guard.js） */
    const screened = screen(text);
    if (!screened.ok) {
      history.patch({ turns: [...turns, { id: uid(), role: 'user', text }, { id: uid(), role: 'assistant', blocked: screened }] });
      setPreviewId(null);
      return;
    }
    const { action, slots } = parseIntent(text);
    /* 转账家族走四步流程；已经说出来的东西直接填好，能跳步就跳步。
       定时与 AA 是转账的近亲，共用同一个流程内核，区别只在意图与任务编排。 */
    if (action === 'transfer' || action === 'transfer.scheduled' || action === 'transfer.aa') {
      /* 复杂转账也要建图 —— 任务编排不该只在"简单查询"那条路上可见。 */
      let task = COMPLEX.has(action) ? withOrder(buildTaskGraph({ action, slots }, { contacts })) : null;
      if (task) {
        const first = nextRunnable(task);
        if (first) task = { ...task, nodes: task.nodes.map(n => n.id === first.id ? { ...n, status: 'running' } : n) };
      }
      return startTransfer(slots, text, task);
    }

    const surfaceId = uid();
    const envelopes = fromText(text, ctxFor(surfaceId));
    resumeFollow();
    const turnId = uid();
    /* 复杂任务才建图。建了就先跑第一步，让用户看到"Agent 说到做到"。 */
    let task = COMPLEX.has(action) ? withOrder(buildTaskGraph({ action, slots }, { contacts })) : null;
    if (task) {
      const first = nextRunnable(task);
      if (first) task = { ...task, nodes: task.nodes.map(n => n.id === first.id ? { ...n, status: 'running' } : n) };
    }
    history.patch({
      a2ui: applyMessages(a2ui, envelopes),
      turns: [...turns, { id: uid(), role: 'user', text }, { id: turnId, role: 'assistant', surfaceId, pending: true, task }],
    });
    record('业务层 · 对话入口', text, envelopes, action, slots, surfaceId);
    setPreviewId(null);
    settle(turnId);
  }, [a2ui, turns, ctxFor, history, resumeFollow, record, startTransfer, screen, setPreviewId, settle]);

  const runAction = useCallback(actionId => {
    const surfaceId = uid();
    const envelopes = fromAction(actionId, ctxFor(surfaceId));
    resumeFollow();
    const turnId = uid();
    history.patch({
      a2ui: applyMessages(a2ui, envelopes),
      turns: [...turns, { id: turnId, role: 'assistant', surfaceId, pending: true }],
    });
    record('产品层 · 在助手内直接开功能', null, envelopes, actionId, {}, surfaceId);
    setPreviewId(null);
    settle(turnId);
  }, [a2ui, turns, ctxFor, history, resumeFollow, record, setPreviewId, settle]);

  /** 提交输入框。IME 合成期间不提交（三级防护在 Composer 里）。 */
  const submit = useCallback((draft, busyRef) => e => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busyRef.current) return;
    history.patch({ draft: '' });
    runText(text);
  }, [history, runText]);

  return { runText, runAction, submit, taskControl };
}
