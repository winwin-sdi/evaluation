/* =========================================================
   State
   연도 / 사업부 / 최종등급 필터는 모두 단일 선택 + '전체'
========================================================= */
const state = {
  years: [...new Set(LIST_DATA.map(d => d.year))].sort((a,b)=>b-a),
  divisions: [...new Set(LIST_DATA.map(d => d.division))],
  grades: ['A등급','B등급','C등급','D등급'],
  yearFilter: 'ALL',
  divisionFilter: 'ALL',
  gradeFilter: 'ALL',
  search: '',
  sortKey: 'score',
  sortDir: 'desc',
  page: 1,
  pageSize: 12,
};

const GRADE_COLORS = { A:'#1e7f5c', B:'#2e6fa6', C:'#c98d2e', D:'#b84c3f' };
const SRS_COLORS = {
  Strategic:'#1e7f5c', Preferred:'#3f9b78', Collaborative:'#2e6fa6',
  Adjustable:'#c98d2e', Transactional:'#8a6bb0', Unfavorable:'#b84c3f'
};

let chartGrade, chartSrs;
let datalabelsReady = false;
if (typeof ChartDataLabels !== 'undefined' && typeof Chart !== 'undefined') {
  try { Chart.register(ChartDataLabels); datalabelsReady = true; }
  catch(e){ console.error('datalabels 플러그인 등록 실패:', e); }
}

/* =========================================================
   Helpers
========================================================= */
function gradeLetter(g){ return (g||'').replace('등급',''); }

function filteredData(){
  const q = state.search.trim().toLowerCase();
  return LIST_DATA.filter(d =>
    (state.yearFilter === 'ALL' || d.year === state.yearFilter) &&
    (state.divisionFilter === 'ALL' || d.division === state.divisionFilter) &&
    (state.gradeFilter === 'ALL' || d.finalGrade === state.gradeFilter) &&
    (q === '' || d.partner.toLowerCase().includes(q) || d.vendorCode.toLowerCase().includes(q))
  );
}

function findYoY(vendorCode, division){
  return LIST_DATA.filter(d => d.vendorCode === vendorCode && d.division === division)
                  .sort((a,b)=>a.year-b.year);
}

/* =========================================================
   Filter chips (단일 선택 + 전체)
========================================================= */
const FILTER_GROUPS = [
  { id: 'filter-year',     key: 'yearFilter',     values: state.years,     formatter: y => y + '년' },
  { id: 'filter-division', key: 'divisionFilter', values: state.divisions, formatter: d => d },
  { id: 'filter-grade',    key: 'gradeFilter',    values: state.grades,    formatter: g => g },
];

function renderFilters(){
  FILTER_GROUPS.forEach(group => {
    const el = document.getElementById(group.id);
    el.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = 'chip chip-all' + (state[group.key] === 'ALL' ? ' active' : '');
    allChip.textContent = '전체';
    allChip.addEventListener('click', () => {
      state[group.key] = 'ALL';
      state.page = 1;
      renderFilters();
      renderAll();
    });
    el.appendChild(allChip);

    group.values.forEach(v => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state[group.key] === v ? ' active' : '');
      chip.textContent = group.formatter ? group.formatter(v) : v;
      chip.addEventListener('click', () => {
        state[group.key] = v;
        state.page = 1;
        renderFilters();
        renderAll();
      });
      el.appendChild(chip);
    });
  });
}

function initFilters(){
  renderFilters();
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

  // YoY 평균점수 비교: 연도 필터와 무관하게, 나머지(사업부/등급) 필터 기준으로 두 해를 비교
  let deltaHtml = '<span class="kpi-delta flat">비교 불가</span>';
  if (state.years.length >= 2){
    const y1 = Math.max(...state.years), y0 = Math.min(...state.years);
    const base = LIST_DATA.filter(d =>
      (state.divisionFilter === 'ALL' || d.division === state.divisionFilter) &&
      (state.gradeFilter === 'ALL' || d.finalGrade === state.gradeFilter)
    );
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
  const divisions = state.divisionFilter === 'ALL' ? state.divisions : [state.divisionFilter];
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
      layout: { padding: { top: 20 } },
      scales: {
        x: { stacked:true, grid:{display:false}, ticks:{font:{family:'Pretendard'}} },
        y: { stacked:true, grid:{color:'#eef0f3'}, ticks:{font:{family:'IBM Plex Mono', size:11}} }
      },
      plugins: {
        legend: { position:'bottom', labels:{ font:{family:'Pretendard', size:12}, boxWidth:12, boxHeight:12 } },
        datalabels: datalabelsReady ? {
          color: '#fff',
          font: { family:'IBM Plex Mono', size:12, weight:'600' },
          clamp: true,
          formatter: (value) => value > 0 ? value : ''
        } : false
      }
    }
  });
}

