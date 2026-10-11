export const travelCurrencies = { JPY: '日元 JPY', USD: '美元 USD', EUR: '欧元 EUR', HKD: '港币 HKD' };
export function travelDate(days = 0) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const validDate = date => {
  const d = new Date(date + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
};
export function validateTrip(trip, cards) {
  if (!trip.destination.trim() || trip.destination.trim().length > 40) throw new Error('请输入 1–40 字的目的地。');
  if (!validDate(trip.start) || !validDate(trip.end) || trip.start <= travelDate() || trip.end < trip.start) throw new Error('请选择未来的出发日期，返程不能早于出发。');
  if (!cards.some(c => c.id === trip.cardId)) throw new Error('请选择一张出行银行卡。');
  if (!travelCurrencies[trip.currency] || !/^\d+$/.test(trip.cashAmount) || Number(trip.cashAmount) > 100000) throw new Error('请输入 0–100000 的预计外币现金金额（整数）。');
  return { ...trip, destination: trip.destination.trim() };
}
export function travelCardStatus(card) {
  if (!card) return { ready: false, message: '银行卡不存在，请重新选择。' };
  if (card.status !== 'active') return { ready: false, message: '这张卡已冻结，请前往卡包处理或改选其他银行卡。' };
  const channel = card.channels?.find(c => c.id === 'abroad');
  if (!channel) return { ready: false, message: '缺少境外支付档案，请前往卡包核对。' };
  if (channel.on === false) return { ready: false, message: '境外支付尚未开启，请前往卡包管理。' };
  if (channel.perTxn <= 0 || channel.dayLimit <= 0 || channel.dayUsed >= channel.dayLimit) return { ready: false, message: '境外支付额度不可用，请前往卡包核对限额。' };
  return { ready: true, message: '卡片可用，境外支付已开启。', limit: channel.perTxn, dayRemaining: channel.dayLimit - channel.dayUsed };
}
// 只识别明确的出行请求；不能确定的日期留给用户在草稿中核对。
export function travelFromText(text) {
  if (!/出行钱袋|(?:去|前往).+(?:出差|旅行|旅游)|(?:明天|后天|下周|下个星期).{0,6}去/.test(text)) return null;
  const destination = text.match(/(?:去|前往)([^，。！？\s\d一二两三四五六七八九十]{1,20})/)?.[1]?.replace(/(?:出差|旅游|旅行).*$/, '') || '';
  const offset = /后天/.test(text) ? 2 : /明天/.test(text) ? 1 : /下周|下个星期/.test(text) ? 7 : null;
  const raw = text.match(/([\d一二两三四五六七八九十]+)天/)?.[1];
  const days = /^\d+$/.test(raw || '') ? Number(raw) : { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }[raw];
  return { destination, ...(destination.includes('日本') ? { currency: 'JPY' } : destination.includes('香港') ? { currency: 'HKD' } : {}),
    ...(offset !== null ? { start: travelDate(offset), ...(days >= 1 && days <= 60 ? { end: travelDate(offset + days - 1) } : {}) } : {}) };
}
