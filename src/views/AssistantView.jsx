import React from 'react';
import { resolveTree } from '../a2ui/apply.js';
import SurfaceView from '../a2ui/render.jsx';
import Composer from '../components/Composer.jsx';
import ConversationControls from '../components/ConversationControls.jsx';
import FlowLauncher from '../components/FlowLauncher.jsx';
import TaskGraph from '../components/TaskGraph.jsx';
import BlockedNotice from '../components/BlockedNotice.jsx';
import { Loading, Failed } from '../components/StateBlock.jsx';
import AgentThinking from '../components/AgentThinking.jsx';

/** 按会话顺序呈现消息；业务 surface 留在触发它的助手回复里。 */
export default function AssistantView({ ctx }) {
  const { turns, a2ui, handleAction, taskControl, scrollRef } = ctx;
  return <div className="assistant-layout">
    <main className="assistant-main" aria-label="青禾助手对话">
    <ConversationControls ctx={ctx}/>
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
                {/* 四态分清楚：被拦有话说 / 生成中是骨架 / 有 surface 才渲染 / 其余是错误。
                    错误态按 ZA 口径：拟人化标题 + 独立错误码 + 一个动作，不解释技术原因。 */}
                {turn.blocked
                  ? <BlockedNotice blocked={turn.blocked}/>
                  : turn.pending && !turn.streaming
                    ? turn.kind === 'agent' ? <AgentThinking/> : <Loading/>
                    : turn.kind === 'agent'
                      ? <div className="agent-answer" aria-busy={!!turn.pending}>
                        <p className={'chat-bubble chat-bubble--assistant' + (turn.streaming ? ' agent-streaming' : '')}>{turn.text}</p>
                        {!turn.pending && turn.agentTask?.choices?.length > 0 && <div className="agent-choices">
                          {turn.agentTask.choices.map(choice => <button className="ghost-btn" key={choice.id}
                            disabled={ctx.agent.busy} onClick={() => ctx.agent.choose(turn.agentTask, choice.id, turn.id)}>
                            {choice.name} · 尾号 {choice.tail}
                          </button>)}
                        </div>}
                        {!turn.pending && turn.agentTask?.can_open && <button className="link-btn" onClick={() => ctx.agent.open(turn.agentTask.id)}>
                          {turn.agentTask.kind === 'phone' ? '查看这笔充值' : '查看这笔转账'}</button>}
                        {turn.retry && <button className="ghost-btn" disabled={ctx.agent.busy} onClick={() => ctx.agent.retry(turn.id)}>重试</button>}
                      </div>
                    : surface
                      ? <SurfaceView surface={surface} tree={resolveTree(surface)} showProvenance={false}
                                     onAction={e => handleAction(turn.surfaceId, e)}/>
                      : <Failed code={turn.surfaceId || 'surface'} onRetry={() => handleAction(turn.surfaceId, { name: 'noop' })}/>}
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
