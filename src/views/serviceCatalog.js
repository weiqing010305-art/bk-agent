import { ArrowLeftRight, Banknote, BarChart3, CalendarClock, CreditCard, Lightbulb, LineChart, PiggyBank, Plane, Repeat, Smartphone, TrainFront } from 'lucide-react';

export const SERVICE_TILES = [
  { label: '转账', icon: ArrowLeftRight, tone: 'accent', route: 'transfer' },
  { label: '手机充值', icon: Smartphone, tone: 'subscribe', route: 'phone' },
  { label: '生活缴费', icon: Lightbulb, tone: 'accent', route: 'utility' },
  { label: '交通卡', icon: TrainFront, tone: 'positive', route: 'traffic' },
  { label: '外币兑换', icon: Banknote, tone: 'subscribe', route: 'exchange' },
  { label: '信用卡还款', icon: CreditCard, tone: 'accent', route: 'credit' },
  { label: '网点预约', icon: CalendarClock, tone: 'accent', route: 'appointment' },
  { label: '账单', icon: BarChart3, tone: 'accent', square: true, route: 'bills' },
  { label: '订阅', icon: Repeat, tone: 'subscribe', square: true, route: 'subscriptions' },
  { label: '卡片', icon: CreditCard, tone: 'warning', square: true, route: 'cards' },
  { label: '出行钱袋', icon: Plane, tone: 'accent', square: true, route: 'travel' },
  { label: '储蓄计划', icon: PiggyBank, tone: 'accent', square: true, route: 'savings' },
  { label: '理财', icon: LineChart, tone: 'positive', square: true, route: 'wealth' },
];
