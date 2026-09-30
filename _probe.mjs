
import { project } from './src/domain/forecast.js';
import { seed, money } from './src/domain/bank.js';
const bank = seed();
const PLAN = { asOf: '2026-09-25', horizon: 30, buffer: 100000 };
const p = project(bank, { ...PLAN, spend: { amount: 4500000, name: '这笔花掉' } });
console.log('low', p.low.date, p.low.balance, 'index', p.low.index);
console.log(p.series.map(d=>d.date+' '+money(d.balance)+' ['+d.items.map(i=>i.name).join(',')+']').join('\n'));
