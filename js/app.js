/* =========================================================
 * 轻练 · 主应用（app.js）
 * 启动 / 登录注册 / 视图路由 / 各页面渲染 / 运动计时器
 * ========================================================= */
'use strict';

const App = (() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = UI.escapeHtml;

  const MEALS = [
    { key: 'breakfast', label: '早餐', ico: '🍳' },
    { key: 'lunch', label: '午餐', ico: '🍱' },
    { key: 'dinner', label: '晚餐', ico: '🍽️' },
    { key: 'snack', label: '加餐', ico: '🥜' }
  ];

  /** 内联 SVG 图标（SF Symbols 风格，离线可用，随 currentColor 变色） */
  const SVG = (inner, size) => `<svg viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    search: SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    calendar: SVG('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
    utensils: SVG('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>'),
    dumbbell: SVG('<path d="M6.5 6.5 17.5 17.5"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>'),
    weight: SVG('<circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.9 1.5L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.9-2.5L19.4 9.5A2 2 0 0 0 17.5 8Z"/>'),
    chart: SVG('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
    play: SVG('<polygon points="7 4 20 12 7 20 7 4"/>'),
    pause: SVG('<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>'),
    stop: SVG('<rect x="6" y="6" width="12" height="12" rx="2"/>')
  };

  const state = {
    user: null,
    profileId: null,
    view: 'home',
    foodDate: null, foodQ: '', foodNav: '全部',
    exDate: null, exQ: '', exCat: '全部',
    chartsPeriod: 7,
    timer: null
  };

  /* ================= 启动 ================= */
  function boot() {
    Store.ensureSeeded();
    registerSW();
    listenTheme();
    const user = Store.currentUser();
    if (user) enterApp(user);
    else showAuth();
  }

  /** 跟随系统深浅模式：更新 theme-color 并重建图表 */
  function listenTheme() {
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (!mq) return;
    const apply = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', mq.matches ? '#05050A' : '#F5F5F7');
      if (state.view === 'charts') Charts.retheme();
    };
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
    apply();
  }

  /** 图表页主题重建入口（由 Charts.retheme 调用） */
  function rethemeCharts() {
    if (state.view === 'charts') renderCharts();
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* 离线环境或 file:// 下忽略 */ });
      });
    }
  }

  /* ================= 登录 / 注册 ================= */
  function showAuth() {
    $('#auth-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
    switchAuthTab('login');
  }

  function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
    $('#auth-login-fields').classList.toggle('hidden', !isLogin);
    $('#auth-register-fields').classList.toggle('hidden', isLogin);
    $('#auth-submit').textContent = isLogin ? '登录' : '创建账号';
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    const isLogin = !$('#auth-login-fields').classList.contains('hidden');
    if (isLogin) {
      const u = $('#login-username').value.trim();
      const p = $('#login-password').value;
      const r = Store.login(u, p);
      if (r.ok) enterApp(u);
      else UI.toast(r.error);
    } else {
      const u = $('#reg-username').value.trim();
      const p = $('#reg-password').value;
      const p2 = $('#reg-password2').value;
      const genderEl = document.querySelector('#reg-gender-seg .seg-btn.active');
      const info = {
        name: $('#reg-name').value,
        gender: genderEl ? genderEl.dataset.regGender : 'male',
        age: $('#reg-age').value,
        height: $('#reg-height').value,
        weight: $('#reg-weight').value,
        bmr: $('#reg-bmr').value
      };
      const r = Store.register(u, p, p2, info);
      if (r.ok) { UI.toast('注册成功，已自动登录'); enterApp(u); }
      else UI.toast(r.error);
    }
  }

  function enterApp(user) {
    state.user = user;
    state.profileId = Store.currentProfileId(user);
    state.foodDate = Calc.todayStr();
    state.exDate = Calc.todayStr();
    state.foodNav = 'summary';
    state.foodNav = '全部';
    state.exCat = '全部';
    $('#auth-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    renderHeader();
    switchView('home');
  }

  /* ================= 视图路由 ================= */
  const PAGES = ['home', 'food', 'exercise', 'me', 'charts', 'timer'];

  function switchView(name) {
    state.view = name;
    PAGES.forEach(p => $('#page-' + p).classList.toggle('hidden', p !== name));
    const showTabs = ['home', 'food', 'exercise', 'me'].indexOf(name) >= 0;
    $('#tabbar').classList.toggle('hidden', !showTabs);
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'home') renderHome();
    if (name === 'food') renderFood();
    if (name === 'exercise') renderExercise();
    if (name === 'me') renderMe();
    if (name === 'charts') renderCharts();
    if (name === 'timer') renderTimer();
    window.scrollTo(0, 0);
  }

  /* ================= 数据帮助 ================= */
  function profile() { return Store.getProfile(state.user, state.profileId); }
  function dayRecord(date) { return Store.getDay(state.user, state.profileId, date); }
  function foods() { return FoodDB.all(state.user); }

  function sumMeals(day) {
    const t = { kcal: 0, protein: 0, fat: 0, carb: 0, items: 0 };
    if (!day) return t;
    MEALS.forEach(m => {
      (day.meals[m.key] || []).forEach(it => {
        t.kcal += it.kcal; t.protein += it.protein; t.fat += it.fat; t.carb += it.carb; t.items++;
      });
    });
    return { kcal: Math.round(t.kcal), protein: Calc.round1(t.protein), fat: Calc.round1(t.fat), carb: Calc.round1(t.carb), items: t.items };
  }
  function sumExercises(day) {
    const t = { kcal: 0, minutes: 0, count: 0 };
    if (!day) return t;
    (day.exercises || []).forEach(ex => { t.kcal += ex.kcal; t.minutes += ex.activeMinutes; t.count++; });
    return { kcal: Math.round(t.kcal), minutes: Math.round(t.minutes), count: t.count };
  }

  /* ================= 头像 ================= */
  function avatarHTML(username, size) {
    const av = Store.getAvatar(username);
    if (av) return `<img class="avatar-img" style="width:${size || 32}px;height:${size || 32}px" src="${esc(av)}" alt="头像">`;
    return `<span class="avatar-ph" style="width:${size || 32}px;height:${size || 32}px;font-size:${Math.round((size || 32) * 0.55)}px">👤</span>`;
  }

  function openAvatarPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        compressImage(dataUrl, 256).then(compressed => {
          Store.setAvatar(state.user, compressed);
          renderHeader();
          if (state.view === 'me') renderMe();
          UI.toast('头像已更新');
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /** 将图片裁剪为正方形并压缩为 JPEG dataURL（控制 localStorage 体积） */
  function compressImage(dataUrl, size) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /* ================= 运动计时器核心 ================= */
  function startTimer(exercise) {
    if (state.timer && state.timer.interval) clearInterval(state.timer.interval);
    state.timer = {
      ex: exercise, phase: 'active',
      totalStart: Date.now(), activeStart: Date.now(), restStart: 0,
      activeAccum: 0, restAccum: 0, sets: 1, interval: null,
      loadKg: Store.getLastLoad(state.user, exercise.id) || ''
    };
    switchView('timer');
    tickTimer();
    state.timer.interval = setInterval(tickTimer, 200);
  }

  function timerStats() {
    const t = state.timer;
    const now = Date.now();
    let curActive = 0, curRest = 0;
    if (t.phase === 'active') curActive = now - t.activeStart;
    if (t.phase === 'rest') curRest = now - t.restStart;
    const activeMs = t.activeAccum + curActive;
    const restMs = t.restAccum + curRest;
    const totalMs = now - t.totalStart;
    const weight = profile() ? profile().weight : 0;
    return {
      curActive, curRest, activeMs, restMs, totalMs, sets: t.sets,
      kcal: Calc.exerciseKcal(t.ex.met, weight, activeMs / 3600000)
    };
  }

  function tickTimer() {
    if (!state.timer) return;
    const s = timerStats();
    const el = id => document.getElementById(id);
    const set = (i, v) => { const n = el(i); if (n) n.textContent = v; };
    set('t-cur-active', Calc.fmtClock(s.curActive));
    set('t-cur-rest', Calc.fmtClock(s.curRest));
    set('t-total', Calc.fmtClock(s.totalMs));
    set('t-active', Calc.fmtClock(s.activeMs));
    set('t-rest', Calc.fmtClock(s.restMs));
    set('t-sets', s.sets);
    set('t-kcal', s.kcal);
  }

  function pauseTimer() {
    const t = state.timer;
    if (!t || t.phase !== 'active') return;
    t.activeAccum += Date.now() - t.activeStart;
    t.phase = 'rest';
    t.restStart = Date.now();
    renderTimerButtons();
  }

  function resumeTimer() {
    const t = state.timer;
    if (!t || t.phase !== 'rest') return;
    t.restAccum += Date.now() - t.restStart;
    t.phase = 'active';
    t.activeStart = Date.now();
    t.sets++;
    renderTimerButtons();
  }

  function finishTimer() {
    const t = state.timer;
    if (!t) return null;
    const s = timerStats();
    clearInterval(t.interval);
    t.interval = null;
    return s;
  }

  function saveExerciseRecord(stats) {
    const p = profile();
    const day = Store.getOrCreateDay(state.user, state.profileId, Calc.todayStr());
    const loadKg = state.timer.loadKg ? parseFloat(state.timer.loadKg) : 0;
    if (loadKg > 0) Store.setLastLoad(state.user, state.timer.ex.id, loadKg);
    day.exercises.push({
      exerciseId: state.timer.ex.id,
      name: state.timer.ex.name,
      met: state.timer.ex.met,
      weightKg: p.weight,
      loadKg,
      totalMinutes: Calc.round1(stats.totalMs / 60000),
      activeMinutes: Calc.round1(stats.activeMs / 60000),
      restMinutes: Calc.round1(stats.restMs / 60000),
      sets: stats.sets,
      kcal: stats.kcal,
      completedAt: Calc.fmtTime(new Date())
    });
    Store.saveDay(state.user, state.profileId, Calc.todayStr(), day);
  }

  function confirmEndTimer() {
    const stats = finishTimer();
    if (!stats) return;
    const t = state.timer;
    const m = UI.modal({
      title: '结束运动记录',
      bodyHTML: `
        <div class="stat-grid stat-grid-2">
          <div class="stat-cell"><span class="stat-v">${Calc.fmtDuration(stats.totalMs)}</span><span class="stat-l">总用时</span></div>
          <div class="stat-cell"><span class="stat-v">${Calc.fmtDuration(stats.activeMs)}</span><span class="stat-l">运动时长</span></div>
          <div class="stat-cell"><span class="stat-v">${Calc.fmtDuration(stats.restMs)}</span><span class="stat-l">休息时长</span></div>
          <div class="stat-cell"><span class="stat-v">${stats.sets} 组</span><span class="stat-l">组数</span></div>
        </div>
        <div class="kcal-big">${stats.kcal} <small>kcal</small></div>
        <p class="confirm-text">「${esc(t.ex.name)}」将存入今日运动日记</p>`,
      dismissable: false,
      actions: [
        { label: '放弃记录', cls: 'btn-secondary', value: 'discard' },
        { label: '确认保存', cls: 'btn-primary', value: 'save' }
      ],
      onAction(v) {
        if (v === 'save') saveExerciseRecord(stats);
        m.close();
        state.timer = null;
        switchView('exercise');
        if (v === 'save') UI.toast('已保存运动记录');
      }
    });
  }

  function onTimerBack() {
    if (!state.timer) { switchView('exercise'); return; }
    const s = timerStats();
    const m = UI.modal({
      title: '计时进行中',
      bodyHTML: `<p class="confirm-text">当前已运动 ${Calc.fmtDuration(s.activeMs)}，消耗约 ${s.kcal} kcal。</p>`,
      dismissable: false,
      actions: [
        { label: '继续计时', cls: 'btn-secondary', value: 'continue' },
        { label: '放弃记录', cls: 'btn-secondary', value: 'discard' },
        { label: '结束并保存', cls: 'btn-primary', value: 'save' }
      ],
      onAction(v) {
        if (v === 'continue') return;
        const stats = finishTimer();
        if (v === 'save' && stats) saveExerciseRecord(stats);
        if (v === 'discard' || v === 'save') {
          m.close();
          state.timer = null;
          switchView('exercise');
          if (v === 'save') UI.toast('已保存运动记录');
        }
      }
    });
  }

  /* ================= 头部与档案切换 ================= */
  function renderHeader() {
    const p = profile();
    const chip = $('#profile-chip');
    if (!p) { chip.innerHTML = '<span class="chip-name">＋ 新建档案</span>'; return; }
    const t = Calc.dailyTarget(p);
    chip.innerHTML = `<span class="chip-avatar">${avatarHTML(state.user, 28)}</span><span class="chip-name">${esc(p.name)}</span><span class="chip-target">${t} kcal</span><span class="chip-arrow">🌀</span>`;
  }

  function openProfileSwitch() {
    const profiles = Store.getProfiles(state.user);
    const rows = profiles.map(p => {
      const active = p.id === state.profileId;
      const t = Calc.dailyTarget(p);
      return `<button type="button" class="row" data-act="profile-switch:${esc(p.id)}">
        <span class="row-ico">${active ? '🟢' : '👤'}</span>
        <span class="row-main"><strong>${esc(p.name)}</strong><span class="sub">${Calc.GOALS[p.goal].label} · 每日 ${t} kcal · ${p.weight}kg</span></span>
        <span class="chev">›</span></button>`;
    }).join('');
    const m = UI.modal({
      title: '切换档案',
      bodyHTML: `
        <div class="list">${rows || '<p class="empty">暂无档案，请先创建</p>'}</div>
        <button type="button" class="btn btn-primary btn-block" data-act="profile-new">＋ 新建档案</button>`,
      onAction(v) {
        if (v === 'profile-new') { m.close(); openProfileForm(); return; }
        if (v && v.indexOf('profile-switch:') === 0) {
          const id = v.slice('profile-switch:'.length);
          if (id !== state.profileId) {
            Store.setCurrentProfile(state.user, id);
            state.profileId = id;
            renderHeader();
            switchView('home');
            UI.toast('已切换档案');
          }
          m.close();
        }
      }
    });
  }

/* ================= 首页 ================= */
function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function renderHome() {
  const p = profile();
  if (!p) { $('#page-home').innerHTML = '<div class="card empty-state"><p>还没有身体档案</p><button type="button" class="btn btn-primary" data-act="profile-new">创建档案</button></div>'; return; }
  const date = Calc.todayStr();
  const day = dayRecord(date);
  const target = Calc.dailyTarget(p);
  const intake = sumMeals(day);
  const burned = sumExercises(day);
  const remaining = target - intake.kcal + burned.kcal;
  const pct = target > 0 ? intake.kcal / target : 0;
  const mac = Calc.macros(target, p.goal);
  const wd = Calc.fmtDateCN(date);

  $('#page-home').innerHTML = `
    <div class="bento">
      <section class="card hero-card span-2 fade-in-up" style="--d:0ms">
        <div class="hero-top">
          <div>
            <h2 class="page-title">${greeting()}，${esc(p.name)}</h2>
            <p class="muted">${wd} · ${esc(Calc.GOALS[p.goal].label)}期</p>
          </div>
          <div class="goal-badge">${esc(Calc.GOALS[p.goal].label)}</div>
        </div>
        <div class="hero-main">
          <div class="ring-wrap">
            ${UI.ringHTML(pct, 150, 12, '#0071E3')}
            <div class="ring-center">
              <span class="ring-num">${intake.kcal}</span>
              <span class="ring-label">/ ${target} kcal</span>
            </div>
          </div>
          <div class="hero-stats">
            <div class="hstat"><span class="hstat-v">${target}</span><span class="hstat-l">目标热量</span></div>
            <div class="hstat"><span class="hstat-v">${intake.kcal}</span><span class="hstat-l">已摄入</span></div>
            <div class="hstat"><span class="hstat-v">${burned.kcal}</span><span class="hstat-l">已消耗</span></div>
            <div class="hstat ${remaining < 0 ? 'over' : ''}"><span class="hstat-v">${remaining}</span><span class="hstat-l">${remaining < 0 ? '超支' : '剩余'}</span></div>
          </div>
        </div>
      </section>

      <section class="card fade-in-up" style="--d:80ms">
        <h3 class="card-title">快速记录</h3>
        <div class="quick-grid">
          <button type="button" class="quick-tile" data-act="go-food"><span class="quick-ico tint-green">${ICONS.utensils}</span><span>记饮食</span></button>
          <button type="button" class="quick-tile" data-act="go-exercise"><span class="quick-ico tint-orange">${ICONS.dumbbell}</span><span>记运动</span></button>
          <button type="button" class="quick-tile" data-act="weight-log"><span class="quick-ico tint-purple">${ICONS.weight}</span><span>记体重</span></button>
        </div>
        <button type="button" class="btn btn-secondary btn-block mt-12" data-act="go-charts"><span class="btn-ico">${ICONS.chart}</span>查看数据图表</button>
      </section>

      <section class="card span-2 fade-in-up" style="--d:160ms">
        <div class="card-head">
          <h3 class="card-title">今日饮食</h3>
          <button type="button" class="link-btn" data-act="go-food">去记录 ›</button>
        </div>
        <div class="meal-summary">
          ${MEALS.map(m => {
            const items = day ? (day.meals[m.key] || []) : [];
            const kcal = items.reduce((s, it) => s + it.kcal, 0);
            return `<div class="meal-row">
              <span class="meal-ico">${m.ico}</span>
              <span class="meal-name">${m.label}</span>
              <span class="meal-items">${items.length ? items.length + ' 项' : '—'}</span>
              <span class="meal-kcal">${kcal ? kcal + ' kcal' : ''}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="day-total-bar">
          <div class="bar"><div class="bar-fill" style="width:${Math.min(100, pct * 100).toFixed(1)}%"></div></div>
          <div class="bar-caption"><span>已摄入 <b>${intake.kcal}</b> / ${target} kcal</span><span>剩余 <b class="${remaining < 0 ? 'txt-danger' : ''}">${remaining}</b></span></div>
        </div>
      </section>

      <section class="card fade-in-up" style="--d:240ms">
        <div class="card-head">
          <h3 class="card-title">今日运动</h3>
          <button type="button" class="link-btn" data-act="go-exercise">去记录 ›</button>
        </div>
        ${burned.count ? `
          <div class="ex-summary">
            <div class="ex-big"><span class="ex-num">${burned.kcal}</span><span class="ex-l">kcal</span></div>
            <div class="ex-meta"><span>${burned.count} 次训练</span><span>约 ${burned.minutes} 分钟</span></div>
          </div>` : '<p class="empty-sm">今天还没有运动记录</p>'}
      </section>

      <section class="card span-2 fade-in-up" style="--d:320ms">
        <h3 class="card-title">今日宏量营养素</h3>
        <div class="macro-bars">
          ${macroBar('蛋白质', intake.protein, mac.protein, '#0A84FF')}
          ${macroBar('脂肪', intake.fat, mac.fat, '#FF9F0A')}
          ${macroBar('碳水', intake.carb, mac.carb, '#34C759')}
        </div>
      </section>
    </div>`;
}

function macroBar(label, cur, target, color) {
  const pct = target > 0 ? Math.min(100, cur / target * 100) : 0;
  return `
    <div class="macro-row">
      <div class="macro-top"><span class="macro-label">${label}</span><span class="macro-val">${cur} / ${target} g</span></div>
      <div class="bar"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
    </div>`;
}

/* ================= 饮食页（竖式导航日记） ================= */
const FOOD_NAV = [
  { group: '食物库' },
  { key: '全部', ico: '🍽️', label: '全部' },
  { key: '蔬菜', ico: '🥦', label: '蔬菜' },
  { key: '水果', ico: '🍎', label: '水果' },
  { key: '肉类', ico: '🍗', label: '肉类' },
  { key: '主食', ico: '🍚', label: '主食' },
  { key: '蛋奶', ico: '🥛', label: '蛋奶' },
  { key: '其他', ico: '🥜', label: '其他' },
  { group: '今日饮食' },
  { key: 'summary', ico: '📊', label: '汇总' },
  { key: 'breakfast', ico: '🍳', label: '早餐' },
  { key: 'lunch', ico: '🍱', label: '午餐' },
  { key: 'dinner', ico: '🍽️', label: '晚餐' },
  { key: 'snack', ico: '🥜', label: '加餐' }
];
const FOOD_CATS = new Set(['全部', '蔬菜', '水果', '肉类', '主食', '蛋奶', '其他']);

function renderFood() {
  const p = profile();
  if (!p) { $('#page-food').innerHTML = '<div class="card empty-state"><p>请先创建身体档案</p><button type="button" class="btn btn-primary" data-act="profile-new">创建档案</button></div>'; return; }
  const day = dayRecord(state.foodDate);
  const totals = sumMeals(day);
  const isDiary = !FOOD_CATS.has(state.foodNav);

  const navHTML = FOOD_NAV.map(n => {
    if (n.group) return `<div class="v-nav-label">${n.group}</div>`;
    const active = state.foodNav === n.key;
    return `<button type="button" class="v-nav-btn ${active ? 'active' : ''}" data-act="food-nav:${n.key}"><span class="vn-ico">${n.ico}</span><span>${n.label}</span></button>`;
  }).join('');

  $('#page-food').innerHTML = `
    <div class="page-head">
      <div><h2 class="page-title">饮食</h2><p class="page-sub">记录三餐 · 查询热量</p></div>
      ${dateNav('food')}
    </div>

    <div class="card search-card fade-in-up" style="--d:0ms">
      <div class="search-box">${ICONS.search}<input id="food-search" class="input search-input" type="search" placeholder="搜索食物，如：鸡胸肉、苹果" value="${esc(state.foodQ)}"></div>
    </div>

    <div class="card fade-in-up" style="--d:60ms">
      <div class="diary-split">
        <div class="v-nav">${navHTML}</div>
        <div class="v-content">
          ${isDiary ? `
            <div class="card-head"><h3 class="card-title">今日饮食</h3>
              ${totals.items ? `<button type="button" class="link-btn txt-danger" data-act="clear-day">清空当日</button>` : ''}
            </div>
            ${foodDiaryContent()}` : `
            <div class="card-head"><h3 class="card-title">食物库</h3><span class="muted">每 100g 数据</span></div>
            <div class="food-list" id="food-list"></div>`}
        </div>
      </div>
    </div>`;
  if (!isDiary) renderFoodList();
}

function foodDiaryContent() {
  const day = dayRecord(state.foodDate);
  const totals = sumMeals(day);
  const target = Calc.dailyTarget(profile());
  const burned = sumExercises(day);
  const remaining = target - totals.kcal + burned.kcal;
  const mac = Calc.macros(target, profile().goal);

  if (state.foodNav === 'summary') {
    return `
      <div class="stat-grid stat-grid-2">
        <div class="stat-cell"><span class="stat-v">${totals.kcal}</span><span class="stat-l">已摄入</span></div>
        <div class="stat-cell"><span class="stat-v ${remaining < 0 ? 'txt-danger' : ''}">${remaining}</span><span class="stat-l">剩余可摄入</span></div>
      </div>
      <div class="day-total-bar">
        <div class="bar"><div class="bar-fill" style="width:${Math.min(100, totals.kcal / target * 100).toFixed(1)}%"></div></div>
        <div class="bar-caption"><span>目标 <b>${target}</b> kcal</span><span>运动消耗 <b>${burned.kcal}</b> kcal</span></div>
      </div>
      <div class="macro-bars mt-12">
        ${macroBar('蛋白质', totals.protein, mac.protein, '#0A84FF')}
        ${macroBar('脂肪', totals.fat, mac.fat, '#FF9F0A')}
        ${macroBar('碳水', totals.carb, mac.carb, '#34C759')}
      </div>
      ${!totals.items ? '<p class="empty-sm">今天还没有饮食记录，从上方食物库添加吧</p>' : ''}`;
  }
  const meal = MEALS.find(m => m.key === state.foodNav);
  const items = day ? (day.meals[state.foodNav] || []) : [];
  const kcal = items.reduce((s, it) => s + it.kcal, 0);
  return `
    <div class="meal-view-head"><span>${meal.ico} ${meal.label}</span><span class="meal-view-kcal">${kcal} kcal</span></div>
    ${items.length ? items.map((it, idx) => `
      <div class="food-item">
        <div class="food-item-main">
          <span class="food-item-name">${esc(it.name)}</span>
          <span class="food-item-amt">${it.grams}${it.unit === '克' ? 'g' : it.unit} · P${it.protein} F${it.fat} C${it.carb}</span>
        </div>
        <span class="food-item-kcal">${it.kcal}</span>
        <button type="button" class="mini-del" data-act="del-meal:${state.foodNav}:${idx}">✕</button>
      </div>`).join('') : `<p class="empty-sm">${meal.label}还没有记录</p>`}
    <button type="button" class="btn btn-secondary btn-block mt-12" data-act="focus-food">＋ 添加${meal.label}</button>`;
}

function renderFoodList() {
  const wrap = document.getElementById('food-list');
  if (!wrap) return;
  const list = foods().filter(f => {
    const okQ = !state.foodQ || f.name.toLowerCase().indexOf(state.foodQ.toLowerCase()) >= 0;
    const okC = state.foodNav === '全部' || f.cat === state.foodNav;
    return okQ && okC;
  });
  wrap.innerHTML = list.length ? list.map(f => `
    <button type="button" class="list-row" data-act="pick-food:${esc(f.id)}">
      <span class="list-ico">${catIco(f.cat)}</span>
      <span class="list-main"><strong>${esc(f.name)}</strong><span class="sub">${esc(f.cat)} · ${f.kcal} kcal · P${f.protein} F${f.fat} C${f.carb}</span></span>
      <span class="chev">＋</span>
    </button>`).join('') : '<p class="empty">没有找到相关食物</p>';
}

/* ================= 添加食物弹窗 ================= */
function openFoodModal(foodId) {
  const list = foods();
  const food = list.find(f => f.id === foodId);
  if (!food) return;
  const unitOptions = food.units.map(u =>
    `<option value="${esc(u.name)}" data-g="${u.g}" ${u.name === '克' ? 'selected' : ''}>${esc(u.name)}（1${esc(u.name)} = ${u.g}g）</option>`).join('');
  const selectedUnit = food.units.find(u => u.name === '克') || food.units[0];
  const preview = Calc.foodStats(food, 100);

  const m = UI.modal({
    title: `添加 · ${food.name}`,
    bodyHTML: `
      <div class="food-preview">
        <span class="preview-kcal">${preview.kcal} <small>kcal</small></span>
        <span class="preview-macro">蛋白质 ${preview.protein}g · 脂肪 ${preview.fat}g · 碳水 ${preview.carb}g</span>
        <span class="preview-note">（按 100g 计）</span>
      </div>
      <div class="form-grid">
        <div>
          <label class="label">份量</label>
          <input id="f-amount" class="input" type="number" inputmode="decimal" value="100" min="1" step="1">
        </div>
        <div>
          <label class="label">单位</label>
          <select id="f-unit" class="input select">${unitOptions}</select>
        </div>
      </div>
      <div class="form-grid">
        ${MEALS.map(md => `<label class="meal-option"><input type="radio" name="f-meal" value="${md.key}" ${md.key === 'lunch' ? 'checked' : ''}><span>${md.ico} ${md.label}</span></label>`).join('')}
      </div>
      <div class="food-calc">
        <span>本次摄入</span>
        <b id="f-calc">—</b>
      </div>`,
    actions: [
      { label: '取消', cls: 'btn-secondary', value: 'cancel' },
      { label: '加入日记', cls: 'btn-primary', value: 'add' }
    ],
    onOpen(el) {
      const amount = el.querySelector('#f-amount');
      const unit = el.querySelector('#f-unit');
      const calc = el.querySelector('#f-calc');
      function update() {
        const g = unit.selectedOptions[0].dataset.g;
        const grams = parseFloat(amount.value) * parseFloat(g);
        const s = Calc.foodStats(food, grams || 0);
        calc.textContent = `${s.kcal} kcal · 蛋白质 ${s.protein}g · 脂肪 ${s.fat}g · 碳水 ${s.carb}g`;
      }
      amount.addEventListener('input', update);
      unit.addEventListener('change', update);
      update();
    },
    onAction(v) {
      if (v !== 'add') return;
      const amount = parseFloat($('#f-amount').value);
      const unitName = $('#f-unit').value;
      const g = parseFloat($('#f-unit').selectedOptions[0].dataset.g);
      const meal = (document.querySelector('input[name="f-meal"]:checked') || {}).value || 'lunch';
      const grams = (amount || 0) * g;
      if (grams <= 0) { UI.toast('请输入有效份量'); return; }
      const s = Calc.foodStats(food, grams);
      const day = Store.getOrCreateDay(state.user, state.profileId, state.foodDate);
      day.meals[meal].push({
        foodId: food.id, name: food.name, grams: s.grams,
        unit: unitName, kcal: s.kcal, protein: s.protein, fat: s.fat, carb: s.carb
      });
      Store.saveDay(state.user, state.profileId, state.foodDate, day);
      state.foodNav = meal; // 添加后自动跳到对应餐次
      m.close();
      renderFood();
      UI.toast(`已加入${MEALS.find(x => x.key === meal).label}`);
    }
  });
}

function dateNav(prefix) {
  const date = state[prefix + 'Date'];
  const isToday = date === Calc.todayStr();
  return `<div class="date-nav">
    <button type="button" class="date-btn" data-act="${prefix}-prev" aria-label="前一天">‹</button>
    <button type="button" class="date-label-btn" data-act="${prefix}-cal" title="打开日历">
      ${ICONS.calendar}<span class="date-label-text">${Calc.fmtDateCN(date)}</span>${isToday ? '<b class="today-tag">今天</b>' : ''}
    </button>
    <button type="button" class="date-btn" data-act="${prefix}-next" aria-label="后一天">›</button>
    ${isToday ? '' : `<button type="button" class="date-btn today-btn" data-act="${prefix}-today">回到今天</button>`}
  </div>`;
}

/* ================= 日历选择器 ================= */
function openCalendar(prefix) {
  const cur = state[prefix + 'Date'];            // YYYY-MM-DD
  const today = Calc.todayStr();
  let y = parseInt(cur.slice(0, 4), 10);
  let mon = parseInt(cur.slice(5, 7), 10) - 1;   // 0-based
  const box = { el: null };
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  function renderCal() {
    const firstDow = new Date(y, mon, 1).getDay();
    const days = new Date(y, mon + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push('<span class="cal-cell cal-empty"></span>');
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + String(mon + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const cls = ['cal-cell', ds === cur ? 'selected' : '', ds === today ? 'today' : ''].filter(Boolean).join(' ');
      cells.push(`<button type="button" class="${cls}" data-act="cal-pick:${ds}">${d}</button>`);
    }
    let html = '<div class="cal-head">'
      + `<button type="button" class="cal-nav" data-act="cal-prev" aria-label="上个月">‹</button>`
      + `<span class="cal-title">${y} 年 ${mon + 1} 月</span>`
      + `<button type="button" class="cal-nav" data-act="cal-next" aria-label="下个月">›</button></div>`
      + '<div class="cal-week">' + WEEK.map(w => `<span>${w}</span>`).join('') + '</div>';
    for (let i = 0; i < cells.length; i += 7) {
      html += '<div class="cal-row">' + cells.slice(i, i + 7).join('') + '</div>';
    }
    if (cur !== today) html += `<button type="button" class="cal-today-link" data-act="cal-today">回到今天</button>`;
    if (box.el) box.el.innerHTML = html;
  }

  const dlg = UI.modal({
    title: '选择日期',
    bodyHTML: '<div id="cal-wrap"></div>',
    onOpen(el) { box.el = el.querySelector('#cal-wrap'); renderCal(); },
    onAction(v) {
      if (v === 'cal-prev') { mon--; if (mon < 0) { mon = 11; y--; } renderCal(); return; }
      if (v === 'cal-next') { mon++; if (mon > 11) { mon = 0; y++; } renderCal(); return; }
      if (v === 'cal-today') { const t = today.split('-'); y = +t[0]; mon = +t[1] - 1; renderCal(); return; }
      if (v && v.indexOf('cal-pick:') === 0) {
        state[prefix + 'Date'] = v.slice(9);
        dlg.close();
        if (prefix === 'food') renderFood(); else renderExercise();
      }
    }
  });
}

function catIco(cat) {
  const c = FoodDB.CATS.find(x => x.key === cat);
  return c ? c.ico : '🍽️';
}

/* ================= 运动页（竖式导航分类） ================= */
const EX_NAV = [{ key: '全部', ico: '🏷️', label: '全部' }].concat(
  ExerciseDB.CATS.map(c => ({ key: c.key, ico: c.ico, label: c.key === '柔韧恢复' ? '柔韧' : c.key }))
);

function renderExercise() {
  const p = profile();
  if (!p) { $('#page-exercise').innerHTML = '<div class="card empty-state"><p>请先创建身体档案</p><button type="button" class="btn btn-primary" data-act="profile-new">创建档案</button></div>'; return; }
  const day = dayRecord(state.exDate);
  const totals = filteredExTotals(day);

  $('#page-exercise').innerHTML = `
    <div class="page-head">
      <div><h2 class="page-title">运动</h2><p class="page-sub">记录训练 · 实时消耗</p></div>
      ${dateNav('ex')}
    </div>

    <div class="card search-card fade-in-up" style="--d:0ms">
      <div class="search-box">${ICONS.search}<input id="ex-search" class="input search-input" type="search" placeholder="搜索运动，如：慢跑、深蹲" value="${esc(state.exQ)}"></div>
    </div>

    <div class="card fade-in-up" style="--d:60ms">
      <div class="diary-split">
        <div class="v-nav">
          ${EX_NAV.map(n => `<button type="button" class="v-nav-btn ${state.exCat === n.key ? 'active' : ''}" data-act="ex-cat:${n.key}"><span class="vn-ico">${n.ico}</span><span>${n.label}</span></button>`).join('')}
        </div>
        <div class="v-content">
          <div class="card-head"><h3 class="card-title">选择运动</h3><span class="muted">体重 ${p.weight}kg</span></div>
          <div class="food-list" id="ex-list"></div>
          <div class="card-head mt-16"><h3 class="card-title">当日记录</h3><span class="muted">${totals.kcal} kcal</span></div>
          <div id="ex-diary">${exDiaryContent()}</div>
        </div>
      </div>
    </div>`;
  renderExerciseList();
}

function exCategory(ex) {
  const e = ExerciseDB.findById(ex.exerciseId);
  return e ? e.cat : '其他';
}

function filteredExList() {
  return ExerciseDB.all().filter(e => {
    const okQ = !state.exQ || e.name.toLowerCase().indexOf(state.exQ.toLowerCase()) >= 0;
    const okC = state.exCat === '全部' || e.cat === state.exCat;
    return okQ && okC;
  });
}

function filteredExTotals(day) {
  const t = { kcal: 0, minutes: 0, count: 0 };
  if (!day) return t;
  day.exercises.forEach(ex => {
    if (state.exCat !== '全部' && exCategory(ex) !== state.exCat) return;
    t.kcal += ex.kcal; t.minutes += ex.activeMinutes; t.count++;
  });
  return { kcal: Math.round(t.kcal), minutes: Math.round(t.minutes), count: t.count };
}

function exDiaryContent() {
  const day = dayRecord(state.exDate);
  if (!day || !day.exercises.length) return '<p class="empty-sm">当天还没有运动记录</p>';
  const list = day.exercises.map((ex, idx) => ({ ex, idx })).filter(x =>
    state.exCat === '全部' || exCategory(x.ex) === state.exCat);
  if (!list.length) return '<p class="empty-sm">该分类暂无记录</p>';
  return list.map(({ ex, idx }) => `
    <div class="food-item">
      <div class="food-item-main">
        <span class="food-item-name">${esc(ex.name)}</span>
        <span class="food-item-amt">${ex.loadKg ? ex.loadKg + 'kg · ' : ''}${ex.activeMinutes} 分钟 · ${ex.sets} 组 · ${ex.completedAt} 完成</span>
      </div>
      <span class="food-item-kcal">${ex.kcal} kcal</span>
      <button type="button" class="mini-del" data-act="del-ex:${idx}">✕</button>
    </div>`).join('');
}

function renderExerciseList() {
  const wrap = document.getElementById('ex-list');
  if (!wrap) return;
  const p = profile();
  const list = filteredExList();
  wrap.innerHTML = list.length ? list.map(e => `
    <button type="button" class="list-row" data-act="start-ex:${esc(e.id)}">
      <span class="list-ico">${catIco(e.cat)}</span>
      <span class="list-main"><strong>${esc(e.name)}</strong><span class="sub">${esc(e.cat)} · MET ${e.met} · ${Math.round(e.met * p.weight * 0.5)} kcal/30min</span></span>
      <span class="chev">▶</span>
    </button>`).join('') : '<p class="empty">没有找到相关运动</p>';
}

/* ================= 计时器页 ================= */
function renderTimer() {
  const t = state.timer;
  if (!t) { switchView('exercise'); return; }
  const p = profile();
  $('#page-timer').innerHTML = `
    <div class="page-head">
      <h2 class="page-title">运动计时</h2>
      <button type="button" class="date-btn" data-act="timer-back">‹ 返回</button>
    </div>
    <div class="card timer-card fade-in-up" style="--d:0ms">
      <div class="timer-name">${esc(t.ex.name)}</div>
      <div class="timer-meta">MET ${t.ex.met} · 体重 ${p.weight}kg</div>

      ${t.ex.cat === '力量' ? `
        <div class="load-box">
          <div class="load-label">训练重量 <span class="muted">kg · 杠铃/哑铃负重</span></div>
          <div class="load-stepper">
            <button type="button" class="load-btn" data-act="load-minus" aria-label="减重">−</button>
            <input id="t-load" class="input load-input" type="number" inputmode="decimal" min="0" step="2.5" value="${t.loadKg || ''}" placeholder="如 20">
            <button type="button" class="load-btn" data-act="load-plus" aria-label="加重">＋</button>
          </div>
        </div>` : ''}

      <div class="timer-current">
        <div class="timer-cell">
          <span class="timer-clock" id="t-cur-active">00:00</span>
          <span class="timer-cell-label">当前小组计时</span>
        </div>
        <div class="timer-cell">
          <span class="timer-clock rest" id="t-cur-rest">00:00</span>
          <span class="timer-cell-label">当前休息计时</span>
        </div>
      </div>

      <div class="stat-grid stat-grid-4">
        <div class="stat-cell"><span class="stat-v" id="t-total">00:00</span><span class="stat-l">总用时</span></div>
        <div class="stat-cell"><span class="stat-v" id="t-active">00:00</span><span class="stat-l">运动时长</span></div>
        <div class="stat-cell"><span class="stat-v" id="t-rest">00:00</span><span class="stat-l">休息时长</span></div>
        <div class="stat-cell"><span class="stat-v" id="t-sets">1</span><span class="stat-l">组数</span></div>
      </div>

      <div class="kcal-big" id="t-kcal">0 <small>kcal</small></div>
      <p class="muted center">实时预计消耗（按运动时长）</p>
      <div id="timer-buttons"></div>
    </div>`;
  renderTimerButtons();
}

function renderTimerButtons() {
  const t = state.timer;
  const wrap = document.getElementById('timer-buttons');
  if (!wrap || !t) return;
  if (t.phase === 'active') {
    wrap.innerHTML = `
      <div class="btn-pair">
        <button type="button" class="btn btn-secondary btn-big" data-act="timer-pause"><span class="btn-ico">${ICONS.pause}</span>暂停</button>
        <button type="button" class="btn btn-danger btn-big" data-act="timer-end"><span class="btn-ico">${ICONS.stop}</span>结束</button>
      </div>`;
  } else if (t.phase === 'rest') {
    wrap.innerHTML = `
      <div class="btn-pair">
        <button type="button" class="btn btn-primary btn-big" data-act="timer-resume"><span class="btn-ico">${ICONS.play}</span>继续（第 ${t.sets + 1} 组）</button>
        <button type="button" class="btn btn-danger btn-big" data-act="timer-end"><span class="btn-ico">${ICONS.stop}</span>结束</button>
      </div>`;
  } else {
    wrap.innerHTML = `<button type="button" class="btn btn-primary btn-big btn-block" data-act="timer-start"><span class="btn-ico">${ICONS.play}</span>开始</button>`;
  }
}

/* ================= 我的页（分组列表） ================= */
function renderMe() {
  const p = profile();
  const profiles = Store.getProfiles(state.user);
  const customFoods = Store.getCustomFoods(state.user);
  const isDemo = state.user === 'A';

  const profileRows = profiles.map(pr => `
    <button type="button" class="row" data-act="profile-switch:${esc(pr.id)}">
      <span class="row-ico">${pr.id === state.profileId ? '✔️' : '👤'}</span>
      <span class="row-main"><strong>${esc(pr.name)}</strong><span class="sub">${Calc.GOALS[pr.goal].label} · 每日 ${Calc.dailyTarget(pr)} kcal · ${pr.weight}kg</span></span>
      <span class="chev">›</span>
    </button>`).join('');

  const foodRows = customFoods.map(f => `
    <button type="button" class="row" data-act="food-edit:${esc(f.id)}">
      <span class="row-ico">🍽️</span>
      <span class="row-main"><strong>${esc(f.name)}</strong><span class="sub">${f.kcal} kcal/100g · P${f.protein} F${f.fat} C${f.carb}</span></span>
      <span class="chev">✎</span>
    </button>`).join('');

  $('#page-me').innerHTML = `
    <div class="page-head"><h2 class="page-title">我的</h2></div>

    ${p ? `
    <div class="card me-head fade-in-up" style="--d:0ms">
      <button type="button" class="avatar-btn" data-act="avatar-pick">
        ${avatarHTML(state.user, 72)}
        <span class="avatar-edit">编辑</span>
      </button>
      <div class="me-head-info">
        <div class="me-name">${esc(p.name)}</div>
        <div class="me-sub">${p.gender === 'male' ? '♂ 男' : '♀ 女'} · ${p.age} 岁 · ${p.height}cm · ${p.weight}kg</div>
        <div class="me-tags">
          <span class="tag">${esc(Calc.GOALS[p.goal].label)}</span>
          <span class="tag">${esc(Calc.ACTIVITY[p.activity].label)}</span>
          <span class="tag brand">每日 ${Calc.dailyTarget(p)} kcal</span>
        </div>
      </div>
    </div>
    <div class="card me-target fade-in-up" style="--d:60ms">
      <div class="stat-grid stat-grid-3">
        <div class="stat-cell"><span class="stat-v">${Calc.round(Calc.bmr(p))}</span><span class="stat-l">基础代谢 BMR</span></div>
        <div class="stat-cell"><span class="stat-v">${Calc.dailyTarget(p)}</span><span class="stat-l">每日目标 kcal</span></div>
        <div class="stat-cell"><span class="stat-v">${p.weight}kg</span><span class="stat-l">当前体重</span></div>
      </div>
      <button type="button" class="btn btn-secondary btn-block mt-12" data-act="profile-edit">编辑档案</button>
    </div>` : '<div class="card empty-state"><p>暂无档案</p><button type="button" class="btn btn-primary" data-act="profile-new">创建档案</button></div>'}

    <div class="group fade-in-up" style="--d:100ms">
      <div class="group-label">身体档案</div>
      <div class="card group-card">
        ${profileRows || '<p class="empty-sm">暂无档案</p>'}
        <button type="button" class="row" data-act="profile-new"><span class="row-ico add">＋</span><span class="row-main"><strong>新建档案</strong></span><span class="chev">›</span></button>
      </div>
    </div>

    <div class="group fade-in-up" style="--d:140ms">
      <div class="group-label">记录与图表</div>
      <div class="card group-card">
        <button type="button" class="row" data-act="weight-log"><span class="row-ico">⚖️</span><span class="row-main"><strong>记录今日体重</strong></span><span class="chev">›</span></button>
        <button type="button" class="row" data-act="go-charts"><span class="row-ico">📊</span><span class="row-main"><strong>数据图表</strong></span><span class="chev">›</span></button>
      </div>
    </div>

    <div class="group fade-in-up" style="--d:180ms">
      <div class="group-label">食物库</div>
      <div class="card group-card">
        ${foodRows}
        <button type="button" class="row" data-act="food-new"><span class="row-ico add">＋</span><span class="row-main"><strong>添加自定义食物</strong></span><span class="chev">›</span></button>
      </div>
    </div>

    <div class="group fade-in-up" style="--d:220ms">
      <div class="group-label">数据与账号</div>
      <div class="card group-card">
        <button type="button" class="row" data-act="data-export"><span class="row-ico">📤</span><span class="row-main"><strong>导出数据备份</strong></span><span class="chev">›</span></button>
        <button type="button" class="row" data-act="data-import"><span class="row-ico">📥</span><span class="row-main"><strong>导入数据备份</strong></span><span class="chev">›</span></button>
        <button type="button" class="row" data-act="change-password"><span class="row-ico">🔑</span><span class="row-main"><strong>修改密码</strong></span><span class="chev">›</span></button>
        ${isDemo ? `
        <button type="button" class="row" data-act="data-clear"><span class="row-ico">🧹</span><span class="row-main"><strong>清空当前档案记录</strong></span><span class="chev">›</span></button>
        <button type="button" class="row" data-act="data-reseed"><span class="row-ico">✨</span><span class="row-main"><strong>重新生成演示数据</strong></span><span class="chev">›</span></button>
        <button type="button" class="row danger-row" data-act="data-reset"><span class="row-ico">🗑️</span><span class="row-main"><strong>重置全部数据</strong></span><span class="chev">›</span></button>` : ''}
        <button type="button" class="row danger-row" data-act="logout"><span class="row-ico">⏻</span><span class="row-main"><strong>退出登录</strong></span><span class="chev">›</span></button>
      </div>
    </div>

    <div class="group fade-in-up" style="--d:260ms">
      <div class="group-label">关于</div>
      <div class="card group-card about-card">
        <p><strong>轻练</strong> v1.1 · 纯前端 PWA</p>
        <p class="muted">所有数据仅存储在本机浏览器，不上传任何服务器。</p>
      </div>
    </div>`;
}

/* ================= 图表页 ================= */
function renderCharts() {
  const p = profile();
  if (!p) { switchView('me'); return; }
  const period = state.chartsPeriod;
  const days = [];
  for (let i = period - 1; i >= 0; i--) {
    const date = Calc.addDays(Calc.todayStr(), -i);
    const day = dayRecord(date);
    const t1 = sumMeals(day);
    const t2 = sumExercises(day);
    days.push({ date, label: (date.slice(5) + '').replace('-', '/'), intake: t1.kcal, burn: t2.kcal, weight: Store.getWeights(state.user, state.profileId)[date] });
  }
  const today = dayRecord(Calc.todayStr());
  const tm = sumMeals(today);
  const target = Calc.dailyTarget(p);

  $('#page-charts').innerHTML = `
    <div class="page-head">
      <div><h2 class="page-title">数据图表</h2><p class="page-sub">${esc(p.name)} · 每日 ${target} kcal</p></div>
      <button type="button" class="date-btn" data-act="back-charts">‹ 返回我的</button>
    </div>
    <div class="seg mb-16">
      <button type="button" class="seg-btn ${period === 7 ? 'active' : ''}" data-act="chart-period:7">近 7 天</button>
      <button type="button" class="seg-btn ${period === 30 ? 'active' : ''}" data-act="chart-period:30">近 30 天</button>
    </div>
    <div class="bento">
      <div class="card span-2 fade-in-up" style="--d:0ms">
        <h3 class="card-title">每日摄入热量</h3>
        <div class="chart-box"><canvas id="chart-intake"></canvas></div>
      </div>
      <div class="card fade-in-up" style="--d:60ms">
        <h3 class="card-title">每日消耗热量</h3>
        <div class="chart-box"><canvas id="chart-burn"></canvas></div>
      </div>
      <div class="card span-2 fade-in-up" style="--d:120ms">
        <h3 class="card-title">体重变化</h3>
        <div class="chart-box"><canvas id="chart-weight"></canvas></div>
      </div>
      <div class="card fade-in-up" style="--d:180ms">
        <h3 class="card-title">今日宏量营养素</h3>
        <div class="chart-box doughnut-box"><canvas id="chart-macro"></canvas></div>
      </div>
    </div>`;

  if (Charts.available) {
    Charts.destroyAll();
    Charts.intakeBar($('#chart-intake'), days.map(d => d.label), days.map(d => d.intake), target);
    Charts.burnBar($('#chart-burn'), days.map(d => d.label), days.map(d => d.burn));
    Charts.weightLine($('#chart-weight'), days.map(d => d.label), days.map(d => d.weight));
    Charts.macroDoughnut($('#chart-macro'), tm.protein, tm.fat, tm.carb);
  }
}

/* ================= 档案表单（含实测 BMR 选填） ================= */
function openProfileForm(profileId) {
  const existing = profileId ? Store.getProfile(state.user, profileId) : null;
  const p = existing || { name: '', gender: 'male', age: 25, height: 170, weight: 65, goal: 'maintain', activity: 'light', bmr: 0 };
  const goalOpts = Object.entries(Calc.GOALS).map(([k, v]) =>
    `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${v.label}</option>`).join('');
  const actOpts = Object.entries(Calc.ACTIVITY).map(([k, v]) =>
    `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${v.label}</option>`).join('');

  const m = UI.modal({
    title: existing ? '编辑档案' : '新建档案',
    bodyHTML: `
      <label class="label">昵称</label>
      <input id="pf-name" class="input" placeholder="如：自己 / 家人" value="${esc(p.name)}">
      <label class="label">性别</label>
      <div class="seg mb-12">
        <button type="button" class="seg-btn ${p.gender === 'male' ? 'active' : ''}" data-pf-gender="male">♂ 男</button>
        <button type="button" class="seg-btn ${p.gender === 'female' ? 'active' : ''}" data-pf-gender="female">♀ 女</button>
      </div>
      <div class="form-grid">
        <div><label class="label">年龄</label><input id="pf-age" class="input" type="number" inputmode="numeric" value="${p.age}"></div>
        <div><label class="label">身高 (cm)</label><input id="pf-height" class="input" type="number" inputmode="decimal" value="${p.height}"></div>
        <div><label class="label">体重 (kg)</label><input id="pf-weight" class="input" type="number" inputmode="decimal" value="${p.weight}"></div>
      </div>
      <div class="form-grid">
        <div><label class="label">健身目标</label><select id="pf-goal" class="input select">${goalOpts}</select></div>
        <div><label class="label">活动水平</label><select id="pf-activity" class="input select">${actOpts}</select></div>
      </div>
      <div>
        <label class="label">基础代谢 <span class="opt">选填</span></label>
        <input id="pf-bmr" class="input" type="number" inputmode="decimal" value="${p.bmr || ''}" placeholder="如有真实数据请填写">
        <span class="hint-sm">实测静息代谢值（kcal），留空将按 Mifflin-St Jeor 公式自动计算。</span>
      </div>
      <p class="muted mt-12">保存后将立即重新计算每日热量目标。</p>`,
    dismissable: false,
    actions: [
      { label: '取消', cls: 'btn-secondary', value: 'cancel' },
      { label: '保存', cls: 'btn-primary', value: 'save' }
    ],
    onOpen(el) {
      el.querySelectorAll('[data-pf-gender]').forEach(b => b.addEventListener('click', () => {
        el.querySelectorAll('[data-pf-gender]').forEach(x => x.classList.toggle('active', x === b));
      }));
    },
    onAction(v) {
      if (v !== 'save') return;
      const name = $('#pf-name').value.trim();
      const age = parseInt($('#pf-age').value, 10);
      const height = parseFloat($('#pf-height').value);
      const weight = parseFloat($('#pf-weight').value);
      const genderEl = document.querySelector('.modal [data-pf-gender].active');
      const gender = genderEl ? genderEl.dataset.pfGender : 'male';
      const goal = $('#pf-goal').value;
      const activity = $('#pf-activity').value;
      const bmr = parseFloat($('#pf-bmr').value) || 0;
      if (!name) return UI.toast('请输入昵称');
      if (isNaN(age) || age < 10 || age > 100) return UI.toast('年龄需在 10-100 之间');
      if (isNaN(height) || height < 100 || height > 250) return UI.toast('身高需在 100-250 cm 之间');
      if (isNaN(weight) || weight < 30 || weight > 300) return UI.toast('体重需在 30-300 kg 之间');
      if (bmr && (bmr < 600 || bmr > 5000)) return UI.toast('基础代谢需在 600-5000 kcal 之间');
      const rec = existing ? Object.assign(existing, { name, gender, age, height, weight, goal, activity, bmr }) : Store.makeProfile(name, gender, age, height, weight, goal, activity, bmr);
      Store.saveProfile(state.user, rec);
      if (!existing) { Store.setCurrentProfile(state.user, rec.id); state.profileId = rec.id; }
      m.close();
      renderHeader();
      if (state.view === 'me') renderMe(); else switchView('me');
      UI.toast(existing ? '档案已更新' : '档案已创建');
    }
  });
}

/* ================= 体重记录 ================= */
function openWeightLog() {
  const p = profile();
  if (!p) return;
  const m = UI.modal({
    title: '记录今日体重',
    bodyHTML: `
      <label class="label">今日体重 (kg)</label>
      <input id="wl-input" class="input" type="number" inputmode="decimal" step="0.1" value="${p.weight}" placeholder="如：69.8">`,
    dismissable: false,
    actions: [
      { label: '取消', cls: 'btn-secondary', value: 'cancel' },
      { label: '保存', cls: 'btn-primary', value: 'save' }
    ],
    onAction(v) {
      if (v !== 'save') return;
      const kg = parseFloat($('#wl-input').value);
      if (isNaN(kg) || kg < 30 || kg > 300) return UI.toast('请输入有效体重（30-300 kg）');
      Store.logWeight(state.user, state.profileId, Calc.todayStr(), Calc.round1(kg));
      m.close();
      UI.toast('已记录今日体重');
      renderHeader();
      if (state.view === 'home') renderHome();
      if (state.view === 'me') renderMe();
    }
  });
}

/* ================= 自定义食物表单 ================= */
function openFoodForm(foodId) {
  const list = Store.getCustomFoods(state.user);
  const existing = foodId ? list.find(f => f.id === foodId) : null;
  const f = existing || { name: '', cat: '其他', kcal: 100, protein: 5, fat: 3, carb: 15, unit: '克', unitG: 1 };
  const catOpts = FoodDB.CATS.map(c => `<option value="${c.key}" ${f.cat === c.key ? 'selected' : ''}>${c.ico} ${c.key}</option>`).join('');
  const unitOpts = ['克', '个', '杯', '勺', '毫升', '份', '碗', '片', '把'].map(u =>
    `<option value="${u}" ${f.unit === u ? 'selected' : ''}>${u}</option>`).join('');

  const m = UI.modal({
    title: existing ? '编辑自定义食物' : '添加自定义食物',
    bodyHTML: `
      <label class="label">食物名称</label>
      <input id="cf-name" class="input" placeholder="如：自制鸡胸肉丸" value="${esc(f.name)}">
      <div class="form-grid">
        <div><label class="label">分类</label><select id="cf-cat" class="input select">${catOpts}</select></div>
        <div><label class="label">常用单位</label><select id="cf-unit" class="input select">${unitOpts}</select></div>
      </div>
      <div class="form-grid">
        <div><label class="label">每 100g 热量 (kcal)</label><input id="cf-kcal" class="input" type="number" inputmode="decimal" value="${f.kcal}"></div>
        <div><label class="label">每单位克数</label><input id="cf-unitg" class="input" type="number" inputmode="decimal" value="${f.unitG}"><span class="hint-sm" id="cf-unitg-hint">仅「克」以外单位需填写</span></div>
      </div>
      <div class="form-grid">
        <div><label class="label">蛋白质 (g/100g)</label><input id="cf-protein" class="input" type="number" inputmode="decimal" value="${f.protein}"></div>
        <div><label class="label">脂肪 (g/100g)</label><input id="cf-fat" class="input" type="number" inputmode="decimal" value="${f.fat}"></div>
        <div><label class="label">碳水 (g/100g)</label><input id="cf-carb" class="input" type="number" inputmode="decimal" value="${f.carb}"></div>
      </div>`,
    dismissable: false,
    actions: [
      { label: '取消', cls: 'btn-secondary', value: 'cancel' },
      { label: '保存', cls: 'btn-primary', value: 'save' }
    ],
    onAction(v) {
      if (v !== 'save') return;
      const name = $('#cf-name').value.trim();
      const cat = $('#cf-cat').value;
      const kcal = parseFloat($('#cf-kcal').value);
      const protein = parseFloat($('#cf-protein').value) || 0;
      const fat = parseFloat($('#cf-fat').value) || 0;
      const carb = parseFloat($('#cf-carb').value) || 0;
      const unit = $('#cf-unit').value;
      let unitG = unit === '克' ? 1 : parseFloat($('#cf-unitg').value);
      if (!name) return UI.toast('请输入食物名称');
      if (isNaN(kcal) || kcal < 0 || kcal > 900) return UI.toast('请输入有效热量（0-900 kcal）');
      if (unit !== '克' && (isNaN(unitG) || unitG <= 0)) return UI.toast('请输入每单位克数');
      const foods = Store.getCustomFoods(state.user);
      if (existing) {
        Object.assign(existing, { name, cat, kcal, protein, fat, carb, unit, unitG });
        Store.saveCustomFoods(state.user, foods);
      } else {
        const newFood = {
          id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1e4),
          name, cat, kcal, protein, fat, carb,
          units: [{ name: unit, g: unit === '克' ? 1 : unitG }]
        };
        foods.push(newFood);
        Store.saveCustomFoods(state.user, foods);
      }
      m.close();
      UI.toast(existing ? '已更新自定义食物' : '已添加自定义食物');
      renderMe();
    }
  });
}

/* ================= 修改密码 ================= */
function openChangePassword() {
  const m = UI.modal({
    title: '修改密码',
    bodyHTML: `
      <label class="label">原密码</label><input id="cp-old" class="input" type="password" placeholder="输入原密码">
      <label class="label">新密码</label><input id="cp-new" class="input" type="password" placeholder="至少 6 位">
      <label class="label">确认新密码</label><input id="cp-new2" class="input" type="password" placeholder="再次输入">`,
    dismissable: false,
    actions: [
      { label: '取消', cls: 'btn-secondary', value: 'cancel' },
      { label: '确认修改', cls: 'btn-primary', value: 'save' }
    ],
    onAction(v) {
      if (v !== 'save') return;
      const old = $('#cp-old').value, n1 = $('#cp-new').value, n2 = $('#cp-new2').value;
      if (n1 !== n2) return UI.toast('两次输入的新密码不一致');
      const r = Store.changePassword(state.user, old, n1);
      if (r.ok) { m.close(); UI.toast('密码已修改'); }
      else UI.toast(r.error);
    }
  });
}

/* ================= 数据管理 ================= */
function exportData() {
  const text = Store.exportData();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qinglian-backup-' + Calc.todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  UI.toast('已导出备份文件');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = Store.importData(String(reader.result));
      if (r.ok) { UI.toast('导入成功，即将刷新'); setTimeout(() => location.reload(), 800); }
      else UI.toast(r.error);
    };
    reader.readAsText(file);
    input.value = '';
  };
  input.click();
}

/* ================= 全局事件 ================= */
function handleAction(act) {
  const [name, param] = act.split(':');

  // 数据管理中的危险操作仅测试账号可用（按钮本身也只对 A 显示，这里双保险）
  if (state.user !== 'A' && ['data-clear', 'data-reseed', 'data-reset'].indexOf(name) >= 0) return;

  switch (name) {
    case 'go-food': switchView('food'); break;
    case 'go-exercise': switchView('exercise'); break;
    case 'go-charts': state.chartsPeriod = 7; switchView('charts'); break;
    case 'back-charts': switchView('me'); break;

    case 'food-prev': state.foodDate = Calc.addDays(state.foodDate, -1); renderFood(); break;
    case 'food-next': state.foodDate = Calc.addDays(state.foodDate, 1); renderFood(); break;
    case 'food-today': state.foodDate = Calc.todayStr(); renderFood(); break;
    case 'ex-prev': state.exDate = Calc.addDays(state.exDate, -1); renderExercise(); break;
    case 'ex-next': state.exDate = Calc.addDays(state.exDate, 1); renderExercise(); break;
    case 'ex-today': state.exDate = Calc.todayStr(); renderExercise(); break;
    case 'food-cal': openCalendar('food'); break;
    case 'ex-cal': openCalendar('ex'); break;

    case 'food-cat': state.foodNav = param; renderFood(); break;
    case 'food-nav': state.foodNav = param; renderFood(); break;
    case 'ex-cat': state.exCat = param; renderExercise(); break;
    case 'food-tab': state.foodNav = param; renderFood(); break;
    case 'focus-food': {
      state.foodNav = '全部';
      renderFood();
      const s = document.getElementById('food-search');
      if (s) { s.scrollIntoView({ behavior: 'smooth', block: 'center' }); s.focus(); }
      break;
    }

    case 'pick-food': openFoodModal(param); break;
    case 'del-meal': {
      const [meal, idx] = param.split(':');
      const day = Store.getOrCreateDay(state.user, state.profileId, state.foodDate);
      day.meals[meal].splice(parseInt(idx, 10), 1);
      Store.saveDay(state.user, state.profileId, state.foodDate, day);
      renderFood();
      break;
    }
    case 'clear-day': {
      UI.confirm('确定清空当天的全部饮食与运动记录吗？', { danger: true }).then(ok => {
        if (!ok) return;
        Store.deleteDay(state.user, state.profileId, state.foodDate);
        renderFood();
        UI.toast('已清空当天记录');
      });
      break;
    }
    case 'del-ex': {
      const idx = parseInt(param, 10);
      const day = Store.getOrCreateDay(state.user, state.profileId, state.exDate);
      day.exercises.splice(idx, 1);
      Store.saveDay(state.user, state.profileId, state.exDate, day);
      renderExercise();
      break;
    }

    case 'start-ex': {
      const ex = ExerciseDB.findById(param);
      if (ex) startTimer(ex);
      break;
    }
    case 'load-minus': case 'load-plus': {
      const inp = document.getElementById('t-load');
      if (!inp) break;
      const step = parseFloat(inp.step) || 2.5;
      const cur = parseFloat(inp.value) || 0;
      const next = Math.max(0, Math.round((cur + (name === 'load-plus' ? step : -step)) * 10) / 10);
      inp.value = next;
      if (state.timer) state.timer.loadKg = next;
      break;
    }
    case 'timer-back': onTimerBack(); break;
    case 'timer-pause': pauseTimer(); break;
    case 'timer-resume': resumeTimer(); break;
    case 'timer-end': confirmEndTimer(); break;

    case 'profile-switch': {
      const id = param;
      if (id !== state.profileId) {
        Store.setCurrentProfile(state.user, id);
        state.profileId = id;
        renderHeader();
        switchView('home');
        UI.toast('已切换档案');
      }
      break;
    }
    case 'profile-new': openProfileForm(); break;
    case 'profile-edit': openProfileForm(state.profileId); break;
    case 'profile-delete': {
      UI.confirm('确定删除当前档案及其全部记录吗？', { danger: true, okText: '删除' }).then(ok => {
        if (!ok) return;
        Store.deleteProfile(state.user, state.profileId);
        state.profileId = Store.currentProfileId(state.user);
        renderHeader();
        if (!state.profileId) switchView('me');
        else switchView('home');
        UI.toast('档案已删除');
      });
      break;
    }

    case 'avatar-pick': openAvatarPicker(); break;
    case 'weight-log': openWeightLog(); break;
    case 'food-new': openFoodForm(); break;
    case 'food-edit': openFoodForm(param); break;
    case 'del-food': {
      const foods = Store.getCustomFoods(state.user).filter(f => f.id !== param);
      Store.saveCustomFoods(state.user, foods);
      renderMe();
      UI.toast('已删除自定义食物');
      break;
    }

    case 'chart-period': state.chartsPeriod = parseInt(param, 10); renderCharts(); break;

    case 'data-clear': {
      UI.confirm('清空当前档案的全部饮食、运动与体重记录？', { danger: true, okText: '清空' }).then(ok => {
        if (!ok) return;
        Store.clearProfileRecords(state.user, state.profileId);
        UI.toast('已清空记录');
        if (state.view === 'home') renderHome();
        if (state.view === 'food') renderFood();
        if (state.view === 'exercise') renderExercise();
        if (state.view === 'charts') renderCharts();
      });
      break;
    }
    case 'data-reseed': {
      UI.confirm('将用 7 天演示数据覆盖当前档案的记录，继续？', { danger: true, okText: '覆盖' }).then(ok => {
        if (!ok) return;
        Store.clearProfileRecords(state.user, state.profileId);
        Store.seedDemo(state.user, state.profileId);
        UI.toast('已重新生成演示数据');
        if (state.view === 'home') renderHome();
        if (state.view === 'charts') renderCharts();
      });
      break;
    }
    case 'data-export': exportData(); break;
    case 'data-import': importData(); break;
    case 'data-reset': {
      UI.confirm('确定重置全部数据吗？所有账号、档案与记录都将被清除。', { danger: true, okText: '重置全部' }).then(ok => {
        if (!ok) return;
        Store.resetAll();
        location.reload();
      });
      break;
    }
    case 'change-password': openChangePassword(); break;

    case 'logout': {
      UI.confirm('确定退出登录吗？').then(ok => {
        if (!ok) return;
        Store.logout();
        UI.closeAllModals();
        showAuth();
      });
      break;
    }
    default: break;
  }
}

function bindEvents() {
  // 登录/注册
  $$('[data-auth-tab]').forEach(b => b.addEventListener('click', () => switchAuthTab(b.dataset.authTab)));
  $$('#reg-gender-seg .seg-btn').forEach(b => b.addEventListener('click', () => {
    $$('#reg-gender-seg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
  }));
  $('#auth-form').addEventListener('submit', handleAuthSubmit);

  // 底部导航
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.tab)));

  // 头部档案切换
  $('#profile-chip').addEventListener('click', openProfileSwitch);

  // 全局 data-act 点击（排除弹窗内部，弹窗由 UI.modal 自行处理）
  document.addEventListener('click', e => {
    if (e.target.closest('#modal-root')) return;
    const btn = e.target.closest('[data-act]');
    if (btn) handleAction(btn.dataset.act);
  });

  // 搜索输入（即时过滤，保持焦点）
  let foodTimer = null, exTimer = null;
  document.addEventListener('input', e => {
    if (e.target.id === 'food-search') {
      state.foodQ = e.target.value;
      clearTimeout(foodTimer);
      foodTimer = setTimeout(() => {
        // 输入关键词时统一回到「全部」分类，保证搜索结果覆盖整个食物库
        if (state.foodNav !== '全部') {
          state.foodNav = '全部';
          renderFood();
          const s = document.getElementById('food-search');
          if (s) { s.focus(); const len = s.value.length; try { s.setSelectionRange(len, len); } catch (e2) {} }
        } else {
          renderFoodList();
        }
      }, 120);
    }
    if (e.target.id === 'ex-search') {
      state.exQ = e.target.value;
      clearTimeout(exTimer);
      exTimer = setTimeout(() => renderExerciseList(), 120);
    }
    if (e.target.id === 't-load' && state.timer) {
      state.timer.loadKg = e.target.value;
    }
  });
}

/* ================= 启动 ================= */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  boot();
});

// 供调试
window.App = { switchView, renderHome, rethemeCharts };
})();
