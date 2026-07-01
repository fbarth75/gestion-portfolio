window.PF = window.PF || {};

PF.Engine = {
  _cacheKey: 0,
  _lastPosKey: -1,
  _lastCacheKey: -1,
  _cachedPositions: null,
  _lastAggKey: -1,
  _cachedAgg: null,

  _txHash(transactions) {
    if (!transactions.length) return 0;
    let hash = transactions.length;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const seed = i * 2654435761;
      hash ^= (t.date || '').length + seed;
      hash ^= ((t.symbol || '').length << 5) + seed;
      hash ^= ((t.type || '').length << 10) + seed;
      hash ^= (t.amount * 1000 + 0.5) | 0;
      hash ^= (t.price * 100 + 0.5) | 0;
      hash ^= (t.fees * 100 + 0.5) | 0;
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash;
  },

  getBuyPrice(position, fxRate) {
    return (position.avgBuyPriceUSD || 0) * fxRate;
  },

  getCurPrice(position, priceMap, fxRate) {
    if (position.manual) return (position.manualPriceUSD || 0) * fxRate;
    const coinId = PF.State.SYMBOL_TO_ID[position.symbol] || position.coinId;
    const info = priceMap[coinId];
    if (info && info.price != null) return info.price;
    return PF.Engine.getBuyPrice(position, fxRate);
  },

  getCoinCurPrice(coinId, priceMap) {
    const info = priceMap[coinId];
    return info ? info.price : null;
  },

  _invalidateCache() { PF.Engine._cacheKey++; },

  computePositions(transactions, manualCoins, priceMap, fxRate) {
    const hash = PF.Engine._txHash(transactions);
    if (hash === PF.Engine._lastPosKey && PF.Engine._lastCacheKey === PF.Engine._cacheKey && PF.Engine._cachedPositions) return PF.Engine._cachedPositions;

    const groups = {};
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t.symbol) continue;
      if (!groups[t.symbol]) groups[t.symbol] = { bq: 0, bc: 0, sq: 0, sd: 0, first: t.date, cnt: 0, totalFees: 0 };
      const g = groups[t.symbol];
      const fees = t.fees || 0;
      if (t.type === 'buy' || t.type === 'transfer_in' || t.type === 'staking_reward' || t.type === 'airdrop') {
        g.bq += t.amount;
        g.bc += t.price * t.amount + fees;
      } else if (t.type === 'sell' || t.type === 'transfer_out') {
        g.sq += t.amount;
        g.sd += t.price * t.amount - fees;
      } else if (t.type === 'swap') {
        if (t.swapIn) {
          g.bq += t.amount;
          g.bc += t.price * t.amount;
        } else {
          g.sq += t.amount;
          g.sd += t.price * t.amount - fees;
        }
      }
    }

    const positions = [];
    for (const symbol in groups) {
      const g = groups[symbol];
      const qty = g.bq - g.sq;
      if (qty <= 1e-8) continue;
      const avgBuyPriceUSD = g.bq > 0 ? g.bc / g.bq / fxRate : 0;
      const coinId = PF.API.resolveCoinId ? PF.API.resolveCoinId(symbol) : (PF.State.SYMBOL_TO_ID[symbol] || '');
      const isManual = manualCoins && manualCoins[symbol];
      const name = isManual ? manualCoins[symbol].name : (priceMap[coinId] ? priceMap[coinId].name : symbol);
      positions.push({
        symbol, name, coinId: isManual ? '' : coinId, qty, avgBuyPriceUSD,
        date: g.first, manual: !!isManual,
        manualPriceUSD: isManual ? manualCoins[symbol].priceUSD : 0
      });
    }

    PF.Engine._lastPosKey = hash;
    PF.Engine._lastCacheKey = PF.Engine._cacheKey;
    PF.Engine._cachedPositions = positions;
    PF.Engine._lastAggKey = -1;
    return positions;
  },

  computeTxAggregates(transactions) {
    const hash = PF.Engine._txHash(transactions);
    if (hash === PF.Engine._lastAggKey && PF.Engine._cachedAgg) return PF.Engine._cachedAgg;

    const agg = {};
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t.symbol) continue;
      const g = agg[t.symbol] || (agg[t.symbol] = { buyQty: 0, buyCost: 0, sellQty: 0, sellProceeds: 0, totalFees: 0 });
      const fees = t.fees || 0;
      if (t.type === 'buy' || t.type === 'transfer_in' || t.type === 'staking_reward' || t.type === 'airdrop') {
        g.buyQty += t.amount; g.buyCost += t.price * t.amount + fees;
      } else if (t.type === 'sell' || t.type === 'transfer_out') {
        g.sellQty += t.amount; g.sellProceeds += t.price * t.amount - fees;
      } else if (t.type === 'swap') {
        if (t.swapIn) {
          g.buyQty += t.amount; g.buyCost += t.price * t.amount;
        } else {
          g.sellQty += t.amount; g.sellProceeds += t.price * t.amount - fees;
        }
      }
      g.totalFees += fees;
    }

    PF.Engine._lastAggKey = hash;
    PF.Engine._cachedAgg = agg;
    return agg;
  },

  computePositionPL(position, priceMap, fxRate, txAgg) {
    const curPrice = PF.Engine.getCurPrice(position, priceMap, fxRate);
    const buyPrice = PF.Engine.getBuyPrice(position, fxRate);
    const invested = position.qty * buyPrice;
    const currentValue = position.qty * curPrice;
    const agg = txAgg[position.symbol];
    let realized = 0;
    if (agg && agg.buyQty > 0) {
      const avgCost = agg.buyCost / agg.buyQty;
      if (agg.sellQty <= agg.buyQty) {
        realized = agg.sellProceeds - agg.sellQty * avgCost;
      } else {
        realized = agg.sellProceeds - agg.buyQty * avgCost;
      }
    }
    const pl = currentValue + realized - invested;
    const ret = invested > 0 ? (pl / invested) * 100 : 0;
    return { curPrice, buyPrice, invested, currentValue, realized, pl, ret };
  },

  computeSummary(positions, priceMap, fxRate, txAgg) {
    let invested = 0, value = 0, grossLoss = 0, realized = 0;
    for (let i = 0; i < positions.length; i++) {
      const pl = PF.Engine.computePositionPL(positions[i], priceMap, fxRate, txAgg);
      invested += pl.invested;
      value += pl.currentValue;
      realized += pl.realized;
      if (pl.pl < 0) grossLoss += pl.pl;
    }
    const pnl = value + realized - invested;
    const ret = invested > 0 ? (pnl / invested) * 100 : 0;
    return { invested, value, realized, pl: pnl, ret, grossLoss };
  },

  computeChartData(positions, priceMap, fxRate, mode) {
    const agg = {};
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const val = mode === 'value'
        ? p.qty * PF.Engine.getCurPrice(p, priceMap, fxRate)
        : p.qty * PF.Engine.getBuyPrice(p, fxRate);
      const key = p.coinId || ('m_' + p.symbol);
      agg[key] = (agg[key] || 0) + val;
    }
    const entries = Object.entries(agg).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => {
      const c = priceMap[e[0]] || priceMap[PF.State.SYMBOL_TO_ID[e[0]]];
      return c ? (c.symbol || c.name) : e[0];
    });
    const palette = PF.Utils.PALETTE;
    return {
      labels,
      data: entries.map(e => e[1]),
      colors: entries.map((_, i) => palette[i % palette.length])
    };
  },

  computePortfolioHistory(transactions, history, periodFilter) {
    const inPeriod = periodFilter === 'all'
      ? () => true
      : (d) => (d || '').slice(0, 4) === periodFilter;
    const beforePeriod = periodFilter === 'all'
      ? () => true
      : (d) => (d || '').slice(0, 4) <= periodFilter;

    // Include ALL transactions up to the end of the selected period
    const txs = [];
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (beforePeriod(t.date)) txs.push(t);
    }
    txs.sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));

    if (!txs.length) return { entries: [], labels: [], values: [], metrics: null };

    const today = PF.Utils.todayISO();
    const allDates = [];
    const seen = {};
    for (let i = 0; i < txs.length; i++) {
      if (!seen[txs[i].date]) { seen[txs[i].date] = true; allDates.push(txs[i].date); }
    }
    if (!seen[today]) allDates.push(today);
    allDates.sort();

    const holdings = {};
    const holdingAvgBuy = {};
    const holdingFirstBuy = {};
    let cumNet = 0;
    const entries = [];
    let ti = 0;

