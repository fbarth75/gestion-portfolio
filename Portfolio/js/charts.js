window.PF = window.PF || {};

PF.Charts = {
  _pie: null,
  _time: null,
  _pieData: null,

  _updateOrCreate(chartRef, ctx, config) {
    const existing = PF.Charts[chartRef];
    if (existing) {
      existing.data = config.data;
      existing.options = config.options;
      existing.update('none');
      return existing;
    }
    const chart = new Chart(ctx, config);
    PF.Charts[chartRef] = chart;
    return chart;
  },

  renderPie(positions, priceMap, fxRate, mode) {
    const chartData = PF.Engine.computeChartData(positions, priceMap, fxRate, mode);
    const total = chartData.data.reduce((a, b) => a + b, 0);
    const cur = PF.State.data.currency;
    const legendEl = PF.Utils.$('chartLegend');

    if (total <= 0) {
      legendEl.innerHTML = '<div class="empty">Ajoutez des positions pour visualiser la r\u00e9partition.</div>';
      if (PF.Charts._pie) { PF.Charts._pie.destroy(); PF.Charts._pie = null; }
      return;
    }

    const isSame = PF.Charts._pieData && PF.Charts._pieData.length === chartData.data.length &&
      PF.Charts._pieData.every((v, i) => v === chartData.data[i]);

    if (PF.Charts._pie && isSame) {
      legendEl.innerHTML = chartData.labels.map((lb, i) => {
        const pct = chartData.data[i] / total * 100;
        return `<div class="row"><span class="name"><span class="sw" style="background:${chartData.colors[i]}"></span>${lb}</span><span class="pct">${PF.Utils.fmt(pct)} % \u00b7 ${PF.Utils.money(chartData.data[i], cur)}</span></div>`;
      }).join('');
      return;
    }

    PF.Charts._pieData = chartData.data.slice();

    const ctx = PF.Utils.$('pieChart').getContext('2d');
    PF.Charts._updateOrCreate('_pie', ctx, {
      type: 'doughnut',
      data: {
        labels: chartData.labels,
        datasets: [{ data: chartData.data, backgroundColor: chartData.colors, borderColor: '#15203b', borderWidth: 2, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const v = c.parsed;
                return ` ${c.label} : ${PF.Utils.money(v, cur)} (${PF.Utils.fmt(v / total * 100)} %)`;
              }
            }
          }
        }
      }
    });

    legendEl.innerHTML = chartData.labels.map((lb, i) => {
      const pct = chartData.data[i] / total * 100;
      return `<div class="row"><span class="name"><span class="sw" style="background:${chartData.colors[i]}"></span>${lb}</span><span class="pct">${PF.Utils.fmt(pct)} % \u00b7 ${PF.Utils.money(chartData.data[i], cur)}</span></div>`;
    }).join('');
  },

  renderTime(transactions, history, periodFilter) {
    const { labels, values } = PF.Engine.computeTimeData(transactions, history, periodFilter);

    if (!labels.length || values.every(v => v == null)) {
      if (PF.Charts._time) { PF.Charts._time.destroy(); PF.Charts._time = null; }
      return;
    }

    const cur = PF.State.data.currency;
    const ctx = PF.Utils.$('timeChart').getContext('2d');
    PF.Charts._updateOrCreate('_time', ctx, {
      type: 'line', data: {
        labels,
        datasets: [{
          label: 'Valeur portefeuille', data: values, fill: true,
          borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,.15)',
          pointRadius: 2, pointHoverRadius: 5, tension: .25, borderWidth: 2, spanGaps: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c) => ' ' + PF.Utils.money(c.parsed.y, cur) }
          }
        },
        scales: {
          x: { ticks: { color: '#8b9bc4', maxRotation: 45, autoSkip: true, maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,.04)' } },
          y: { ticks: { color: '#8b9bc4', callback: (v) => PF.Utils.fmt(v) }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      }
    });
  }
};
