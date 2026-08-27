/* =========================================================
 * 轻练 · 计算模块（calc.js）
 * BMR / 每日目标 / 宏量营养素 / 食物换算 / 运动消耗 / 日期工具
 * 全部计算在本地完成，无任何网络调用
 * ========================================================= */
'use strict';

const Calc = (() => {

  /** 活动水平系数 */
  const ACTIVITY = {
    sedentary: { label: '久坐少动', mult: 1.2 },
    light:     { label: '轻度活动', mult: 1.375 },
    moderate:  { label: '中度活动', mult: 1.55 },
    high:      { label: '高度活动', mult: 1.725 }
  };

  /** 健身目标：系数 + 蛋白质供能占比 */
  const GOALS = {
    cut:      { label: '减脂', mult: 0.8, protein: 0.30 },
    bulk:     { label: '增肌', mult: 1.1, protein: 0.25 },
    maintain: { label: '保持', mult: 1.0, protein: 0.20 }
  };

  /** 脂肪供能占比固定 25% */
  const FAT_PCT = 0.25;

  const round = n => Math.round(n);
  const round1 = n => Math.round(n * 10) / 10;

  /** 基础代谢率 BMR：优先使用实测值（如有），否则 Mifflin-St Jeor 公式 */
  function bmr(p) {
    if (p.bmr && p.bmr > 0) return p.bmr;
    const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
    return p.gender === 'male' ? base + 5 : base - 161;
  }

  /** 每日热量目标（BMR × 活动系数 × 目标系数） */
  function dailyTarget(p) {
    return round(bmr(p) * ACTIVITY[p.activity].mult * GOALS[p.goal].mult);
  }

  /** 宏量营养素目标（克）：蛋白质/脂肪/碳水 */
  function macros(target, goalKey) {
    const proteinPct = GOALS[goalKey].protein;
    return {
      protein: round(target * proteinPct / 4),
      fat: round(target * FAT_PCT / 9),
      carb: round(target * (1 - proteinPct - FAT_PCT) / 4)
    };
  }

  /** 某食物按克数折算的营养数据 */
  function foodStats(food, grams) {
    return {
      grams: round1(grams),
      kcal: round(food.kcal * grams / 100),
      protein: round1(food.protein * grams / 100),
      fat: round1(food.fat * grams / 100),
      carb: round1(food.carb * grams / 100)
    };
  }

  /** 运动消耗：MET × 体重(kg) × 时间(小时) */
  function exerciseKcal(met, weightKg, hours) {
    return round(met * weightKg * hours);
  }

  /* ---------- 日期工具 ---------- */
  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function todayStr() { return fmtDate(new Date()); }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }
  function fmtDateCN(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${wd}`;
  }
  function fmtTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  /** 时长（毫秒）→ 中文描述 */
  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}小时${m}分`;
    if (m > 0) return `${m}分${sec}秒`;
    return `${sec}秒`;
  }
  /** 时长（毫秒）→ mm:ss / hh:mm:ss 计时器格式 */
  function fmtClock(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  return {
    ACTIVITY, GOALS, FAT_PCT, round, round1,
    bmr, dailyTarget, macros, foodStats, exerciseKcal,
    fmtDate, todayStr, addDays, fmtDateCN, fmtTime, fmtDuration, fmtClock
  };
})();
