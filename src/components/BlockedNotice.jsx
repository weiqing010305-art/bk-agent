import React from 'react';
import { ShieldX } from 'lucide-react';

/**
 * 被拦下的请求。
 *
 * 之前这里渲染的是**永久骨架屏** —— 因为被拦的回合没有 surfaceId，
 * 而渲染分支把"没有 surface"和"正在生成"当成了同一件事。
 * 结果：注入防御生效了、审计留痕了，但用户只看到一个转不完的圈。
 *
 * 拦截必须解释清楚三件事：拦了什么、为什么拦、依据是什么 —— 不解释的拦截会被当成 bug。
 * 但也只解释这三件事：那三句原文（reason）已经把"为什么"说全了，再补一段就是重复。
 * 留下的最后一行是**事实**（已记审计），不是解释。
 */
export default function BlockedNotice({ blocked, onDismiss }) {
  const kind = blocked.kind === 'induce' ? '诱导编造' : '越权指令';
  return <section className="blocked-notice" role="alert">
    <span className="bn-icon" aria-hidden="true"><ShieldX size={20}/></span>
    <div className="bn-body">
      <h3>这句话我没有执行</h3>
      <p>{blocked.reason}</p>
      <dl className="bn-facts">
        <div><dt>判定</dt><dd>{kind}</dd></div>
        <div><dt>命中</dt><dd>{blocked.matched}</dd></div>
        <div><dt>依据</dt><dd>注入防御</dd></div>
      </dl>
      <p className="bn-note">已写入审计日志</p>
      {onDismiss && <button className="a2ui-btn a2ui-btn--secondary" onClick={onDismiss}>我知道了</button>}
    </div>
  </section>;
}
