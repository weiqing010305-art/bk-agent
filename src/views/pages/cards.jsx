import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Gauge, ListFilter, ShieldAlert, Snowflake, Sun } from 'lucide-react';
import { Page, Panel } from '../parts.jsx';
import { EyeIcon } from '../shared.jsx';
import { buildCards, enrich, isHydrated } from './cardData.jsx';
import { cycle, fmtDate, summary } from './cardUtils.jsx';
import { CardActivity, ChannelBoard, LimitMeter, LimitRows, StatusHistory } from './cardProfile.jsx';
import { CardFace } from './cardFace.jsx';
import { CardFreezeSheet, FreezeNotice } from './cardFreeze.jsx';

/**
 * 卡片与卡包。
 *
 * 先想清楚「打开这一页想确认什么」，再决定放什么：
 *   ① 现在该刷哪张卡   → 卡包横向排列，选中的浮起并抬起视线
 *   ② 哪张卡不能用了   → 冻结卡在卡包里就是另一套材料（暗面 + 磨砂 + 徽标 + 下沉）
 *   ③ 还能花多少、什么时候还 → 额度尺（针 / 块 / 刻度）+ 账期与还款日
 *   ④ 最近的账对不对   → 这张卡自己的明细 + 本期小结
 * 「设置页式的表单堆砌」被刻意排除：所有可调项都在档案行内联展开。
 *
 * 状态落点：**账本**。domain 的 seed() 只发两张卡，本页首次进入时把第三张卡与每张卡的
 * 完整档案补进 bank.cards（见 cardData.jsx 的 enrich）；之后冻结、渠道开关、限额调整
 * 全部走 ctx.setBank 一次回写 —— 概览页读的是同一份账本，卡片状态因此会同步。
 */
