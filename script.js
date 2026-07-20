/* =========================================================
   State
========================================================= */
const state = {
  years: [...new Set(LIST_DATA.map(d => d.year))].sort((a,b)=>b-a),
  divisions: [...new Set(LIST_DATA.map(d => d.division))],
  grades: ['A등급','B등급','C등급','D등급'],
  activeYears: new Set(),
  activeDivisions: new Set(),
  activeGrades: new Set(),
  search: '',
  sortKey: 'score',
  sortDir: 'desc',
  page: 1,
  pageSize: 12,
};
state.years.forEach(y => state.activeYears.add(y));
state.divisions.forEach(d => state.activeDivisions.add(d));
state.grades.forEach(g => state.activeGrades.add(g));

const GRADE_COLORS = { A:'#1e7f5c', B:'#2e6fa6', C:'#c98d2e', D:'#b84c3f' };
const SRS_COLORS = {
  Strategic:'#1e7f5c', Preferred:'#3f9b78', Collaborative:'#2e6fa6',
  Adjustable:'#c98d2e', Transactional:'#8a6bb0', Unfavorable:'#b84c3f'
};

let chartGrade, chartSrs;

/* =========================================================
   Helpers
========================================================= */
function gradeLetter(g){ return (g||'').replace('등급',''); }

function filteredData(){
  const q = state.search.trim().toLowerCase();
  return LIST_DATA.filter(d =>
    state.activeYears.has(d.year) &&
    state.activeDivisions.has(d.division) &&
    state.activeGrades.has(d.finalGrade) &&
    (q === '' || d.partner.toLowerCase().includes(q) || d.vendorCode.toLowerCase().includes(q))
  );
}

function findYoY(vendorCode, division){
  return LIST_DATA.filter(d => d.vendorCode === vendorCode && d.division === division)
                  .sort((a,b)=>a.year-b.year);
}

/* =========================================================
   Filter chips
========================================================= */
const chipRegistry = []; // { containerId, values, activeSet, allEl, valueEls: Map }

function syncChipGroup(entry){
  const isAll = entry.activeSet.size === entry.values.length;
  entry.allEl.classList.toggle('active', isAll);
  // '전체' 상태에서는 개별 칩은 강조하지 않음 -> 무엇을 선택했는지 한눈에 구분되게
  entry.valueEls.forEach((el, v) => el.classList.toggle('active', !isAll && entry.activeSet.has(v)));
}

function syncAllChipGroups(){ chipRegistry.forEach(syncChipGroup); }

function renderChips(containerId, values, activeSet, formatter, onToggle){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const valueEls = new Map();

  // "전체" 칩: 모든 값이 선택돼 있을 때만 활성 표시
  const allChip = document.createElement('button');
  allChip.textContent = '전체';
  allChip.className = 'chip chip-all';
  allChip.addEventListener('click', () => {
    activeSet.clear();
    values.forEach(v => activeSet.add(v));
    state.page = 1;
    syncAllChipGroups();
    onToggle();
  });
  el.appendChild(allChip);

  values.forEach(v => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = formatter ? formatter(v) : v;
    chip.addEventListener('click', () => {
      if (activeSet.has(v)) {
        // 마지막 하나 남았을 땐 끄지 않고 '전체'로 되돌림 (필터가 전부 사라지는 상태 방지)
        if (activeSet.size > 1) {
          activeSet.delete(v);
        } else {
          activeSet.clear();
          values.forEach(x => activeSet.add(x));
        }
      } else {
        // 지금까지 '전체' 상태였다면, 이 클릭은 '이것만 보기'로 동작
        if (activeSet.size === values.length) {
          activeSet.clear();
        }
        activeSet.add(v);
      }
      state.page = 1;
      syncAllChipGroups();
      onToggle();
    });
    el.appendChild(chip);
    valueEls.set(v, chip);
  });

  const entry = { values, activeSet, allEl: allChip, valueEls };
  chipRegistry.push(entry);
  syncChipGroup(entry);
}

function initFilters(){
  renderChips('filter-year', state.years, state.activeYears, y => y + '년', renderAll);
  renderChips('filter-division', state.divisions, state.activeDivisions, d => d, renderAll);
  renderChips('filter-grade', state.grades, state.activeGrades, g => g, renderAll);

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderAll();
  });
}

