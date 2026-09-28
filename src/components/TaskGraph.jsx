import React from 'react';
import { Hand, Pause, Play, RotateCcw, Check, CircleDot, AlertCircle, User } from 'lucide-react';

/**
 * 子任务 DAG 的呈现（赛题高优先级项「意图理解与任务规划」）。
 *
 * 赛题原文：「复杂任务需拆解为有序的子任务 DAG；执行过程中支持中断、回退和人工接管」
 *
 * 呈现的是**依赖关系**，不是编号列表 —— 缩进表示依赖层级，
 * 这样"为什么回退会重置后面全部"一眼可见。
 * 注意：这是**任务编排**的呈现，不是"动线面板"。动线是无感的，这里展示的是用户自己的任务。
 */

const ICON = { done: Check, running: CircleDot, blocked: AlertCircle, human: User, pending: Play, skipped: Play };
const LABEL = { done: '已完成', running: '进行中', blocked: '待你补充', human: '等你决定', pending: '待执行', skipped: '已跳过' };

/** 依赖深度 → 缩进层级。靠图算，不写死。 */
const depthOf = (g, id, seen = new Set()) => {
  if (seen.has(id)) return 0;
  seen.add(id);
  const n = g.nodes.find(x => x.id === id);
  if (!n || !n.dependsOn || !n.dependsOn.length) return 0;
  return 1 + Math.max(...n.dependsOn.map(d => depthOf(g, d, seen)));
};

export default function TaskGraph({ graph, onInterrupt, onResume, onRollback, onHandoff }) {
  if (!graph) return null;
  const order = graph.order || graph.nodes.map(n => n.id);
  const done = graph.nodes.filter(n => n.status === 'done').length;
  const pct = Math.round(done / graph.nodes.length * 100);
  const stopped = graph.interrupted || Boolean(graph.handoff);

  return <section className={'task-graph' + (stopped ? ' is-stopped' : '')} aria-label="任务编排">
    <header className="tg-head">
      <div>
        <span className="tg-kicker">{stopped ? '已暂停' : '正在按这个顺序办'}</span>
        <h3>{graph.title}</h3>
      </div>
      <span className="tg-count">{done} / {graph.nodes.length}</span>
    </header>

    <div className="tg-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: pct + '%' }}/>
    </div>

    <ol className="tg-nodes">
      {order.map(id => {
        const n = graph.nodes.find(x => x.id === id);
        if (!n) return null;
        const Icon = ICON[n.status] || Play;
        const depth = Math.min(depthOf(graph, id), 2);
        return <li key={id} className={'tg-node tg-node--' + n.status} style={{ marginLeft: depth * 18 }}>
          <span className="tg-dot"><Icon size={13}/></span>
          <span className="tg-body">
            <b>{n.label}</b>
            {n.note && <small>{n.note}</small>}
          </span>
          <span className="tg-state">{LABEL[n.status]}</span>
        </li>;
      })}
    </ol>

    {graph.handoff && <p className="tg-handoff" role="status">
      已交给你处理：{graph.handoff.reason}（{graph.handoff.at}）
    </p>}

    <div className="tg-actions">
      {stopped
        ? <button className="a2ui-btn a2ui-btn--primary" onClick={onResume}><Play size={14}/> 继续</button>
        : <button className="a2ui-btn a2ui-btn--secondary" onClick={onInterrupt}><Pause size={14}/> 先停一下</button>}
      <button className="a2ui-btn a2ui-btn--secondary" onClick={onRollback}><RotateCcw size={14}/> 退回上一步</button>
      <button className="a2ui-btn a2ui-btn--secondary" onClick={onHandoff}><Hand size={14}/> 我自己来</button>
    </div>
  </section>;
}
