// dashboard.js
import { db } from "./db.js";

let chartInstance = null;

// Função principal para carregar e calcular os dados
async function loadDashboardData() {
  const allTrades = await db.trades.toArray();

  // Calcula o lucro acumulado ao longo do tempo para o gráfico
  let accumulatedProfit = 0;
  const chartLabels = [];
  const chartData = [];

  // Ordena as operações por data e hora
  allTrades.sort(
    (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
  );

  let todayProfit = 0;
  let monthProfit = 0;
  let weekProfit = 0;

  // Datas para filtros simples
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.substring(0, 7); // "YYYY-MM"

  // Cálculo simples de semana (últimos 7 dias para facilitar agora)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStr = sevenDaysAgo.toISOString().split("T")[0];

  allTrades.forEach((trade) => {
    // Cálculo de resumos
    if (trade.date === today) todayProfit += trade.profit;
    if (trade.date.startsWith(currentMonth)) monthProfit += trade.profit;
    if (trade.date >= weekStr) weekProfit += trade.profit;

    // Dados do gráfico
    accumulatedProfit += trade.profit;
    // Formatando data para DD/MM
    const dateStr = trade.date.split("-").reverse().slice(0, 2).join("/");
    chartLabels.push(dateStr);
    chartData.push(accumulatedProfit);
  });

  // Atualiza a tela
  updateCard("res-dia", todayProfit);
  updateCard("res-semana", weekProfit);
  updateCard("res-mes", monthProfit);

  renderChart(chartLabels, chartData);
}

// Função para formatar moeda e cor
function updateCard(elementId, value) {
  const el = document.getElementById(elementId);
  el.innerText = `R$ ${value.toFixed(2).replace(".", ",")}`;

  el.className = ""; // limpa classes
  if (value > 0) el.classList.add("profit");
  else if (value < 0) el.classList.add("loss");
  else el.classList.add("neutral");
}

// Função para desenhar o Gráfico da Curva de Capital
// function renderChart(labels, data) {
//   const ctx = document.getElementById("evolutionChart").getContext("2d");

//   // Destroi o gráfico anterior se existir (para quando atualizar a página)
//   if (chartInstance) chartInstance.destroy();

//   // Cria um gradiente verde para ficar parecido com sua imagem
//   let gradient = ctx.createLinearGradient(0, 0, 0, 350);
//   gradient.addColorStop(0, "rgba(0, 230, 118, 0.4)"); // Verde translúcido em cima
//   gradient.addColorStop(1, "rgba(0, 230, 118, 0.0)"); // Transparente embaixo

//   chartInstance = new Chart(ctx, {
//     type: "line",
//     data: {
//       labels: labels,
//       datasets: [
//         {
//           label: "Resultado Acumulado",
//           data: data,
//           borderColor: "#00e676",
//           backgroundColor: gradient,
//           borderWidth: 2,
//           fill: true,
//           tension: 0.3, // Deixa a linha suave/curvada
//           pointRadius: 2,
//           pointBackgroundColor: "#ffc107",
//         },
//       ],
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       plugins: {
//         legend: { display: false },
//       },
//       scales: {
//         x: {
//           grid: { color: "rgba(255, 255, 255, 0.05)" },
//           ticks: { color: "#8b92a5" },
//         },
//         y: {
//           grid: { color: "rgba(255, 255, 255, 0.05)" },
//           ticks: { color: "#8b92a5" },
//         },
//       },
//     },
//   });
// }

// Substitua a função renderChart inteira por esta:
function renderChart(labels, data) {
  const ctx = document.getElementById("evolutionChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Resultado Acumulado",
          data: data,
          borderWidth: 2,
          fill: false, // Desligamos o fill gradiente para a linha colorida brilhar
          tension: 0.1,
          pointRadius: 3,
          // Mágica das cores dinâmicas:
          segment: {
            borderColor: (ctx) =>
              ctx.p1.parsed.y >= 0 ? "#00e676" : "#ff5252",
          },
          pointBackgroundColor: (ctx) => (ctx.raw >= 0 ? "#00e676" : "#ff5252"),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#8b92a5" },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#8b92a5" },
        },
      },
    },
  });
}

// --- BOTÃO DE TESTE (Apenas para gerar dados visuais antes do Passo 3) ---
document.getElementById("btnMockData").addEventListener("click", async () => {
  const todayDate = new Date().toISOString().split("T")[0];
  await db.trades.bulkAdd([
    {
      date: "2026-08-13",
      time: "10:00",
      ticker: "WINQ26",
      type: "Compra",
      entryPrice: 110000,
      exitPrice: 110200,
      reason: "Pivot",
      profit: -40,
    },
    {
      date: "2026-08-12",
      time: "11:30",
      ticker: "WDOU26",
      type: "Venda",
      entryPrice: 5200,
      exitPrice: 5190,
      reason: "Suporte",
      profit: 100,
    },
    {
      date: "2026-08-06",
      time: "09:45",
      ticker: "WINQ26",
      type: "Compra",
      entryPrice: 112000,
      exitPrice: 111900,
      reason: "Rompimento Falso",
      profit: -200,
    },
    {
      date: todayDate,
      time: "14:20",
      ticker: "PETR4",
      type: "Compra",
      entryPrice: 30.5,
      exitPrice: 31.0,
      reason: "Notícia",
      profit: 50,
    },
  ]);
  loadDashboardData();
});