/* =========================================================
   KPI cards
========================================================= */
function renderKPI(data){
  const el = document.getElementById('kpi-row');
  const count = data.length;
  const avg = count ? (data.reduce((s,d)=>s+d.score,0)/count) : 0;

  const gradeCounts = {A:0,B:0,C:0,D:0};
  data.forEach(d => gradeCounts[gradeLetter(d.finalGrade)]++);
  const topShare = count ? Math.round((gradeCounts.A/count)*100) : 0;

  // YoY avg score delta (only when both years present in current division/grade filter, ignoring year filter)
  let deltaHtml = '<span class="kpi-delta flat">비교 불가</span>';
  if (state.years.length >= 2){
    const y1 = Math.max(...state.years), y0 = Math.min(...state.years);
    const base = LIST_DATA.filter(d => state.activeDivisions.has(d.division) && state.activeGrades.has(d.finalGrade));
    const s1 = base.filter(d=>d.year===y1), s0 = base.filter(d=>d.year===y0);
    if (s1.length && s0.length){
      const a1 = s1.reduce((s,d)=>s+d.score,0)/s1.length;
      const a0 = s0.reduce((s,d)=>s+d.score,0)/s0.length;
      const diff = a1 - a0;
      const cls = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat';
      const sign = diff > 0 ? '+' : '';
      deltaHtml = `<span class="kpi-delta ${cls}">${sign}${diff.toFixed(1)}p vs ${y0}년</span>`;
    }
  }

  el.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">파트너사 수</div>
      <div class="kpi-value">${count}<span class="unit">개사</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">평균 평가점수</div>
      <div class="kpi-value">${avg.toFixed(1)}</div>
      ${deltaHtml}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">A등급 비중</div>
      <div class="kpi-value">${topShare}<span class="unit">%</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">D등급(개선필요)</div>
      <div class="kpi-value" style="color:${gradeCounts.D>0 ? 'var(--grade-d)' : 'var(--navy)'}">${gradeCounts.D}<span class="unit">개사</span></div>
    </div>
  `;
}

/* =========================================================
   Charts
========================================================= */
function renderGradeChart(data){
  if (typeof Chart === 'undefined') throw new Error('Chart.js가 로드되지 않았습니다 (CDN 접속 실패 가능성)');
  const divisions = state.divisions.filter(d => state.activeDivisions.has(d));
  const datasets = state.grades.map(g => ({
    label: g,
    backgroundColor: GRADE_COLORS[gradeLetter(g)],
    data: divisions.map(dv => data.filter(d => d.division===dv && d.finalGrade===g).length)
  }));
  document.getElementById('grade-chart-count').textContent = data.length + '건';

  const ctx = document.getElementById('chart-grade');
  if (chartGrade) chartGrade.destroy();
  chartGrade = new Chart(ctx, {
    type: 'bar',
    data: { labels: divisions, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { stacked:true, grid:{display:false}, ticks:{font:{family:'Pretendard'}} },
        y: { stacked:true, grid:{color:'#eef0f3'}, ticks:{font:{family:'IBM Plex Mono', size:11}} }
      },
      plugins: { legend: { position:'bottom', labels:{ font:{family:'Pretendard', size:12}, boxWidth:12, boxHeight:12 } } }
    }
  });
}

function renderSrsChart(data){
  if (typeof Chart === 'undefined') throw new Error('Chart.js가 로드되지 않았습니다 (CDN 접속 실패 가능성)');
  const srsOrder = ['Strategic','Preferred','Collaborative','Adjustable','Transactional','Unfavorable'];
  const counts = srsOrder.map(s => data.filter(d=>d.srsGrade===s).length);
  const ctx = document.getElementById('chart-srs');
  if (chartSrs) chartSrs.destroy();
  chartSrs = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: srsOrder,
      datasets: [{ data: counts, backgroundColor: srsOrder.map(s=>SRS_COLORS[s]), borderWidth:2, borderColor:'#fff' }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      cutout:'62%',
      plugins: { legend: { position:'right', labels:{ font:{family:'Pretendard', size:11.5}, boxWidth:10, boxHeight:10 } } }
    }
  });
}

/* =========================================================
   Table
========================================================= */
function renderTable(data){
  const key = state.sortKey, dir = state.sortDir;
  const sorted = [...data].sort((a,b) => {
    let av = a[key], bv = b[key];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return dir==='asc' ? -1 : 1;
    if (av > bv) return dir==='asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page-1)*state.pageSize;
  const pageRows = sorted.slice(start, start+state.pageSize);

  const tbody = document.getElementById('table-body');
  if (pageRows.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">조건에 맞는 파트너사가 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(d => `
      <tr data-vendor="${d.vendorCode}" data-division="${d.division}">
        <td class="partner-name">${d.partner}</td>
        <td class="mono">${d.vendorCode}</td>
        <td>${d.division}</td>
        <td><span class="item-tag">${d.item}</span></td>
        <td><span class="badge badge-${gradeLetter(d.finalGrade)}">${d.finalGrade}</span></td>
        <td>${d.subGrade}</td>
        <td>${d.perfGrade}</td>
        <td class="score-cell">${d.score.toFixed(1)}</td>
        <td>${d.srsGrade}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => openDrawer(tr.dataset.vendor, tr.dataset.division));
    });
  }

  document.getElementById('table-summary').textContent = `총 ${sorted.length}건 · ${state.page}/${totalPages} 페이지`;

  const pager = document.getElementById('pager');
  pager.innerHTML = `
    <button id="prev-page" ${state.page<=1?'disabled':''}>이전</button>
    <span>${state.page} / ${totalPages}</span>
    <button id="next-page" ${state.page>=totalPages?'disabled':''}>다음</button>
  `;
  document.getElementById('prev-page').addEventListener('click', () => { state.page--; renderAll(); });
  document.getElementById('next-page').addEventListener('click', () => { state.page++; renderAll(); });

  document.querySelectorAll('th[data-key]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.key === key);
    th.dataset.dir = dir==='asc' ? '▲' : '▼';
  });
}

