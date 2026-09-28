import React from 'react';
import { resolveTree } from '../a2ui/apply.js';
import SurfaceView from '../a2ui/render.jsx';
import Composer from '../components/Composer.jsx';
import FlowLauncher from '../components/FlowLauncher.jsx';
import TaskGraph from '../components/TaskGraph.jsx';
import BlockedNotice from '../components/BlockedNotice.jsx';
import { Loading, Failed } from '../components/StateBlock.jsx';

/**
 * 业务层：对话入口。
 *
 * **布局模型**：工作区（当前这件事的统合视图，一屏看全）+ 历史条（不滚动的过去）。
 * 不是一条会不断变长的聊天流 —— 那违背最小操作原则：信息要"被送到面前"，
 * 而不是"用户自己往上翻"。**不滚动的历史，可切换的现在。**
 *
 * **这个文件同时是文案的最后一道闸**：什么该上屏幕由视图层决定。
 * 上游（brief.js / planner.js / services）产出的"用文字解释界面"的句子在这里被拦下 ——
 * 界面本身已经在做那件事了，再说一遍就是认知负荷。
 */

/** 不渲染的引导语，只列纯引导。
 *  带数字的一句都不删（那是事实）；安全提示（"不会扣款""需验证后记账"）一句都不删（那是责任）。
 *  ponytail: 精确匹配，上游改文案这里就失效 —— 上限在此；治本是协议层给 Text 加 kind:'hint'。 */
const HINTS = new Set([
  '这是你现在的全部状况，不需要再点进任何页面',
  '先选一种方式，我带你走完剩下的步骤。',
  '每月固定支出，取消前先看看它占多少',
  '我可以帮你处理这四类演示业务。选一个继续吧：',
]);

/** 屏幕上不出现产品自述词。只抠词，不删事实 —— 括号里只剩自述的，连括号一起走。 */
const SELF_REF = /演示|模拟|预设规则|占位|尚未接入/;
const strip = s => typeof s !== 'string' ? s
  : s.replace(/[（(](?:演示|模拟|测试)[^）)]*[）)]/g, '')
     .replace(/演示|模拟|预设规则|占位|尚未接入/g, '')
     .replace(/\s{2,}/g, ' ')
     .trim();

/** 账本出处：第一句必然是自述（「本机演示账本，数据截至 …」）。
 *  整句丢掉比抠词可读 —— 抠完剩「本机账本，数据截至 …」反而更怪。 */
const source = s => typeof s !== 'string' ? s
  : s.split('，').filter(p => p.trim() && !SELF_REF.test(p)).join('，') || strip(s);

/** 渲染前裁剪：引导语不给节点，自述词不给上屏。
 *  除了 HINTS，还有一条结构性规则：**以冒号收尾的正文是"下面这些"的引子**——
 *  引子由界面自己说，不用文字说（「选一件事，我带你走完：」下面就是那排业务卡片）。
 *  规则比字面量耐改：上游换一句话，这里不用跟着改。 */
function trim(node) {
  if (!node) return null;
  if (node.type === 'Text') {
    if (HINTS.has(node.text)) return null;
    if (node.variant === 'body' && /[：:]$/.test(String(node.text))) return null;
    const t = strip(node.text);
    return t ? (t === node.text ? node : { ...node, text: t }) : null;
  }
  if (node.children) return { ...node, children: node.children.map(trim).filter(Boolean) };
  if (node.child) return { ...node, child: trim(node.child) };
  return node;
}

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
    /* 在整张 surface 里找第一个 headline。以前只查 root 的直接子节点，
       而首页的标题裹在 Row 里，查不到就退回「概览」—— 于是历史条上写着「概览」，
       用户不知道那一条是什么。 */
    const s = a2ui.surfaces[turn.surfaceId];
    const comps = (s && s.components) || {};
    const first = (s && s.components && s.components.root && s.components.root.children || [])
      .map(id => comps[id]).find(c => c && c.variant === 'headline');
    const t = first && first.text;
    return typeof t === 'string' ? t : '开始';
  };

  const raw = shown && a2ui.surfaces[shown.surfaceId];
  const isStale = Boolean(previewId && shown && latest && shown.id !== latest.id);
  /* 出处标签就地改掉会污染会话里那份 surface —— 复制一层，只改渲染用的副本 */
  const prov = raw && raw.meta && raw.meta.provenance;
  const surface = prov ? { ...raw, meta: { ...raw.meta, provenance: { ...prov, label: source(prov.label) } } } : raw;
  const tree = surface ? trim(resolveTree(surface)) : null;

  return <>
    {/* 页面标题就是这一页的全部说明。要不要点进功能页，左侧导航的位置已经说完了 */}
    <header className="view-head">
      <h1>青禾助手</h1>
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
        {/* 三条分支要分清：「被拦下」有话说，「正在生成」是骨架，「有树」才渲染。
            曾经把前两者混在一起，导致拦截后是一个转不完的圈。
            判据用 tree 而不是 surface：root 缺失时也走「打不开」，不留空白屏。 */}
        {shown && shown.blocked
          ? <BlockedNotice blocked={shown.blocked} onDismiss={() => setPreviewId(null)}/>
          : shown && shown.pending
            ? <Loading/>
            : tree
              ? <SurfaceView key={(surface.dataModel.step || '') + shown.id}
                             surface={surface}
                             tree={tree}
                             onAction={e => handleAction(shown.surfaceId, e)}/>
              /* 错误态：拟人化标题 + 真实定位码 + 一个动作，不解释技术原因 */
              : <Failed code={shown ? shown.surfaceId : 'no-surface'}/>}
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

/* 加载态原来是本地的一个 SurfaceSkeleton，已并进 components/StateBlock.jsx 的 Loading ——
   三态只能有一份实现，否则"零文字"这条口径会在下一次改动里各写各的。
   骨架本身仍然一个字都不说：形态说明"正在生成"，也让卡片有被想出来的节奏。 */
