/* =========================================================
 * 轻练 · 数据持久化层（store.js）
 * 账号 / 档案 / 饮食运动记录 / 体重记录 / 自定义食物
 * 全部存储于 localStorage，JSON 结构带版本号，账号与档案数据分离
 * ========================================================= */
'use strict';

const Store = (() => {
  const KEYS = {
    accounts: 'ql_accounts',     // {version, accounts:[{username,password}]}
    session:  'ql_session',      // {username}
    users:    'ql_users',        // {version, users:{username:{profiles:[],customFoods:[]}}}
    records:  'ql_records',      // {version, users:{username:{profileId:{days:{},weights:{}}}}}
  loads:    'ql_loads',        // {version, users:{username:{exerciseId:kg}}}  力量训练上次重量
    current:  'ql_current_profile' // 当前选中档案：ql_current_profile_<username> = profileId
  };
  const VERSION = 1;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const j = JSON.parse(raw);
      return j && typeof j === 'object' ? j : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, obj) {
    obj.version = VERSION;
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* 存储满时忽略 */ }
  }

  /* ---------- 账号 ---------- */
  function getAccounts() { return read(KEYS.accounts, { accounts: [] }).accounts; }
  function saveAccounts(list) { write(KEYS.accounts, { accounts: list }); }
  function ensureTestAccount() {
    const list = getAccounts();
    if (!list.find(a => a.username === 'A')) {
      list.push({ username: 'A', password: 'AAAAAA' });
      saveAccounts(list);
    }
  }

  /** 登录：与本地账号比对，成功写会话 */
  function login(username, password) {
    const acc = getAccounts().find(a => a.username === username && a.password === password);
    if (!acc) return { ok: false, error: '用户名或密码不正确' };
    localStorage.setItem(KEYS.session, JSON.stringify({ username }));
    return { ok: true };
  }

  /** 注册：用户名唯一 + 密码≥6位 + 两次一致；成功自动登录并创建默认档案（使用注册时填写的资料） */
  function register(username, password, confirm, info) {
    username = (username || '').trim();
    if (!username) return { ok: false, error: '请输入用户名' };
    if (username.length > 20) return { ok: false, error: '用户名最长 20 个字符' };
    if (getAccounts().find(a => a.username === username)) return { ok: false, error: '该用户名已被注册' };
    if (!password || password.length < 6) return { ok: false, error: '密码至少 6 位' };
    if (password !== confirm) return { ok: false, error: '两次输入的密码不一致' };

    info = info || {};
    const name = (info.name || '').trim();
    const height = parseFloat(info.height);
    const weight = parseFloat(info.weight);
    if (!name) return { ok: false, error: '请输入昵称' };
    if (isNaN(height) || height < 100 || height > 250) return { ok: false, error: '身高需在 100-250 cm 之间' };
    if (isNaN(weight) || weight < 30 || weight > 300) return { ok: false, error: '体重需在 30-300 kg 之间' };

    const list = getAccounts();
    list.push({ username, password });
    saveAccounts(list);

    // 创建默认档案（昵称取注册时填写，用户可稍后在「我的」中编辑）
    const users = getUsers();
    const bmr = parseFloat(info.bmr) > 0 ? parseFloat(info.bmr) : 0;
    users[username] = {
      profiles: [makeProfile(name, info.gender === 'female' ? 'female' : 'male',
        parseInt(info.age, 10) > 0 ? parseInt(info.age, 10) : 25, height, weight, 'maintain', 'light', bmr)],
      customFoods: [], avatar: ''
    };
    saveUsers(users);

    localStorage.setItem(KEYS.session, JSON.stringify({ username }));
    return { ok: true };
  }

  function changePassword(username, oldPwd, newPwd) {
    const list = getAccounts();
    const acc = list.find(a => a.username === username);
    if (!acc) return { ok: false, error: '账号不存在' };
    if (acc.password !== oldPwd) return { ok: false, error: '原密码不正确' };
    if (!newPwd || newPwd.length < 6) return { ok: false, error: '新密码至少 6 位' };
    acc.password = newPwd;
    saveAccounts(list);
    return { ok: true };
  }

  function logout() { localStorage.removeItem(KEYS.session); }
  function currentUser() {
    try {
      const j = JSON.parse(localStorage.getItem(KEYS.session) || 'null');
      return (j && j.username) ? j.username : null;
    } catch (e) { return null; }
  }

  /* ---------- 档案 ---------- */
  function makeProfile(name, gender, age, height, weight, goal, activity, bmr) {
    return { id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1e4), name, gender, age, height, weight, goal, activity, bmr: bmr || 0 };
  }
  function getUsers() { return read(KEYS.users, { users: {} }).users; }
  function saveUsers(users) { write(KEYS.users, { users }); }
  function getProfiles(username) {
    const u = getUsers()[username];
    return (u && u.profiles) ? u.profiles : [];
  }
  function getProfile(username, id) { return getProfiles(username).find(p => p.id === id) || null; }
  function saveProfile(username, profile) {
    const users = getUsers();
    const u = users[username] || (users[username] = { profiles: [], customFoods: [] });
    const i = u.profiles.findIndex(p => p.id === profile.id);
    if (i >= 0) u.profiles[i] = profile; else u.profiles.push(profile);
    saveUsers(users);
  }
  function deleteProfile(username, id) {
    const users = getUsers();
    const u = users[username];
    if (!u) return;
    u.profiles = u.profiles.filter(p => p.id !== id);
    saveUsers(users);
    removeProfileRecords(username, id);
    if (currentProfileId(username) === id) localStorage.removeItem(KEYS.current + '_' + username);
  }

  function currentProfileId(username) {
    const saved = localStorage.getItem(KEYS.current + '_' + username);
    const profiles = getProfiles(username);
    if (saved && profiles.find(p => p.id === saved)) return saved;
    return profiles.length ? profiles[0].id : null;
  }
  function setCurrentProfile(username, id) { localStorage.setItem(KEYS.current + '_' + username, id); }

  /* ---------- 记录（按 账号 → 档案 → 日期） ---------- */
  function getRecords() { return read(KEYS.records, { users: {} }).users; }
  function saveRecords(rec) { write(KEYS.records, { users: rec }); }

  function getProfileRecords(username, profileId) {
    const rec = getRecords();
    return (rec[username] && rec[username][profileId]) || null;
  }
  function ensureProfileRecords(username, profileId) {
    const rec = getRecords();
    rec[username] = rec[username] || {};
    rec[username][profileId] = rec[username][profileId] || { days: {}, weights: {} };
    saveRecords(rec);
    return rec[username][profileId];
  }

  function getDay(username, profileId, date) {
    const pr = getProfileRecords(username, profileId);
    return (pr && pr.days[date]) || null;
  }
  /** 获取某日记录，不存在则创建空记录 */
  function getOrCreateDay(username, profileId, date) {
    const rec = getRecords();
    rec[username] = rec[username] || {};
    const pr = rec[username][profileId] = rec[username][profileId] || { days: {}, weights: {} };
    if (!pr.days[date]) pr.days[date] = { meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, exercises: [] };
    saveRecords(rec);
    return pr.days[date];
  }
  function saveDay(username, profileId, date, day) {
    const rec = getRecords();
    rec[username] = rec[username] || {};
    const pr = rec[username][profileId] = rec[username][profileId] || { days: {}, weights: {} };
    pr.days[date] = day;
    saveRecords(rec);
  }
  function deleteDay(username, profileId, date) {
    const rec = getRecords();
    if (rec[username] && rec[username][profileId] && rec[username][profileId].days[date]) {
      delete rec[username][profileId].days[date];
      saveRecords(rec);
    }
  }
  function removeProfileRecords(username, profileId) {
    const rec = getRecords();
    if (rec[username]) {
      delete rec[username][profileId];
      if (!Object.keys(rec[username]).length) delete rec[username];
      saveRecords(rec);
    }
  }
  function clearProfileRecords(username, profileId) {
    const rec = getRecords();
    if (rec[username]) { delete rec[username][profileId]; saveRecords(rec); }
  }

  /* ---------- 体重记录 ---------- */
  function getWeights(username, profileId) {
    const pr = getProfileRecords(username, profileId);
    return pr ? (pr.weights || {}) : {};
  }
  /** 记录体重并同步更新档案当前体重（档案体重 = 最新一次记录） */
  function logWeight(username, profileId, date, kg) {
    const rec = getRecords();
    rec[username] = rec[username] || {};
    const pr = rec[username][profileId] = rec[username][profileId] || { days: {}, weights: {} };
    pr.weights[date] = kg;
    saveRecords(rec);
    const p = getProfile(username, profileId);
    if (p) { p.weight = kg; saveProfile(username, p); }
  }
  function removeWeight(username, profileId, date) {
    const rec = getRecords();
    if (rec[username] && rec[username][profileId] && rec[username][profileId].weights[date]) {
      delete rec[username][profileId].weights[date];
      saveRecords(rec);
    }
  }

  /* ---------- 头像（按账号存储，dataURL） ---------- */
  function getAvatar(username) {
    const u = getUsers()[username];
    return (u && u.avatar) || '';
  }
  function setAvatar(username, dataUrl) {
    const users = getUsers();
    const u = users[username] || (users[username] = { profiles: [], customFoods: [], avatar: '' });
    u.avatar = dataUrl;
    saveUsers(users);
  }

  /* ---------- 自定义食物（按账号存储） ---------- */
  /** 力量训练「上次使用重量」记忆（按运动 id） */
  function getLastLoad(username, exerciseId) {
    const store = read(KEYS.loads, { users: {} });
    const u = store.users && store.users[username];
    return (u && u[exerciseId]) || 0;
  }
  function setLastLoad(username, exerciseId, kg) {
    const store = read(KEYS.loads, { users: {} });
    if (!store.users) store.users = {};
    if (!store.users[username]) store.users[username] = {};
    store.users[username][exerciseId] = kg;
    store.version = VERSION;
    localStorage.setItem(KEYS.loads, JSON.stringify(store));
  }

    function getCustomFoods(username) {
    const u = getUsers()[username];
    return (u && u.customFoods) || [];
  }
  function saveCustomFoods(username, foods) {
    const users = getUsers();
    const u = users[username] || (users[username] = { profiles: [], customFoods: [] });
    u.customFoods = foods;
    saveUsers(users);
  }

  /* ---------- 种子数据 ---------- */
  function defaultProfileA() {
    // 按需求：男，25 岁，175cm，70kg，目标减脂，活动水平轻度
    return { id: 'p_demo', name: '自己', gender: 'male', age: 25, height: 175, weight: 70, goal: 'cut', activity: 'light' };
  }

  /** 首次打开：创建测试账号 A + 档案 + 7 天演示数据（仅执行一次） */
  function ensureSeeded() {
    ensureTestAccount();
    const users = getUsers();
    if (!users['A']) {
      users['A'] = { profiles: [defaultProfileA()], customFoods: [] };
      saveUsers(users);
    }
    const rec = getRecords();
    const pid = currentProfileId('A');
    if (!rec['A'] || !pid || !rec['A'][pid]) {
      seedDemo('A', pid);
    }
  }

  /** 为账号 A 的档案生成最近 7 天演示数据（含今天） */
  function seedDemo(username, profileId) {
    const rec = getRecords();
    rec[username] = rec[username] || {};
    const pr = rec[username][profileId] = { days: {}, weights: {} };
    const foods = FoodDB.all(username);
    const byName = n => foods.find(f => f.name === n);
    const today = Calc.todayStr();

    for (let i = 6; i >= 0; i--) {
      const date = Calc.addDays(today, -i);
      const day = { meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, exercises: [] };
      const add = (meal, name, grams) => {
        const f = byName(name);
        if (!f) return;
        const s = Calc.foodStats(f, grams);
        day.meals[meal].push({
          foodId: f.id, name: f.name, grams: s.grams, unit: '克',
          kcal: s.kcal, protein: s.protein, fat: s.fat, carb: s.carb
        });
      };
      add('breakfast', '燕麦片', 40);
      add('breakfast', '牛奶(全脂)', 250);
      add('breakfast', '鸡蛋', 50);
      add('lunch', '鸡胸肉', 150);
      add('lunch', '米饭(熟)', 150);
      add('lunch', '西兰花', 150);
      add('snack', '苹果', 200);
      add('dinner', '三文鱼', 150);
      add('dinner', '红薯', 200);
      add('dinner', '菠菜', 150);

      const dow = new Date(date + 'T00:00:00').getDay();
      if (dow === 1 || dow === 3 || dow === 5) {
        day.exercises.push(makeExercise('力量训练(一般)', 40, 70));
      }
      if (dow !== 6 && dow !== 0) {
        day.exercises.push(makeExercise('慢跑', 30, 70));
      } else {
        day.exercises.push(makeExercise('快走(5km/h)', 45, 70));
      }
      pr.days[date] = day;
      pr.weights[date] = Calc.round1(70.2 - i * 0.13);
    }
    saveRecords(rec);
  }

  /** 生成一条运动记录快照 */
  function makeExercise(name, minutes, weightKg) {
    const ex = ExerciseDB.findById(name) || ExerciseDB.all().find(e => e.name === name);
    const met = ex ? ex.met : 5;
    const hours = minutes / 60;
    return {
      exerciseId: ex ? ex.id : ('e_' + name),
      name, met, weightKg,
      totalMinutes: minutes, activeMinutes: minutes, restMinutes: 0, sets: 1,
      kcal: Calc.exerciseKcal(met, weightKg, hours),
      completedAt: Calc.fmtTime(new Date())
    };
  }

  /* ---------- 导入 / 导出 / 重置 ---------- */
  function exportData() {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      accounts: read(KEYS.accounts, {}),
      users: read(KEYS.users, {}),
      records: read(KEYS.records, {})
    }, null, 2);
  }
  function importData(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, error: '文件不是有效的 JSON' }; }
    if (!j || !j.users || !j.records) return { ok: false, error: '不是轻练的备份文件' };
    localStorage.setItem(KEYS.accounts, JSON.stringify(j.accounts && j.accounts.accounts ? j.accounts : { accounts: [] }));
    localStorage.setItem(KEYS.users, JSON.stringify(j.users));
    localStorage.setItem(KEYS.records, JSON.stringify(j.records));
    return { ok: true };
  }
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    const suffixes = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(KEYS.current + '_') === 0) suffixes.push(key);
    }
    suffixes.forEach(k => localStorage.removeItem(k));
  }

  return {
    KEYS, VERSION,
    getAccounts, saveAccounts, ensureTestAccount, login, register, changePassword, logout, currentUser,
    makeProfile, getUsers, saveUsers, getProfiles, getProfile, saveProfile, deleteProfile,
    currentProfileId, setCurrentProfile,
    getDay, getOrCreateDay, saveDay, deleteDay, clearProfileRecords, removeProfileRecords,
  getLastLoad, setLastLoad,
    getWeights, logWeight, removeWeight,
    getCustomFoods, saveCustomFoods,
    getAvatar, setAvatar,
    ensureSeeded, seedDemo, makeExercise,
    exportData, importData, resetAll
  };
})();