function renderSrsChart(data){
  if (typeof Chart === 'undefined') throw new Error('Chart.js가 로드되지 않았습니다 (CDN 접속 실패 가능성)');
  const srsOrder = ['Strategic','Preferred','Collaborative','Adjustable','Transactional','Unfavorable'];
  const counts = srsOrder.map(s => data.filter(d=>d.srsGrade===s).length);
  const total = counts.reduce((a,b)=>a+b,0);
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
      plugins: {
        legend: { position:'right', labels:{ font:{family:'Pretendard', size:11.5}, boxWidth:10, boxHeight:10 } },
        datalabels: datalabelsReady ? {
          color: '#fff',
          font: { family:'IBM Plex Mono', size:11, weight:'600' },
          clamp: true,
          formatter: (value) => {
            if (!value || !total) return '';
            const pct = Math.round((value/total)*100);
            return pct >= 5 ? value : ''; // 너무 작은 조각은 숫자 생략(겹침 방지)
          }
        } : false
      }
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
let chartDrawerTrend;

function openDrawer(vendorCode, division){
  const rows = findYoY(vendorCode, division);
  if (!rows.length) return;
  const latest = rows[rows.length-1];
  // 대시보드에서 특정 연도를 선택 중이면 그 연도 기준으로, '전체'면 최신 연도 기준으로 하단 상세정보 표시
  const focusRow = (state.yearFilter !== 'ALL' && rows.find(r => r.year === state.yearFilter)) || latest;

  document.getElementById('drawer-title').textContent = focusRow.partner;
  document.getElementById('drawer-vc').textContent = `${vendorCode} · ${division} · ${focusRow.item}`;

  const stampHtml = rows.map((r, i) => {
    const isFocus = r.year === focusRow.year;
    const stamp = `
      <div class="stamp${isFocus ? ' stamp-focus' : ''}" style="border-color:${GRADE_COLORS[gradeLetter(r.finalGrade)]}; color:${GRADE_COLORS[gradeLetter(r.finalGrade)]}">
        <div class="yr">${r.year}년${isFocus ? ' · 선택됨' : ''}</div>
        <div class="grade">${r.finalGrade}</div>
        <div class="sc">${r.score.toFixed(1)}점</div>
      </div>`;
    if (i === rows.length - 1) return stamp;
    const next = rows[i+1];
    const diff = next.score - r.score;
    const dcls = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat';
    const dsign = diff > 0 ? '+' : '';
    const arrow = `
      <div class="stamp-arrow">
        <span class="arrow-icon">→</span>
        <span class="arrow-delta ${dcls}">${dsign}${diff.toFixed(1)}</span>
      </div>`;
    return stamp + arrow;
  }).join('');

  const detailHtml = `
    <ul class="detail-list">
      <li><span>상세등급</span><span>${focusRow.subGrade}</span></li>
      <li><span>성과평가등급</span><span>${focusRow.perfGrade}</span></li>
      <li><span>SRS등급</span><span>${focusRow.srsGrade}</span></li>
      <li><span>평가점수</span><span>${focusRow.score.toFixed(1)}</span></li>
      <li><span>주거래품목</span><span>${focusRow.item}</span></li>
    </ul>
  `;

  const trendHtml = rows.length >= 2 ? `
    <div class="trend-panel">
      <h4>평가점수 추이 (연도별)</h4>
      <div class="trend-chart-wrap"><canvas id="drawer-trend-chart"></canvas></div>
    </div>
  ` : '';

  document.getElementById('drawer-body').innerHTML = `
    <div class="stamp-row">${stampHtml}</div>
    ${trendHtml}
    ${detailHtml}
  `;

  if (rows.length >= 2 && typeof Chart !== 'undefined'){
    const ctx = document.getElementById('drawer-trend-chart');
    if (chartDrawerTrend) chartDrawerTrend.destroy();
    try {
      chartDrawerTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: rows.map(r => r.year + '년'),
          datasets: [{
            data: rows.map(r => r.score),
            borderColor: '#1c3c58',
            backgroundColor: '#1c3c58',
            pointBackgroundColor: rows.map(r => GRADE_COLORS[gradeLetter(r.finalGrade)]),
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 7,
            borderWidth: 2,
            tension: 0.25,
            fill: false
          }]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          layout: { padding: { top: 26, right: 16, left: 4, bottom: 4 } },
          plugins: {
            legend: { display:false },
            datalabels: datalabelsReady ? {
              align:'top', anchor:'end', offset:8, clamp:true,
              color:'#1c3c58',
              font:{ family:'IBM Plex Mono', size:11, weight:'700' },
              formatter: v => v.toFixed(1)
            } : false
          },
          scales: {
            x: { grid:{display:false}, ticks:{ font:{family:'IBM Plex Mono', size:11.5, weight:'600'}, color:'#1b2733' } },
            y: {
              display: false,
              suggestedMin: Math.min(...rows.map(r=>r.score)) - 4,
              suggestedMax: Math.max(...rows.map(r=>r.score)) + 6
            }
          }
        }
      });
    } catch(e){ console.error('추이 차트 렌더링 실패:', e); }
  }

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

  let thead = '<thead><tr><th class="matrix-corner">관계사별<br>평가영역</th>' + categories.map(c=>`<th>${c}</th>`).join('') + '</tr></thead>';
  let tbody = '<tbody>' + companies.map(co => {
    const cells = categories.map(cat => {
      const items = (CRITERIA_DATA[co] && CRITERIA_DATA[co][cat]) || [];
      if (!items.length) return '<td class="crit-empty">—</td>';
      return `<td><span class="crit-count">${items.length}</span><div class="crit-items">${items.map(it=>`<span class="crit-item">${it.trim()}</span>`).join('')}</div></td>`;
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
