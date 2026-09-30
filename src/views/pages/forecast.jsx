import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, LineChart, Minus, Plus, TriangleAlert } from 'lucide-react';
import { Page, Panel, Empty, Failed } from '../parts.jsx';
import { forecastModel, DEFAULT_ASSUMPTIONS } from '../../services/forecast.js';
import ForecastChart from './forecastChart.jsx';
import ForecastCalendar from './forecastCalendar.jsx';
import './forecast.css';

/**
 * 现金流 —— 未来 30 天。
 *
 * 这一页回答的是别处回答不了的问题：**「这笔钱现在花掉，会影响哪一天」**。
 * 账单分析解释过去，这一页预测未来（PRD §3.2 的定位）。
 *
 * 三段，一屏读完：
 *   假设条  —— 收入口径 / 发薪日 / 日常预算 / 缓冲，四项都能改，改完立刻重算
 *   余额曲线 —— 基准与试算两条线同时在场，零线以下铺危险底色
 *   账单日历 —— 哪一天有什么扣费，点开看来源（协议原文或支持它的那几笔流水）
 *   操作试算 —— 输入一个金额，看在**不产生任何交易**的前提下会发生什么
 *
 * 文案纪律：标题与标签一共六十来个字，其余全是数字与日期（D-01 / D-03）。
 * 三态走 components/StateBlock.jsx：没有底料时空，算不出来时错。
 * 加载态不摆样子 —— 这一页的数据是同步算出来的，转圈只会是假的。
 */