export default function Cards({ ctx }) {
  const { bank, setBank, setToast } = ctx;
  const [selected, setSelected] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState(null);      // null | { action, phase }

  /* 一次性把演示档案补齐到账本：只补缺的卡位与缺的字段，已经写进去的状态原样保留。
     「重置演示数据」会 seed() 出一份没有档案的账本，再进本页会自动重新补齐。 */
  useEffect(() => {
    if (bank.cards.length !== 3 || !bank.cards.every(isHydrated)) {
      setBank(prev => ({ ...prev, cards: enrich(prev.cards) }));
    }
  }, [bank.cards, setBank]);

  const cards = useMemo(() => buildCards(bank.cards), [bank.cards]);
  if (!cards.length) {
    return <Page title="卡片与卡包" subtitle="正在准备卡片档案">
      <p className="meta-note">演示账本正在补齐卡片档案。</p>
    </Page>;
  }
  const i = Math.min(selected, cards.length - 1);
  const card = cards[i];
  const frozen = card.status === 'frozen';
  const info = cycle(card.profile);
  const stat = summary(card, info);
  const over = card.channels.reduce((s, c) => s + (c.on ? c.dayUsed : 0), 0) >= card.channels.reduce((s, c) => s + (c.on ? c.dayLimit : 0), 0);

  /* 三个写入口，全部落到账本里的那一张卡上 */
  const update = fn => setBank(prev => ({ ...prev, cards: prev.cards.map(c => c.id === card.id ? fn(c) : c) }));
  const toggleChannel = cid => update(c => ({
    ...c, channels: c.channels.map(x => x.id === cid ? { ...x, on: !x.on } : x),
  }));
  const setLimit = (key, value) => {
    const at = ['noPwd', 'perTxn', 'dayLimit'].indexOf(key);
    update(c => ({ ...c, limits: c.limits.map((v, k) => (k === at ? value : v)) }));
    setToast('限额已更新，立即生效');
  };
  const commit = action => {
    const freeze = action === 'freeze';
    update(c => ({
      ...c,
      status: freeze ? 'frozen' : 'active',
      history: [...c.history, {
        date: '2026-09-26', title: freeze ? '临时冻结' : '解除冻结',
        note: freeze ? '由持卡人在手机银行发起，四个渠道同时停用' : '持卡人自助解冻，渠道恢复至冻结前的开关状态',
      }],
    }));
    setToast(freeze ? '已冻结，四个渠道即时停用' : '已解冻，渠道恢复可用');
    setSheet({ action, phase: 'done' });
  };

  /* 顶部的状态提醒只在「真的有事」时出现 */
  const alert = frozen ? 'frozen' : over ? 'capped' : null;

  return <Page title="卡片与卡包"
    subtitle={cards.length + ' 张卡 · ' + (frozen ? card.name.replace('青禾', '') + '已冻结' : '点击卡面切换')}
    aside={<button className="chip" aria-pressed={hidden} onClick={() => setHidden(v => !v)}>
      <EyeIcon off={hidden}/>{hidden ? '显示卡号与金额' : '隐藏卡号与金额'}</button>}>

    <div className="wallet" role="tablist" aria-label="卡包">
      {cards.map((c, k) => <CardFace key={c.id} card={c} hidden={hidden} selected={k === i}
        frozen={c.status === 'frozen'} tabIndex={k === i ? 0 : -1} onSelect={() => setSelected(k)}/>)}
    </div>
    <p className="wallet-hint">选中的卡会浮起。横向排列按开卡顺序，磨砂暗面的那张就是当前不可用的卡。</p>

    {alert && <FreezeNotice card={card} isFrozen={frozen}
      onOpen={() => setSheet({ action: frozen ? 'unfreeze' : 'freeze', phase: 'confirm' })}/>}

    <div key={card.id} className="card-detail" role="tabpanel" aria-label={card.name + ' 档案'}>
      <Panel title={card.name}
        aside={<span className="panel-hint">尾号 {card.tail} · 开卡 {fmtDate(card.since)}</span>}>
        <LimitMeter card={card}/>
        <div className="card-meta">
          <div><span>卡片类型</span><b>{card.profile.kind}</b></div>
          <div><span>当前状态</span><b className={frozen ? 'frozen' : 'ok'}>{frozen ? '已冻结' : '正常使用'}</b></div>
          <div><span>关联账户</span><b>{card.profile.linked}</b></div>
          <div><span>账单日</span><b>每月 {card.profile.billDay} 日 · 下次 {info.nextShort}</b></div>
          {info.due && <div><span>还款日</span><b>{info.dueShort} · {card.profile.autoPay ? '自动还款已开启' : '需手动还款'}</b></div>}
          <div><span>上期账单</span><b>¥{(card.profile.lastBill / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</b></div>
        </div>
        {info.due
          ? <p className="meta-note">本账期还有 {info.daysLeft} 天，{info.dueShort}还款。已用额度会在还款后回补。</p>
          : <p className="meta-note">借记卡直接扣账，不产生账单与还款；本账期还有 {info.daysLeft} 天出账。</p>}
      </Panel>

      <ChannelBoard card={card} frozen={frozen} onToggle={toggleChannel}/>

      <div id="card-limits" className="card-limits">
        <LimitRows card={card} onLimit={setLimit} say={setToast}/>
      </div>

      <div className="card-actions">
        <button className={'freeze-btn' + (frozen ? ' is-thaw' : '')}
                onClick={() => setSheet({ action: frozen ? 'unfreeze' : 'freeze', phase: 'confirm' })}>
          {frozen ? <Sun size={19}/> : <Snowflake size={19}/>}
          <b>{frozen ? '解除冻结' : '临时冻结这张卡'}</b>
          <small>{frozen ? '恢复四个渠道的支付能力' : '立即止付，可随时解冻'}</small>
        </button>
        <div className="action-grid">
          <button className="action-cell" onClick={() => document.getElementById('card-limits').scrollIntoView({ block: 'center', behavior: 'smooth' })}>
            <Gauge size={19}/><b>调整限额</b><small>免密 / 单笔 / 日累计</small>
          </button>
          <button className="action-cell" onClick={() => setToast('演示环境不开放挂失补卡，正式环境将立即止付并邮寄新卡')}>
            <ShieldAlert size={19}/><b>挂失补卡</b><small>立即止付并换卡</small>
          </button>
          <button className="action-cell" onClick={() => ctx.setRoute('bills')}>
            <ListFilter size={19}/><b>全部流水</b><small>按分类看</small>
          </button>
        </div>
      </div>

      <CardActivity card={card} cycleInfo={info} stat={stat} hidden={hidden}/>

      <Panel title="状态历史" aside={<span className="panel-hint">开卡至今 {card.history.length} 条</span>}>
        <StatusHistory history={card.history}/>
        <p className="meta-note"><Ban size={12}/>冻结与解冻都会留痕，客服与风控看到的是同一条时间线。</p>
      </Panel>
    </div>

    {sheet && <CardFreezeSheet card={card} action={sheet.action} phase={sheet.phase}
      onConfirm={() => commit(sheet.action)} onClose={() => setSheet(null)} onSwitch={() => setSelected(i)}/>}
  </Page>;
}
