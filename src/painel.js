// ================= ESTATÍSTICAS (PASSO 5) =================

export function calcularEstatisticas(trades) {
  const totalOps = trades.length;

  // Se não houver trades, sai da função para não dar erro
  if (totalOps === 0) return;

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  trades.forEach((trade) => {
    // Pega o lucro descontando os custos
    const p = trade.profit - (trade.costs || 0);

    if (p > 0) {
      wins++;
      grossProfit += p;
    } else if (p < 0) {
      losses++;
      grossLoss += Math.abs(p); // Converte negativo para positivo para somar perdas
    }

    // Verifica Maior e Menor trade
    if (p > bestTrade) bestTrade = p;
    if (p < worstTrade) worstTrade = p;
  });

  // Se só teve empates (Zero a Zero), evita valores infinitos
  if (bestTrade === -Infinity) bestTrade = 0;
  if (worstTrade === Infinity) worstTrade = 0;

  // Fórmulas Clássicas
  const winRate = (wins / totalOps) * 100;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;

  // Fator de Lucro e Payoff (com proteção de divisão por zero)
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99.99 : 0;

  // Injetando no HTML
  document.getElementById("stat-total-ops").innerText = totalOps;
  document.getElementById("stat-winrate").innerText = `${winRate.toFixed(1)}%`;
  document.getElementById("stat-profit-factor").innerText =
    profitFactor.toFixed(2);
  document.getElementById("stat-payoff").innerText = payoff.toFixed(2);

  document.getElementById("stat-avg-win").innerText = avgWin.toLocaleString(
    "pt-BR",
    { style: "currency", currency: "BRL" },
  );
  // Multiplica o avgLoss por -1 para mostrar vermelhinho com sinal de menos
  document.getElementById("stat-avg-loss").innerText = (
    avgLoss * -1
  ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("stat-best-trade").innerText =
    bestTrade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("stat-worst-trade").innerText =
    worstTrade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
