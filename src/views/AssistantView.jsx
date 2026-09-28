import React from 'react';
import { resolveTree } from '../a2ui/apply.js';
import SurfaceView from '../a2ui/render.jsx';
import Composer from '../components/Composer.jsx';
import FlowLauncher from '../components/FlowLauncher.jsx';
import TaskGraph from '../components/TaskGraph.jsx';
import BlockedNotice from '../components/BlockedNotice.jsx';

/** 按会话顺序呈现消息；业务 surface 留在触发它的助手回复里。 */
export default function AssistantView({ ctx }) {
  const { turns, a2ui, handleAction, taskControl, scrollRef } = ctx;
  return <div className="assistant-layout">
    <main className="assistant-main" aria-label="青禾助手对话">
    <div className="assistant-thread" ref={scrollRef} role="log" aria-live="polite" aria-label="对话记录" tabIndex={0}>
      <div className="assistant-thread-inner">
        {turns.map((turn, index) => {
          if (turn.role === 'user') {
            return <div className="chat-turn chat-turn--user" key={turn.id}>
              <p className="chat-bubble chat-bubble--user">{turn.text}</p>
            </div>;
          }

          const welcome = turn.kind === 'welcome' || index === 0;
          const surface = turn.surfaceId && a2ui.surfaces[turn.surfaceId];
          return <div className="chat-turn chat-turn--assistant" key={turn.id}>
            <div className="chat-response">
              {welcome ? <>
                <div className="chat-bubble chat-bubble--assistant chat-bubble--welcome">
                  <strong>您好，我是青禾，您的银行 AI 助手。</strong>
                  <span>我可以帮您查询账单、转账汇款、管理卡片与订阅等，有什么可以为您做的？</span>
                </div>
                <FlowLauncher ctx={ctx}/>
              </> : <>
                {turn.task && <TaskGraph
                  graph={turn.task}
                  onInterrupt={() => taskControl(turn.id, 'interrupt')}
                  onResume={() => taskControl(turn.id, 'resume')}
                  onRollback={() => taskControl(turn.id, 'rollback')}
                  onHandoff={() => taskControl(turn.id, 'handoff')}
                />}
                {turn.blocked
                  ? <BlockedNotice blocked={turn.blocked}/>
                  : turn.pending
                    ? <SurfaceSkeleton/>
                    : surface
                      ? <SurfaceView surface={surface} tree={resolveTree(surface)} showProvenance={false}
                                     onAction={e => handleAction(turn.surfaceId, e)}/>
                      : <p className="chat-bubble chat-bubble--assistant">这个回复暂时无法显示，请换一种说法试试。</p>}
              </>}
            </div>
          </div>;
        })}
      </div>
    </div>

    <Composer ctx={ctx}/>
    </main>
  </div>;
}

function SurfaceSkeleton() {
  return <div className="surface-skeleton" aria-label="正在生成">
    <span className="sk sk--head"/>
    <span className="sk sk--line"/>
    <span className="sk sk--line sk--short"/>
  </div>;
}
