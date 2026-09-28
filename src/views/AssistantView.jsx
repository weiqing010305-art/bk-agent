import React from 'react';
import { resolveTree } from '../a2ui/apply.js';
import SurfaceView from '../a2ui/render.jsx';
import Composer from '../components/Composer.jsx';
import FlowLauncher from '../components/FlowLauncher.jsx';
import TaskGraph from '../components/TaskGraph.jsx';
import BlockedNotice from '../components/BlockedNotice.jsx';

/**
 * 业务层：对话入口。
 *
 * **布局模型（这轮最重要的改动）**
 * 之前是一条会不断变长的聊天流 —— 每办一件事就多一张卡，看到第三张就得往上滑。
 * 那违背了最小操作原则：信息应该是"被送到面前"，而不是"用户去翻"。
 *
 * 现在改成两区：
 *   工作区  —— 当前这一件事的统合视图，占满主要面积，一屏看全
 *   历史条  —— 以往的问句折成一行 chips，点一下就换回当时那张视图
 *
 * 换句话说：**不滚动的历史，可切换的现在**。
 */
export default function AssistantView({ ctx }) {
  const { turns, a2ui, handleAction, busy, previewId, setPreviewId, taskControl } = ctx;

  const assistantTurns = turns.filter(t => t.role === 'assistant');
  const latest = assistantTurns[assistantTurns.length - 1] || null;
  const shown = (previewId && assistantTurns.find(t => t.id === previewId)) || latest;

  /* 历史条标签：优先用「用户当时问了什么」；没问过就用这张视图的标题 */
  const labelOf = turn => {
    const i = turns.findIndex(t => t.id === turn.id);
    const ask = [...turns.slice(0, i)].reverse().find(t => t.role === 'user');
    if (ask) return ask.text;
    const s = a2ui.surfaces[turn.surfaceId];
    const root = s && s.components && s.components.root;
    const titleId = root && root.children && root.children.find(id => (s.components[id] || {}).variant === 'headline');
    const t = titleId && s.components[titleId] && s.components[titleId].text;
    return typeof t === 'string' ? t : '概览';
  };

  const surface = shown && a2ui.surfaces[shown.surfaceId];
  const isStale = Boolean(previewId && shown && latest && shown.id !== latest.id);

  return <>
    <header className="view-head">
      <div>
        <h1>青禾助手</h1>
        <p>说一句话，我把相关的业务一次整理给你。左边还能直接进各个功能页。</p>
      </div>
      {isStale && (
        <button className="a2ui-btn a2ui-btn--secondary" onClick={() => setPreviewId(null)}>回到最新</button>
      )}
    </header>

    {/* 工作区：当前这件事的统合视图，一屏看全 */}
    <div className="workspace-view" role="log" aria-live="polite" aria-label="当前视图">
      <div className="workspace-inner">
        {/* 任务是用户自己的编排，不是"动线面板" —— 动线是无感的，编排是要看得见的 */}
        {shown && shown.task && <TaskGraph
          graph={shown.task}
          onInterrupt={() => taskControl(shown.id, 'interrupt')}
          onResume={() => taskControl(shown.id, 'resume')}
          onRollback={() => taskControl(shown.id, 'rollback')}
          onHandoff={() => taskControl(shown.id, 'handoff')}
        />}
        {/* 三条分支要分清：「被拦下」有话说，「正在生成」是骨架，「有 surface」才渲染。
            曾经把前两者混在一起，导致拦截后是一个转不完的圈。 */}
        {shown && shown.blocked
          ? <BlockedNotice blocked={shown.blocked} onDismiss={() => setPreviewId(null)}/>
          : shown && shown.pending
            ? <SurfaceSkeleton/>
            : surface
              ? <SurfaceView key={(surface.dataModel.step || '') + shown.id}
                             surface={surface}
                             tree={resolveTree(surface)}
                             onAction={e => handleAction(shown.surfaceId, e)}/>
              : <p className="a2ui-text a2ui-text--caption">这个视图不可用，换一句试试。</p>}
      </div>
    </div>

    {/* 历史条：不滚动，点一下换回去 */}
    {assistantTurns.length > 1 && (
      <div className="turn-strip" aria-label="历史">
        <div className="turn-strip-inner">
          {assistantTurns.map(t => (
            <button key={t.id}
                    className={'turn-chip' + (shown && shown.id === t.id ? ' on' : '')}
                    aria-pressed={shown && shown.id === t.id}
                    disabled={busy}
                    onClick={() => setPreviewId(t.id === (latest && latest.id) ? null : t.id)}>
              {labelOf(t).slice(0, 18)}
            </button>
          ))}
        </div>
      </div>
    )}

    <FlowLauncher ctx={ctx}/>
    <Composer ctx={ctx}/>
  </>;
}

/**
 * 生成中的骨架。既是加载态（craft-floor 要求的四态之一），
 * 也让对话有节奏 —— 卡片是被想出来的，不是瞬间贴上来的。
 */
function SurfaceSkeleton() {
  return <div className="surface-skeleton" aria-label="正在生成">
    <span className="sk sk--head"/>
    <span className="sk sk--line"/>
    <span className="sk sk--line sk--short"/>
    <span className="sk sk--line sk--short"/>
  </div>;
}