for (let i = 0; i < allDates.length; i++) {
      const d = allDates[i];

      // Apply all transactions up to and including this date (end-of-day state)
      while (ti < txs.length && txs[ti].date <= d) {
        const t = txs[ti]; ti++;
        const fees = t.fees || 0;
        if (t._autoUSDT || t._toUSDT) {
          if (t.type === 'sell') {
            holdings[t.symbol] = (holdings[t.symbol] || 0) - t.amount;
            if (t._autoUSDT) cumNet -= t.price * t.amount;
            if (holdings[t.symbol] < 1e-8) { delete holdings[t.symbol]; delete holdingAvgBuy[t.symbol]; delete holdingFirstBuy[t.symbol]; }
          } else {
            const prevQty = holdings[t.symbol] || 0;
            const prevCost = prevQty * (holdingAvgBuy[t.symbol] || 0);
            const newQty = prevQty + t.amount;
            holdingAvgBuy[t.symbol] = newQty > 0 ? (prevCost + t.price * t.amount) / newQty : 0;
            holdings[t.symbol] = newQty;
          }
        } else if (t.type === 'buy' || t.type === 'transfer_in' || t.type === 'staking_reward' || t.type === 'airdrop') {
          const prevQty = holdings[t.symbol] || 0;
          const prevCost = prevQty * (holdingAvgBuy[t.symbol] || 0);
          const newQty = prevQty + t.amount;
          holdingAvgBuy[t.symbol] = newQty > 0 ? (prevCost + t.price * t.amount) / newQty : 0;
          if (!holdingFirstBuy[t.symbol] || t.date < holdingFirstBuy[t.symbol]) {
            holdingFirstBuy[t.symbol] = t.date;
          }
          holdings[t.symbol] = newQty;
          cumNet += t.price * t.amount;
        } else if ((t.type === 'sell' || t.type === 'transfer_out') && !t._toUSDT) {
          holdings[t.symbol] = (holdings[t.symbol] || 0) - t.amount;
          if (holdings[t.symbol] < 1e-8) { delete holdings[t.symbol]; delete holdingAvgBuy[t.symbol]; delete holdingFirstBuy[t.symbol]; }
          cumNet -= t.price * t.amount;
        } else if (t.type === 'swap') {
          if (t.swapIn) {
            const prevQty = holdings[t.symbol] || 0;
            const prevCost = prevQty * (holdingAvgBuy[t.symbol] || 0);
            const newQty = prevQty + t.amount;
            holdingAvgBuy[t.symbol] = newQty > 0 ? (prevCost + t.price * t.amount) / newQty : 0;
            if (!holdingFirstBuy[t.symbol] || t.date < holdingFirstBuy[t.symbol]) holdingFirstBuy[t.symbol] = t.date;
            holdings[t.symbol] = newQty;
            cumNet += t.price * t.amount;
          } else {
            holdings[t.symbol] = (holdings[t.symbol] || 0) - t.amount;
            if (holdings[t.symbol] < 1e-8) { delete holdings[t.symbol]; delete holdingAvgBuy[t.symbol]; delete holdingFirstBuy[t.symbol]; }
            cumNet -= t.price * t.amount;
          }
        }
      }

      // Only compute value for dates within the selected period
      const show = inPeriod(d);

      let value = 0;
      let hasPrice = false;
      if (show) {
        for (const sym in holdings) {
          const qty = holdings[sym];
          if (qty <= 1e-8) continue;
          const coinId = PF.API.resolveCoinId ? PF.API.resolveCoinId(sym) : (PF.State.SYMBOL_TO_ID[sym] || '');
          let price = null;
          if (coinId && d < today) {
            price = PF.API.getHistoricalPrice ? PF.API.getHistoricalPrice(coinId, d) : null;
          }
          if (price == null) {
            if (d < today) {
              const avgBuy = holdingAvgBuy[sym] || null;
              const m = PF.API.getPriceMap ? PF.API.getPriceMap()[coinId] : null;
              const curLive = m ? m.price : null;
              const firstDate = holdingFirstBuy[sym];
              if (avgBuy != null && curLive != null && curLive > 0 && firstDate) {
                const totalMs = new Date(today) - new Date(firstDate);
                const elapsedMs = new Date(d) - new Date(firstDate);
                const ratio = totalMs > 0 ? Math.max(0, Math.min(1, elapsedMs / totalMs)) : 0;
                price = avgBuy + (curLive - avgBuy) * ratio;
              } else {
                price = avgBuy;
              }
            } else {
              const m = PF.API.getPriceMap ? PF.API.getPriceMap()[coinId] : null;
              price = m ? m.price : null;
            }
          }
          if (price != null) {
            value += qty * price;
            hasPrice = true;
          }
        }
        if (!hasPrice) value = cumNet;
      }

      if (show) {
        const e = { date: d, invested: cumNet, value, pnl: 0, ret: 0, dailyChg: 0, dailyChgPct: 0 };
        entries.push(e);
      }
    }

    let ath = -Infinity, athInvested = 0;
    let bestDay = 0, worstDay = 0;
    let bestDayPct = 0, worstDayPct = 0;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      e.pnl = e.value - e.invested;
      e.ret = e.invested > 0 ? (e.pnl / e.invested) * 100 : 0;
      if (e.value > ath) { ath = e.value; athInvested = e.invested; }
    }

    if (entries.length > 1) {
      for (let i = 1; i < entries.length; i++) {
        const prevVal = entries[i - 1].value;
        const newInvested = Math.max(0, entries[i].invested - entries[i - 1].invested);
        const marketChg = entries[i].value - prevVal - newInvested;
        entries[i].dailyChg = marketChg;
        entries[i].dailyChgPct = prevVal > 0 ? (marketChg / prevVal) * 100 : 0;
        // Ignore days with any capital injection for best/worst day (avoids artificial gains from new purchases)
        const hasInvestment = newInvested > 0;
        if (!hasInvestment) {
          if (entries[i].dailyChgPct > bestDayPct) { bestDayPct = entries[i].dailyChgPct; bestDay = i; }
          if (entries[i].dailyChgPct < worstDayPct) { worstDayPct = entries[i].dailyChgPct; worstDay = i; }
        }
      }
    }

    const last = entries[entries.length - 1];
    const drawdown = ath > 0 && last.value < ath ? ((ath - last.value) / ath) * 100 : 0;
    const athPnl = ath - athInvested;
    const athRet = athInvested > 0 ? (athPnl / athInvested) * 100 : 0;

    return {
      entries,
      labels: entries.map(e => PF.Utils.fmtDate(e.date)),
      values: entries.map(e => e.value),
      metrics: {
        ath, athInvested, athPnl, athRet, drawdown,
        bestDay: bestDay > 0 ? { date: entries[bestDay].date, chg: entries[bestDay].dailyChg, pct: bestDayPct } : null,
        worstDay: worstDay > 0 ? { date: entries[worstDay].date, chg: entries[worstDay].dailyChg, pct: worstDayPct } : null,
        totalPnl: last.pnl, totalRet: last.ret
      }
    };
  },

  computeTimeData(transactions, history, periodFilter) {
    const result = PF.Engine.computePortfolioHistory(transactions, history, periodFilter);
    return { labels: result.labels, values: result.values };
  },

  computeHistoryEntries(transactions, history, periodFilter) {
    const result = PF.Engine.computePortfolioHistory(transactions, history, periodFilter || 'all');
    return { entries: result.entries, metrics: result.metrics };
  }
};
