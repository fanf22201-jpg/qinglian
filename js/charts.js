/* =========================================================
 * 轻练 · 图表模块（charts.js）
 * 基于本地打包的 Chart.js（离线可用），随系统深浅模式自动换肤
 * ========================================================= */
'use strict';

const Charts = (() => {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js 未加载');
    return { available: false, instances: {}, destroy: () => {}, render: () => {} };
  }

  const instances = {};

  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif';

  /** 随系统深浅模式返回图表配色 */
  function palette() {
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return {
      blue: dark ? '#409CFF' : '#0071E3',
      blueSoft: dark ? 'rgba(64,156,255,0.85)' : 'rgba(10,132,255,0.85)',
      purple: dark ? '#BF5AF2' : '#AF52DE',
      green: dark ? '#30D158' : '#34C759',
      orange: dark ? '#FF9F0A' : '#FF9500',
      red: dark ? '#FF453A' : '#FF3B30',
      gray: dark ? 'rgba(235,235,245,0.55)' : 'rgba(0,0,0,0.45)',
      grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      point: dark ? '#1C1C1E' : '#FFFFFF'
    };
  }

  function baseOpts(extra) {
    const C = palette();
    return Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { family: FONT, size: 12 },
            color: C.gray,
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(28,28,30,0.92)',
          titleFont: { family: FONT, size: 12 },
          bodyFont: { family: FONT, size: 12 },
          padding: 10,
          cornerRadius: 12,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: C.gray, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { grid: { color: C.grid }, ticks: { color: C.gray, font: { family: FONT, size: 11 } }, beginAtZero: true }
      }
    }, extra || {});
  }

  function makeChart(id, canvas, config) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
    if (!canvas) return;
    instances[id] = new Chart(canvas, config);
  }

  /** 每日摄入热量柱状图（叠加目标线） */
  function intakeBar(canvas, labels, intake, target) {
    const C = palette();
    const grad = canvas.getContext('2d').createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, C.blueSoft);
    grad.addColorStop(1, C.blue + '88');
    makeChart('intake', canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '摄入(kcal)', data: intake, backgroundColor: grad,
            borderRadius: 8, maxBarThickness: 26
          },
          {
            label: '目标(kcal)', data: labels.map(() => target), type: 'line',
            borderColor: C.orange, borderWidth: 2, borderDash: [6, 5],
            pointRadius: 0, fill: false, tension: 0
          }
        ]
      },
      options: baseOpts({ plugins: { legend: { position: 'top', align: 'end' } } })
    });
  }

  /** 每日消耗热量柱状图 */
  function burnBar(canvas, labels, burn) {
    const C = palette();
    makeChart('burn', canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '消耗(kcal)', data: burn, backgroundColor: C.green + 'CC',
          borderRadius: 8, maxBarThickness: 26
        }]
      },
      options: baseOpts()
    });
  }

  /** 体重变化折线图 */
  function weightLine(canvas, labels, weights) {
    const C = palette();
    const grad = canvas.getContext('2d').createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, 'rgba(167,139,250,0.35)');
    grad.addColorStop(1, 'rgba(167,139,250,0)');
    makeChart('weight', canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '体重(kg)', data: weights,
          borderColor: C.purple, borderWidth: 2.5, pointRadius: 3.5,
          pointBackgroundColor: C.point, pointBorderColor: C.purple, pointBorderWidth: 2,
          fill: true, backgroundColor: grad, tension: 0.35
        }]
      },
      options: baseOpts({ scales: { x: { grid: { display: false }, ticks: { color: C.gray, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { grid: { color: C.grid }, ticks: { color: C.gray, font: { family: FONT, size: 11 } }, beginAtZero: false } } })
    });
  }

  /** 当日宏量营养素比例饼图（按克数） */
  function macroDoughnut(canvas, proteinG, fatG, carbG) {
    const C = palette();
    makeChart('macro', canvas, {
      type: 'doughnut',
      data: {
        labels: ['蛋白质', '脂肪', '碳水'],
        datasets: [{
          data: [proteinG, fatG, carbG],
          backgroundColor: [C.blue, C.orange, C.green],
          borderColor: C.point, borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: FONT, size: 12 }, color: C.gray, usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16 }
          },
          tooltip: {
            backgroundColor: 'rgba(28,28,30,0.92)', titleFont: { family: FONT, size: 12 },
            bodyFont: { family: FONT, size: 12 }, padding: 10, cornerRadius: 12,
            callbacks: {
              label(ctx) {
                const total = (proteinG + fatG + carbG) || 1;
                const pct = Math.round(ctx.parsed * 100 / total);
                return ' ' + ctx.label + ' ' + ctx.parsed + 'g（' + pct + '%）';
              }
            }
          }
        }
      }
    });
  }

  function destroyAll() {
    Object.keys(instances).forEach(k => { instances[k].destroy(); delete instances[k]; });
  }

  /** 主题变化时若图表页可见则重建（由 App 调用） */
  function retheme() {
    destroyAll();
    if (window.App && typeof window.App.rethemeCharts === 'function') window.App.rethemeCharts();
  }

  return { available: true, destroyAll, intakeBar, burnBar, weightLine, macroDoughnut, retheme, palette };
})();