const QUICK = [1000000, 4000000, 4500000];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** 「这笔花掉」的输入：只在能解析成金额时才更新。中文输入法组字期间不解析。 */
const parseAmount = text => {
  const n = Math.round(Number(String(text).replace(/[,¥\s]/g, '')) * 100);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

function Step({ label, value, step, min, max, format, onChange }) {
  return <div className="fc-step">
    <span className="fc-step-label">{label}</span>
    <span className="fc-step-body">
      <button type="button" aria-label={'减小' + label} disabled={value <= min}
        onClick={() => onChange(clamp(value - step, min, max))}><Minus size={13}/></button>
      <b>{format(value)}</b>
      <button type="button" aria-label={'增大' + label} disabled={value >= max}
        onClick={() => onChange(clamp(value + step, min, max))}><Plus size={13}/></button>
    </span>
  </div>;
}

/** 成因明细。每一行都带来源：协议原文，或者支持这个推断的那几笔流水。 */
const Reasons = ({ items }) => <ul className="row-list fc-reasons">
  {items.map((g, i) => <li className="row-item" key={g.key + i}>
    <span className={'fc-dot-kind fc-dot-kind--' + (g.estimated ? 'est' : 'ok')} aria-hidden="true"/>
    <span className="row-main">
      <strong>{g.name}{g.count > 1 ? ' × ' + g.count : ''}</strong>
      <small>{g.sourceText}</small>
    </span>
    <b className="amount">{g.amountText}</b>
  </li>)}
</ul>;

export default function Forecast({ ctx }) {
  const { bank, setRoute, yuan } = ctx;
  const [includeIncome, setIncome] = useState(true);
  const [salaryDay, setSalaryDay] = useState(null);
  const [budgetPerDay, setBudget] = useState(null);
  const [buffer, setBuffer] = useState(DEFAULT_ASSUMPTIONS.buffer);
  const [text, setText] = useState('');
  const [day, setDay] = useState(null);

  const plan = useMemo(() => ({ includeIncome, salaryDay, budgetPerDay, buffer }),
    [includeIncome, salaryDay, budgetPerDay, buffer]);
  const [base, error] = useMemo(() => {
    try { return [forecastModel(bank, plan), null]; } catch (e) { return [null, e]; }
  }, [bank, plan]);

  const amount = parseAmount(text);
  const trial = useMemo(() => {
    if (!(amount > 0) || !base) return null;
    try { return forecastModel(bank, { ...plan, spend: { amount, name: '这笔花掉' } }); } catch { return null; }
  }, [bank, plan, amount, base]);

  if (error) return <Page title="现金流"><Panel><Failed code="forecast"/></Panel></Page>;
  if (!base.basis.has) {
    return <Page title="现金流"><Panel>
      <Empty icon={LineChart} title="暂无预测" action="看账单" onAction={() => setRoute('bills')}/>
    </Panel></Page>;
  }

  /* 试算不是另开一个页面，而是叠加一层：曲线留一条基准线做对照，
     日历、低点、缺口全部跟着当前口径走 —— 一屏里只允许存在一个「现在」。 */
  const view = trial || base;

  return <Page title="现金流">
    <div className="fc-assume">
      {base.income && <div className="fc-seg" role="group" aria-label="收入口径">
        <button type="button" aria-pressed={includeIncome} onClick={() => setIncome(true)}>含预计收入</button>
        <button type="button" aria-pressed={!includeIncome} onClick={() => setIncome(false)}>不计收入</button>
      </div>}
      {base.income && <Step label="发薪日" value={view.salaryDay} step={1} min={1} max={28}
        format={n => n + ' 日'} onChange={setSalaryDay}/>}
      <Step label="日常预算" value={view.budget.day} step={5000} min={0} max={500000}
        format={yuan} onChange={setBudget}/>
      <Step label="缓冲" value={buffer} step={50000} min={0} max={2000000}
        format={yuan} onChange={setBuffer}/>
    </div>

    <Panel title="余额曲线"
      aside={<span className="fc-low">低点 <b className="amount">{view.low.balanceText}</b><small>{view.low.label}</small></span>}>
      <ForecastChart base={base} trial={trial} day={day} onDay={setDay}/>
      {view.belowBuffer && <p className="fc-below">
        <TriangleAlert size={13} aria-hidden="true"/>{view.belowBuffer.count} 天低于缓冲
      </p>}
    </Panel>

    <Panel title="账单日历" aside={<small className="fc-range">{base.series[0].label} – {base.end.slice(5).replace('-', '/')}</small>}>
      <ForecastCalendar days={view.calendar} day={day} onDay={setDay}/>
    </Panel>

    <Panel title="操作试算">
      <div className="fc-trial">
        <label className="fc-amount">
          <span>这笔花掉</span>
          <input inputMode="decimal" value={text} placeholder="0.00" aria-label="试算金额"
            onChange={e => setText(e.target.value)}/>
        </label>
        <div className="fc-quick">
          {QUICK.map(c => <button key={c} type="button" aria-pressed={amount === c}
            onClick={() => setText(String(c / 100))}>{yuan(c)}</button>)}
          {text && <button type="button" className="link-btn" onClick={() => setText('')}>清除</button>}
        </div>
      </div>

      {trial && <div className="fc-result">
        <div className="fc-compare">
          <span className="fc-side"><span>低点</span><b className="amount">{base.low.balanceText}</b><small>{base.low.label}</small></span>
          <ArrowRight size={15} aria-hidden="true"/>
          <span className="fc-side fc-side--after">
            <span>低点</span><b className={'amount' + (trial.low.balance < 0 ? ' fc-out' : '')}>{trial.low.balanceText}</b><small>{trial.low.label}</small>
          </span>
        </div>

        {trial.gap.amount > 0 && <div className="fc-gap">
          <div className="fc-gap-head">
            <strong>缺口</strong>
            <b className="amount fc-out">{trial.gap.amountText}</b>
            <small>{trial.gap.dateLabel}{trial.short ? ' · ' + trial.short.label + ' 起不够' : ''}</small>
          </div>
          <Reasons items={trial.gap.items}/>
          <p className="fc-gap-foot">
            合计 <b className="amount">{trial.gap.totalText}</b>
            <i>其中预计 <b className="amount">{trial.gap.estimatedText}</b></i>
          </p>
        </div>}
      </div>}
    </Panel>
  </Page>;
}