document.querySelectorAll('th[data-key]').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.key;
    if (state.sortKey === k){
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = k;
      state.sortDir = k === 'score' ? 'desc' : 'asc';
    }
    renderAll();
  });
});

/* =========================================================
   Detail drawer
========================================================= */
function openDrawer(vendorCode, division){
  const rows = findYoY(vendorCode, division);
  if (!rows.length) return;
  const latest = rows[rows.length-1];

  document.getElementById('drawer-title').textContent = latest.partner;
  document.getElementById('drawer-vc').textContent = `${vendorCode} · ${division} · ${latest.item}`;

  const stampHtml = rows.map(r => `
    <div class="stamp" style="border-color:${GRADE_COLORS[gradeLetter(r.finalGrade)]}; color:${GRADE_COLORS[gradeLetter(r.finalGrade)]}">
      <div class="yr">${r.year}년</div>
      <div class="grade">${r.finalGrade}</div>
      <div class="sc">${r.score.toFixed(1)}점</div>
    </div>
  `).join('');

  const detailHtml = latest ? `
    <ul class="detail-list">
      <li><span>상세등급</span><span>${latest.subGrade}</span></li>
      <li><span>성과평가등급</span><span>${latest.perfGrade}</span></li>
      <li><span>SRS등급</span><span>${latest.srsGrade}</span></li>
      <li><span>평가점수</span><span>${latest.score.toFixed(1)}</span></li>
      <li><span>주거래품목</span><span>${latest.item}</span></li>
    </ul>
  ` : '';

  document.getElementById('drawer-body').innerHTML = `
    <div class="stamp-row">${stampHtml}</div>
    ${detailHtml}
  `;

  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer(){
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('overlay').addEventListener('click', closeDrawer);

/* =========================================================
   Criteria matrix (Tab 2)
========================================================= */
function renderCriteriaMatrix(){
  const companies = Object.keys(CRITERIA_DATA); // 삼성전자, 삼성전기, 삼성SDI
  const categories = ['품질','기술','원가','납기','협력도','재무','환경'];
  const table = document.getElementById('criteria-matrix');

  let thead = '<thead><tr><th>관계사 \\ 평가영역</th>' + categories.map(c=>`<th>${c}</th>`).join('') + '</tr></thead>';
  let tbody = '<tbody>' + companies.map(co => {
    const cells = categories.map(cat => {
      const items = (CRITERIA_DATA[co] && CRITERIA_DATA[co][cat]) || [];
      if (!items.length) return '<td style="color:#c3cad2;text-align:center;">—</td>';
      return `<td><span class="crit-count">${items.length}</span>${items.map(it=>`<span class="crit-item">· ${it.trim()}</span>`).join('')}</td>`;
    }).join('');
    return `<tr><th>${co}</th>${cells}</tr>`;
  }).join('') + '</tbody>';

  table.innerHTML = thead + tbody;
}

/* =========================================================
   Tabs
========================================================= */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  });
});

/* =========================================================
   Master render
========================================================= */
function renderAll(){
  const data = filteredData();
  renderKPI(data);

  // 차트 라이브러리 로딩 실패 등으로 예외가 나도 테이블/KPI는 정상 표시되도록 분리
  try { renderGradeChart(data); }
  catch(e){ console.error('등급 분포 차트 렌더링 실패:', e); showChartError('chart-grade'); }

  try { renderSrsChart(data); }
  catch(e){ console.error('SRS 분포 차트 렌더링 실패:', e); showChartError('chart-srs'); }

  renderTable(data);
}

function showChartError(canvasId){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.parentElement;
  wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-faint);font-size:12.5px;">차트를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.</div>';
}

initFilters();
renderCriteriaMatrix();
renderAll();
