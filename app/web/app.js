// 前端逻辑：画像 + 跨次历史都存 localStorage（后端无状态）；请求时把画像 + 近几天历史带上。
'use strict';

const LS_PROFILE = 'twcs.profile';
const LS_HISTORY = 'twcs.history'; // 跨次记忆：最近的推荐/输入记录

const $ = (id) => document.getElementById(id);

// ---------- localStorage ----------
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(LS_PROFILE) || '{}'); } catch { return {}; }
}
function saveProfile(p) { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); } catch { return []; }
}
function pushHistory(entry) {
  const h = loadHistory();
  h.push(entry);
  // 只留最近 14 条，避免无限增长
  localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(-14)));
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- 画像弹层 ----------
function openProfile() {
  const p = loadProfile();
  $('pGender').value = p.gender || '';
  $('pAge').value = p.age || '';
  $('pHeight').value = p.height || '';
  $('pWeight').value = p.weight || '';
  $('profileMask').classList.remove('hidden');
}
function closeProfile() { $('profileMask').classList.add('hidden'); }

$('profileBtn').onclick = openProfile;
$('pSkip').onclick = closeProfile;
$('pSave').onclick = () => {
  const p = {
    gender: $('pGender').value || '',
    age: Number($('pAge').value) || '',
    height: Number($('pHeight').value) || '',
    weight: Number($('pWeight').value) || '',
  };
  saveProfile(p);
  closeProfile();
};

// ---------- 核心：请求推荐 ----------
let currentInput = null;   // 本轮输入（换一个复用）
let sessionExclude = [];   // 本轮已被拒绝的菜，避免重复

function setLoading(on) {
  const btn = $('askBtn');
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

async function fetchRecommend(input) {
  const resp = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw new Error('服务出错 ' + resp.status);
  return resp.json();
}

function renderResult(data, meta) {
  $('dish').textContent = data.dish;
  $('reason').textContent = data.reason;
  $('buy').textContent = data.buy || '外卖或附近餐厅都能点到。';
  $('cook').textContent = data.cook || '做法简单，搜菜名即可。';
  $('howto').classList.add('hidden');
  $('inputCard').classList.add('hidden');
  $('resultCard').classList.remove('hidden');
  $('hint').textContent = meta && meta.source === 'mock' ? '（演示数据 · 配置模型 key 后为真实推荐）'
    : meta && meta.source === 'fallback' ? '（模型暂时不稳，先给你一个稳妥选择）' : '';
}

async function ask(isAgain) {
  const profile = loadProfile();
  if (!isAgain) {
    const meals = $('meals').value.trim();
    if (!meals) { $('hint').textContent = '先说说今天吃了啥吧～'; return; }
    currentInput = { profile, todayMeals: meals, mood: $('mood').value.trim(), history: loadHistory() };
    sessionExclude = [];
  }
  const input = Object.assign({}, currentInput, { profile, exclude: sessionExclude.slice() });

  setLoading(true);
  $('hint').textContent = '';
  try {
    const res = await fetchRecommend(input);
    const data = res.data;
    renderResult(data, res.meta);
    // 跨次记忆：记录这次输入 + 推荐结果
    pushHistory({ date: todayStr(), meals: `${currentInput.todayMeals}${currentInput.mood ? '（' + currentInput.mood + '）' : ''}；晚餐推荐：${data.dish}` });
    // 记住本轮已出现的菜，「换一个」时避开
    if (!sessionExclude.includes(data.dish)) sessionExclude.push(data.dish);
  } catch (e) {
    $('hint').textContent = '网络或服务异常，稍后再试。';
  } finally {
    setLoading(false);
  }
}

// ---------- 交互绑定 ----------
$('askBtn').onclick = () => ask(false);
$('rejectBtn').onclick = () => ask(true); // 不想吃 → 换一个（带 exclude 重调）
$('wantBtn').onclick = () => $('howto').classList.toggle('hidden'); // 想吃 → 展开去哪买/怎么做
$('againBtn').onclick = () => {
  $('resultCard').classList.add('hidden');
  $('inputCard').classList.remove('hidden');
  $('hint').textContent = '';
};
$('meals').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask(false);
});

// 首次访问引导填画像
window.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem(LS_PROFILE)) openProfile();
});
