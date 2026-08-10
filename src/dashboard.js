// dashboard.js
import { db } from "./db.js";
import { calcularEstatisticas } from "./painel.js";

let chartInstance = null;
let todosOsTrades = []; // Variável global para armazenar e filtrar a tabela
let operacaoEditandoId = null;

// Adicione os listeners para os filtros
document
  .getElementById("filterDate")
  .addEventListener("change", aplicarFiltros);
document
  .getElementById("filterTicker")
  .addEventListener("input", aplicarFiltros);
document
  .getElementById("filterType")
  .addEventListener("change", aplicarFiltros);
document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("filterDate").value = "";
  document.getElementById("filterTicker").value = "";
  document.getElementById("filterType").value = "";
  aplicarFiltros();
});

// Função principal para carregar e calcular os dados
async function loadDashboardData() {
  todosOsTrades = await db.trades.toArray();

  // Ordena as operações da mais antiga para a mais nova para o Gráfico
  todosOsTrades.sort(
    (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
  );

  let accumulatedProfit = 0;
  const chartLabels = [];
  const chartData = [];
  let todayProfit = 0;
  let monthProfit = 0;
  let weekProfit = 0;

  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.substring(0, 7);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStr = sevenDaysAgo.toISOString().split("T")[0];

  todosOsTrades.forEach((trade) => {
    // P/L Líquido real da operação
    const lucroLiquido = trade.profit - (trade.costs || 0);

    if (trade.date === today) todayProfit += lucroLiquido;
    if (trade.date.startsWith(currentMonth)) monthProfit += lucroLiquido;
    if (trade.date >= weekStr) weekProfit += lucroLiquido;

    accumulatedProfit += lucroLiquido;
    const dateStr = trade.date.split("-").reverse().slice(0, 2).join("/");
    chartLabels.push(dateStr);
    chartData.push(accumulatedProfit);
  });

  updateCard("res-dia", todayProfit);
  updateCard("res-semana", weekProfit);
  updateCard("res-mes", monthProfit);

  renderChart(chartLabels, chartData);

  // Após calcular o gráfico, renderiza a tabela (Invertendo a ordem para o mais novo aparecer no topo)
  renderTabela([...todosOsTrades].reverse());
  calcularEstatisticas(todosOsTrades);
}

// ========= LÓGICA DA TABELA E FILTROS =========

function aplicarFiltros() {
  const fData = document.getElementById("filterDate").value;
  const fTicker = document.getElementById("filterTicker").value.toUpperCase();
  const fType = document.getElementById("filterType").value;

  let filtrados = [...todosOsTrades].reverse(); // Começa com todos, do mais novo pro mais velho

  if (fData) filtrados = filtrados.filter((t) => t.date === fData);
  if (fTicker) filtrados = filtrados.filter((t) => t.ticker.includes(fTicker));
  if (fType) filtrados = filtrados.filter((t) => t.type === fType);

  renderTabela(filtrados);
}

function renderTabela(trades) {
  const tbody = document.getElementById("tradesTableBody");
  tbody.innerHTML = "";

  if (trades.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Nenhuma operação encontrada com estes filtros.</td></tr>`;
    return;
  }

  trades.forEach((trade) => {
    const lucroLiquido = trade.profit - (trade.costs || 0);
    const isGain = lucroLiquido >= 0;

    // Formatações Visuais
    const badge = isGain
      ? '<span class="badge badge-gain">Gain</span>'
      : '<span class="badge badge-loss">Loss</span>';
    const plRealColor = isGain ? "var(--profit-green)" : "var(--loss-red)";
    const plRealText = lucroLiquido.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const dirText =
      trade.type === "Compra"
        ? '<span class="dir-compra">▲ C</span>'
        : '<span class="dir-venda">▼ V</span>';
    const catText = trade.category === "futuros" ? "Futuros" : "Ações";

    // Formata a data de YYYY-MM-DD para DD/MM/YYYY
    const dataFormatada = trade.date.split("-").reverse().join("/");

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${badge}</td>
            <td>${dataFormatada} - ${trade.time}</td>
            <td style="font-weight: bold;">${trade.ticker}</td>
            <td>${catText}</td>
            <td>${dirText}</td>
            <td>${trade.entryPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            <td>${trade.exitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            <td style="color: var(--loss-red)">${(trade.costs || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            <td style="color: ${plRealColor}; font-weight: bold;">${plRealText}</td>
            <td>
                <button class="btn-edit" onclick="editarTrade(${trade.id})" title="Editar Operação">✏️</button>
                <button class="btn-delete" onclick="deletarTrade(${trade.id})" title="Excluir Operação">🗑️</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

// Tornar a função de deletar acessível globalmente no HTML
window.deletarTrade = async (id) => {
  if (
    confirm(
      "Tem certeza que deseja excluir esta operação? Isso alterará os resultados.",
    )
  ) {
    await db.trades.delete(id);
    loadDashboardData(); // Recarrega tudo
  }
};

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
// Substitua a função renderChart inteira por esta:
function renderChart(labels, data) {
  const ctx = document.getElementById("evolutionChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  // dashboard.js (Substitua a parte do dataset na função renderChart)

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Resultado Acumulado",
          data: data,
          borderWidth: 2,
          tension: 0.3, // Aumentei levemente a tensão para a onda ficar mais suave
          pointRadius: 3,

          // Mágica da cor da linha
          segment: {
            borderColor: (ctx) =>
              ctx.p1.parsed.y >= 0 ? "#00e676" : "#ff5252",
          },
          pointBackgroundColor: (ctx) => (ctx.raw >= 0 ? "#00e676" : "#ff5252"),

          // Mágica do preenchimento (A "Onda do Mar")
          fill: {
            target: "origin", // Preenche até a linha do zero
            above: "rgba(0, 230, 118, 0.15)", // Verde translúcido quando positivo
            below: "rgba(255, 82, 82, 0.15)", // Vermelho translúcido quando negativo
          },
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
  // ... (resto das options continua igual)
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
  tradeForm.reset();

  // Limpa a caixinha de cálculos e as variáveis
  document.getElementById("resultado_calculo").style.display = "none";
  document.querySelector(".modal-header h2").innerText = "Registrar Operação"; // Volta o título original
  operacaoEditandoId = null;

  // Limpa os valores puros salvos nos inputs
  ["entryPrice", "exitPrice", "profit", "costs"].forEach((id) => {
    document.getElementById(id).dataset.rawValue = 0;
  });
}

window.editarTrade = async (id) => {
  // Busca a operação na variável global que já temos
  const trade = todosOsTrades.find((t) => t.id === id);
  if (!trade) return;

  operacaoEditandoId = id; // Avisa o sistema que é uma edição!

  // Preenche campos simples
  document.getElementById("date").value = trade.date;
  document.getElementById("time").value = trade.time;
  document.getElementById("category").value = trade.category;
  document.getElementById("ticker").value = trade.ticker;
  document.getElementById("type").value = trade.type;
  document.getElementById("reason").value = trade.reason;

  // Função para preencher os valores formatando como Moeda e salvando o valor real
  const setValorFormatado = (idInput, valorRaw) => {
    const el = document.getElementById(idInput);
    el.dataset.rawValue = valorRaw;
    el.value = valorRaw.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  setValorFormatado("entryPrice", trade.entryPrice);
  setValorFormatado("exitPrice", trade.exitPrice);
  setValorFormatado("profit", trade.profit);
  setValorFormatado("costs", trade.costs || 0);

  // Recalcula a caixinha de variação para exibir os pontos/porcentagem corretos
  calcularVariacao();

  // Muda o título para o usuário saber o que está fazendo
  document.querySelector(".modal-header h2").innerText = "✏️ Editar Operação";

  modal.style.display = "flex";
};

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
    if (operacaoEditandoId) {
      // Se tiver um ID de edição, nós ATUALIZAMOS
      await db.trades.update(operacaoEditandoId, newTrade);
    } else {
      // Se não tiver, criamos uma NOVA
      await db.trades.add(newTrade);
    }

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