// Carrega os dados assim que a página abre
loadDashboardData();

// MODAL

// Elementos do Modal
const modal = document.getElementById("tradeModal");
const btnNovaOperacao = document.getElementById("btnNovaOperacao");
const closeModal = document.getElementById("closeModal");
const cancelBtn = document.getElementById("cancelBtn");
const tradeForm = document.getElementById("tradeForm");

// Funções de Abrir e Fechar
function openModal() {
  modal.style.display = "flex";
  // Preenche a data de hoje automaticamente para facilitar
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("date").value = today;
}

function closeTradeModal() {
  modal.style.display = "none";
  tradeForm.reset(); // Limpa o formulário
}

btnNovaOperacao.addEventListener("click", openModal);
closeModal.addEventListener("click", closeTradeModal);
cancelBtn.addEventListener("click", closeTradeModal);

// Fecha o modal se clicar fora da caixa
window.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeTradeModal();
  }
});

// ====== COLE ISSO NO FINAL DO DASHBOARD.JS (Substituindo o submit antigo) ======

// 1. Função da Máscara de Moeda (Aceita negativos)
function aplicarMascaraMoeda(e) {
  let input = e.target;
  let valor = input.value;

  // Verifica se usuário digitou o sinal de menos
  let isNegativo = valor.includes("-");

  // Deixa só números
  let valorLimpo = valor.replace(/\D/g, "");
  if (valorLimpo === "") {
    input.dataset.rawValue = 0;
    input.value = "";
    calcularVariacao();
    return;
  }

  let valorFloat = parseFloat(valorLimpo) / 100;
  if (isNegativo) valorFloat = valorFloat * -1;

  input.dataset.rawValue = valorFloat;
  input.value = valorFloat.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  calcularVariacao();
}

// 2. Função de Cálculo (Pontos vs Porcentagem)
function calcularVariacao() {
  const pegarValor = (id) =>
    parseFloat(document.getElementById(id).dataset.rawValue || 0);

  const entrada = pegarValor("entryPrice");
  const saida = pegarValor("exitPrice");
  const categoria = document.getElementById("category").value;
  const direcao = document.getElementById("type").value;
  const divCalc = document.getElementById("resultado_calculo");

  if (entrada === 0 || saida === 0) {
    divCalc.style.display = "none";
    return;
  }

  let diferenca = 0;
  let texto = "";

  if (categoria === "futuros") {
    diferenca = direcao === "Compra" ? saida - entrada : entrada - saida;
    texto = `${diferenca.toFixed(2)} pontos`;
  } else {
    diferenca =
      direcao === "Compra"
        ? ((saida - entrada) / entrada) * 100
        : ((entrada - saida) / entrada) * 100;
    texto = `${diferenca.toFixed(2)}%`;
  }

  let cor =
    diferenca > 0
      ? "var(--profit-green)"
      : diferenca < 0
        ? "var(--loss-red)"
        : "var(--text-muted)";
  let icone = diferenca > 0 ? "▲" : diferenca < 0 ? "▼" : "−";

  divCalc.style.display = "block";
  divCalc.style.borderLeftColor = cor;
  divCalc.innerHTML = `<span style="color: var(--text-muted);">Variação da operação:</span> <strong style="color: ${cor}; margin-left: 5px;">${icone} ${texto}</strong>`;
}

// 3. Conectando as funções aos inputs do Modal
document
  .getElementById("entryPrice")
  .addEventListener("input", aplicarMascaraMoeda);
document
  .getElementById("exitPrice")
  .addEventListener("input", aplicarMascaraMoeda);
document
  .getElementById("profit")
  .addEventListener("input", aplicarMascaraMoeda);
document.getElementById("costs").addEventListener("input", aplicarMascaraMoeda);
document
  .getElementById("category")
  .addEventListener("change", calcularVariacao);
document.getElementById("type").addEventListener("change", calcularVariacao);

// 4. Salvando a Operação (COM PROTEÇÃO CONTRA NaN)
tradeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Função de segurança: se a máscara falhar ou estiver vazio, garante que envia 0
  const getValorSeguro = (id) => {
    const raw = document.getElementById(id).dataset.rawValue;
    const numero = parseFloat(raw);
    return isNaN(numero) ? 0 : numero;
  };

  const newTrade = {
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    category: document.getElementById("category").value,
    ticker: document.getElementById("ticker").value.toUpperCase(),
    type: document.getElementById("type").value,
    entryPrice: getValorSeguro("entryPrice"),
    exitPrice: getValorSeguro("exitPrice"),
    profit: getValorSeguro("profit"),
    costs: getValorSeguro("costs"),
    reason: document.getElementById("reason").value,
  };

  console.log("Tentando salvar operação:", newTrade);

  try {
    await db.trades.add(newTrade);
    closeTradeModal();
    await loadDashboardData();

    // Remove dados de teste se ainda existirem
    const btnMock = document.getElementById("btnMockData");
    if (btnMock) btnMock.style.display = "none";
  } catch (error) {
    console.error("Erro ao salvar:", error);
    alert("Erro ao salvar. Verifique o console.");
  }
});
