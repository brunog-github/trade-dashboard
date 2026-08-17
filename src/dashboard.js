// dashboard.js
import { db } from "./db.js";
import { calcularEstatisticas } from "./painel.js";

let chartInstance = null;
let todosOsTrades = []; // Variável global para armazenar e filtrar a tabela
let operacaoEditandoId = null;
let screenshotsTemporarias = []; // Guarda as imagens do modal atual em formato Base64

// Variáveis de Controle
let paginaAtual = 1;
const itensPorPagina = 10;
let colunaOrdenacao = "date"; // Ordenação padrão
let ordemAscendente = false; // False = do mais novo pro mais velho

// ================= SISTEMA DE CONFIRMAÇÃO CUSTOMIZADO =================
window.showConfirmDialog = (titulo, mensagem, isDanger = false) => {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const btnAction = document.getElementById("btnConfirmAction");
    const btnCancel = document.getElementById("btnConfirmCancel");

    // Preenche os textos
    document.getElementById("confirmTitle").innerText = titulo;
    document.getElementById("confirmMessage").innerText = mensagem;

    // Estiliza o botão de confirmar dependendo do tipo da ação
    btnAction.className = isDanger ? "btn-danger" : "btn-save";
    btnAction.innerText = isDanger ? "Sim, Excluir" : "Confirmar";

    // Mostra o modal
    modal.style.display = "flex";

    // Funções para resolver a Promise e limpar eventos
    const cleanupAndResolve = (result) => {
      modal.style.display = "none";
      btnAction.removeEventListener("click", onConfirm);
      btnCancel.removeEventListener("click", onCancel);
      resolve(result); // Devolve true ou false
    };

    const onConfirm = () => cleanupAndResolve(true);
    const onCancel = () => cleanupAndResolve(false);

    btnAction.addEventListener("click", onConfirm);
    btnCancel.addEventListener("click", onCancel);
  });
};

// Novos Event Listeners dos Filtros
document.getElementById("filterDateStart").addEventListener("change", () => {
  paginaAtual = 1;
  aplicarFiltros();
});
document.getElementById("filterDateEnd").addEventListener("change", () => {
  paginaAtual = 1;
  aplicarFiltros();
});
document.getElementById("filterTicker").addEventListener("input", () => {
  paginaAtual = 1;
  aplicarFiltros();
});
document.getElementById("filterType").addEventListener("change", () => {
  paginaAtual = 1;
  aplicarFiltros();
});
document.getElementById("filterCategory").addEventListener("change", () => {
  paginaAtual = 1;
  aplicarFiltros();
}); // NOVO
document.getElementById("filterResult").addEventListener("change", () => {
  paginaAtual = 1;
  aplicarFiltros();
}); // NOVO

document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("filterDateStart").value = "";
  document.getElementById("filterDateEnd").value = "";
  document.getElementById("filterTicker").value = "";
  document.getElementById("filterType").value = "";
  document.getElementById("filterCategory").value = ""; // NOVO
  document.getElementById("filterResult").value = ""; // NOVO
  paginaAtual = 1;
  aplicarFiltros();
});

// FUNÇÃO EXCLUIR TUDO
document.getElementById("btnDeleteAll").addEventListener("click", async () => {
  if (todosOsTrades.length === 0) {
    alert("Não há operações para excluir."); // Se quiser, pode usar um modal pro alert depois!
    return;
  }

  // Chama nosso modal customizado
  const confirmado = await showConfirmDialog(
    "CUIDADO: Zona de Perigo",
    "Você está prestes a apagar TODO o seu histórico de operações. Esta ação não poderá ser desfeita. Deseja continuar?",
    true,
  );

  if (confirmado) {
    await db.trades.clear();
    loadDashboardData();
  }
});

// Event Listeners de Ordenação nas Colunas (TH)
document.querySelectorAll("th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const colunaClicada = th.dataset.sort;
    if (colunaOrdenacao === colunaClicada) {
      ordemAscendente = !ordemAscendente; // Inverte a ordem se clicar na mesma
    } else {
      colunaOrdenacao = colunaClicada;
      ordemAscendente = true; // Se for coluna nova, começa ascendente
    }
    paginaAtual = 1; // Volta pra primeira página
    aplicarFiltros();
  });
});

// BLOQUEAR DATAS FUTURAS (Executado assim que o script carrega)
const inputStart = document.getElementById("filterDateStart");
const inputEnd = document.getElementById("filterDateEnd");
const inputFormDate = document.getElementById("date"); // O input de data do Modal de registro

const dataDeHoje = new Date().toISOString().split("T")[0];

if (inputStart) inputStart.max = dataDeHoje;
if (inputEnd) inputEnd.max = dataDeHoje;
if (inputFormDate) inputFormDate.max = dataDeHoje; // Impede salvar trades no futuro também!

// Função principal para carregar e calcular os dados
// Variável para guardar o mês selecionado atualmente (começa com o mês atual YYYY-MM)
let mesVisualizado = new Date().toISOString().substring(0, 7);

// Listener para quando o usuário trocar o mês no seletor
document.getElementById("monthSelector").addEventListener("change", (e) => {
  mesVisualizado = e.target.value;
  atualizarDashboardVisuais();
});

// ================= FILTRO ESTATÍSTICAS (DAY TRADE / SWING TRADE) =================
document.getElementById("tradeTypeFilter").addEventListener("change", () => {
  // Quando o usuário troca a modalidade, pega as operações do mês visualizado e recalcula!
  const tradesDoMes = todosOsTrades.filter((t) =>
    t.date.startsWith(mesVisualizado),
  );
  calcularEstatisticas(tradesDoMes);
});

async function loadDashboardData() {
  todosOsTrades = await db.trades.toArray();
  todosOsTrades.sort(
    (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
  );

  atualizarOpcoesMes();
  atualizarDashboardVisuais();

  // A tabela de histórico continua independente com seus próprios filtros
  aplicarFiltros();
}

// 1. Vasculha o banco, acha os meses operados e preenche o Seletor
function atualizarOpcoesMes() {
  const select = document.getElementById("monthSelector");
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  // Extrai "YYYY-MM" únicos de todas as operações
  const uniqueMonths = new Set(
    todosOsTrades.map((t) => t.date.substring(0, 7)),
  );

  // Garante que o mês atual sempre exista na lista, mesmo se não tiver operações ainda
  const mesAtual = new Date().toISOString().substring(0, 7);
  uniqueMonths.add(mesAtual);

  // Ordena do mais recente para o mais antigo
  const sortedMonths = Array.from(uniqueMonths).sort((a, b) =>
    b.localeCompare(a),
  );

  select.innerHTML = "";
  sortedMonths.forEach((m) => {
    const [ano, mes] = m.split("-");
    const option = document.createElement("option");
    option.value = m;
    option.textContent = `${monthNames[parseInt(mes) - 1]} ${ano}`;
    select.appendChild(option);
  });

  // Mantém selecionado o mês que o usuário estava vendo, ou joga pro atual
  if (uniqueMonths.has(mesVisualizado)) {
    select.value = mesVisualizado;
  } else {
    select.value = sortedMonths[0];
    mesVisualizado = sortedMonths[0];
  }
}

// Função auxiliar para calcular em qual semana do ano cai uma data (para agrupar a "Melhor Semana")
function getWeekNumber(dateString) {
  const [ano, mes, dia] = dateString.split("-");
  const date = new Date(ano, mes - 1, dia);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

// 2. Atualiza Cards, Gráfico e Estatísticas baseado no mês selecionado
// 2. Atualiza Cards, Gráfico e Estatísticas baseado no mês selecionado
function atualizarDashboardVisuais() {
  // Descobre qual é o mês e ano em que estamos hoje no mundo real
  const mesAtualReal = new Date().toISOString().substring(0, 7);
  const isMesAtual = mesVisualizado === mesAtualReal;

  // Filtra as operações do mês selecionado
  const tradesDoMes = todosOsTrades.filter((t) =>
    t.date.startsWith(mesVisualizado),
  );

  let resultadoMes = 0;
  let accumulatedProfit = 0;
  const chartLabels = [];
  const chartData = [];

  // Variáveis para calcular recordes (usadas se for mês passado)
  const dias = {};
  const semanas = {};

  tradesDoMes.forEach((trade) => {
    const p = trade.profit - (trade.costs || 0);

    resultadoMes += p;

    // Agrupa por dia e semana
    dias[trade.date] = (dias[trade.date] || 0) + p;
    const semanaNum = getWeekNumber(trade.date);
    semanas[semanaNum] = (semanas[semanaNum] || 0) + p;

    // Dados do Gráfico
    accumulatedProfit += p;
    const dateStr = trade.date.split("-").reverse().slice(0, 2).join("/");
    chartLabels.push(dateStr);
    chartData.push(accumulatedProfit);
  });

  // Pega os elementos de título dos cards no HTML
  const tituloCard1 = document.getElementById("titulo-card-1");
  const tituloCard2 = document.getElementById("titulo-card-2");

  if (isMesAtual) {
    // ---- MODO: MÊS ATUAL ----
    tituloCard1.innerText = "Resultado do Dia";
    tituloCard2.innerText = "Resultado da Semana";

    let todayProfit = 0;
    let weekProfit = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    // Calcula os últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekStr = sevenDaysAgo.toISOString().split("T")[0];

    // Varre TODOS os trades (para garantir que uma semana pegue dias do fim do mês passado, se necessário)
    todosOsTrades.forEach((t) => {
      const p = t.profit - (t.costs || 0);
      if (t.date === todayStr) todayProfit += p;
      if (t.date >= weekStr) weekProfit += p;
    });

    updateCard("res-card-1", todayProfit);
    updateCard("res-card-2", weekProfit);
  } else {
    // ---- MODO: MESES ANTERIORES ----
    tituloCard1.innerText = "Melhor Dia";
    tituloCard2.innerText = "Melhor Semana";

    const arrayDias = Object.values(dias);
    const arraySemanas = Object.values(semanas);

    // Encontra o máximo (Se não houver trades no mês, fica 0)
    const melhorDia = arrayDias.length > 0 ? Math.max(...arrayDias) : 0;
    const melhorSemana =
      arraySemanas.length > 0 ? Math.max(...arraySemanas) : 0;

    updateCard("res-card-1", melhorDia);
    updateCard("res-card-2", melhorSemana);
  }

  // Atualiza o resultado total do mês (este card nunca muda de função)
  updateCard("res-mes", resultadoMes);

  // Atualiza o Gráfico e as Estatísticas apenas com os dados do mês
  renderChart(chartLabels, chartData);
  calcularEstatisticas(tradesDoMes);
  renderizarCalendario();
}

// ========= LÓGICA DA TABELA E FILTROS =========
// ================= TABELA, FILTROS E PAGINAÇÃO (PASSO 6) =================

function aplicarFiltros() {
  const start = document.getElementById("filterDateStart").value;
  const end = document.getElementById("filterDateEnd").value;
  const fTicker = document.getElementById("filterTicker").value.toUpperCase();
  const fType = document.getElementById("filterType").value;

  // Captura os novos filtros
  const fCategory = document.getElementById("filterCategory").value;
  const fResult = document.getElementById("filterResult").value;

  console.log("Aplicando filtros:", fCategory);

  let filtrados = [...todosOsTrades];

  // 1. Aplica o Filtro Range de Datas
  if (start) filtrados = filtrados.filter((t) => t.date >= start);
  if (end) filtrados = filtrados.filter((t) => t.date <= end);

  // 2. Outros Filtros
  if (fTicker) filtrados = filtrados.filter((t) => t.ticker.includes(fTicker));
  if (fType) filtrados = filtrados.filter((t) => t.type === fType);

  // Aplica o filtro de Categoria
  if (fCategory) filtrados = filtrados.filter((t) => t.category === fCategory);

  // Aplica o filtro de Resultado (Gain/Loss)
  if (fResult) {
    filtrados = filtrados.filter((t) => {
      const lucroLiquido = t.profit - (t.costs || 0);
      if (fResult === "Gain") return lucroLiquido >= 0;
      if (fResult === "Loss") return lucroLiquido < 0;
      return true;
    });
  }

  // 3. Ordenação Dinâmica
  filtrados.sort((a, b) => {
    let valA, valB;

    // Trata cada coluna de forma especial
    if (colunaOrdenacao === "date") {
      valA = new Date(`${a.date}T${a.time}`);
      valB = new Date(`${b.date}T${b.time}`);
    } else if (colunaOrdenacao === "profit") {
      valA = a.profit - (a.costs || 0);
      valB = b.profit - (b.costs || 0);
    } else if (colunaOrdenacao === "status") {
      valA = a.profit - (a.costs || 0) >= 0 ? 1 : -1;
      valB = b.profit - (b.costs || 0) >= 0 ? 1 : -1;
    } else {
      // Categoria, Ticker, Tipo
      valA = a[colunaOrdenacao];
      valB = b[colunaOrdenacao];
    }

    if (valA < valB) return ordemAscendente ? -1 : 1;
    if (valA > valB) return ordemAscendente ? 1 : -1;
    return 0;
  });

  // Atualiza visualmente as setinhas no HTML
  document
    .querySelectorAll("th.sortable .sort-icon")
    .forEach((icon) => (icon.innerText = ""));
  const thAtivo = document.querySelector(
    `th[data-sort="${colunaOrdenacao}"] .sort-icon`,
  );
  if (thAtivo) thAtivo.innerText = ordemAscendente ? "▲" : "▼";

  // 4. Manda para a função que corta a página e desenha
  renderTabela(filtrados);
}

function renderTabela(trades) {
  const tbody = document.getElementById("tradesTableBody");
  tbody.innerHTML = "";

  // Paginação: Calcula os limites matemáticos
  const totalItens = trades.length;
  const totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const indexFim = indexInicio + itensPorPagina;

  // Separa apenas os 10 itens da página atual
  const tradesDaPagina = trades.slice(indexInicio, indexFim);

  if (tradesDaPagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Nenhuma operação encontrada.</td></tr>`;
    renderControlesPaginacao(0, 1);
    return;
  }

  // Desenha as Linhas
  tradesDaPagina.forEach((trade) => {
    const lucroLiquido = trade.profit - (trade.costs || 0);
    const isGain = lucroLiquido >= 0;

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

    const dIn = trade.date.split("-").reverse().slice(0, 2).join("/");
    let periodoHTML = `${dIn} - ${trade.time}`; // Padrão antigo

    if (trade.exitDate && trade.exitTime) {
      const dOut = trade.exitDate.split("-").reverse().slice(0, 2).join("/");

      // Se entrou e saiu no MESMO dia, resume para ficar limpo
      if (trade.date === trade.exitDate) {
        periodoHTML = `${dIn}<br><span style="font-size:0.8rem; color:var(--text-muted)">${trade.time} às ${trade.exitTime}</span>`;
      } else {
        // Se levou mais de um dia
        periodoHTML = `${dIn} - ${trade.time}<br><span style="font-size:0.8rem; color:var(--text-muted)">até ${dOut} - ${trade.exitTime}</span>`;
      }
    }

    // Verifica se tem imagens
    const iconFoto =
      trade.screenshots && trade.screenshots.length > 0
        ? ' <span title="Possui Screenshot" style="font-size: 0.9rem;">📸</span>'
        : "";

    const tr = document.createElement("tr");

    // ADICIONADO: Ao clicar na linha inteira, abre o visualizador
    tr.onclick = () => abrirVisualizador(trade.id);

    tr.innerHTML = `
            <td>${badge}</td>
            <td>${periodoHTML}</td>
            <td style="font-weight: bold;">${trade.ticker}${iconFoto}</td> <!-- Ícone adicionado aqui -->
            <td>${catText}</td>
            <td>${dirText}</td>
            <td>${trade.entryPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            <td>${trade.exitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            <td style="color: var(--loss-red)">${(trade.costs || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            <td style="color: ${plRealColor}; font-weight: bold;">${plRealText}</td>
            <td>
                <!-- ADICIONADO: event.stopPropagation() para os botões não abrirem o Raio-X sem querer -->
                <button class="btn-edit" onclick="event.stopPropagation(); editarTrade(${trade.id})" title="Editar">✏️</button>
                <button class="btn-delete" onclick="event.stopPropagation(); deletarTrade(${trade.id})" title="Excluir">🗑️</button>
            </td>
        `;
    tbody.appendChild(tr);
  });

  renderControlesPaginacao(totalItens, totalPaginas);
}

// Desenha os Botões da Paginação (Anterior / Próxima)
function renderControlesPaginacao(totalItens, totalPaginas) {
  const divControles = document.getElementById("paginationControls");

  divControles.innerHTML = `
        <span class="pagination-info">Mostrando página ${paginaAtual} de ${totalPaginas} (${totalItens} registros)</span>
        <button class="btn-page" id="btnPrevPage" ${paginaAtual === 1 ? "disabled" : ""}>Anterior</button>
        <button class="btn-page" id="btnNextPage" ${paginaAtual === totalPaginas ? "disabled" : ""}>Próxima</button>
    `;

  // Eventos dos botões (se eles não estiverem desabilitados)
  if (paginaAtual > 1) {
    document.getElementById("btnPrevPage").addEventListener("click", () => {
      paginaAtual--;
      aplicarFiltros();
    });
  }

  if (paginaAtual < totalPaginas) {
    document.getElementById("btnNextPage").addEventListener("click", () => {
      paginaAtual++;
      aplicarFiltros();
    });
  }
}

// Tornar a função de deletar acessível globalmente no HTML
window.deletarTrade = async (id) => {
  // Chama nosso modal customizado (Título, Mensagem, isDanger = true)
  const confirmado = await showConfirmDialog(
    "Excluir Operação",
    "Tem certeza que deseja excluir este registro? Os resultados do seu dashboard serão recalculados.",
    true,
  );

  if (confirmado) {
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
          pointBorderColor: (ctx) => (ctx.raw >= 0 ? "#05b862" : "#d34343"),

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

// Carrega os dados assim que a página abre
loadDashboardData();

// MODAL

// Elementos do Modal
const modal = document.getElementById("tradeModal");
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

// ================= LÓGICA DE SCREENSHOTS =================

// Escuta o input de arquivo e converte as imagens
document
  .getElementById("screenshotInput")
  .addEventListener("change", async (e) => {
    const files = e.target.files;
    for (let file of files) {
      const base64 = await convertFileToBase64(file);
      screenshotsTemporarias.push(base64);
    }
    renderizarMiniaturas();
    e.target.value = ""; // Reseta o input para permitir enviar a mesma imagem se apagada
  });

// Transforma a imagem em texto para o Banco de Dados
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Desenha os quadradinhos na tela
function renderizarMiniaturas() {
  const container = document.getElementById("screenshotPreviews");
  container.innerHTML = "";

  screenshotsTemporarias.forEach((src, index) => {
    const div = document.createElement("div");
    div.className = "screenshot-thumb-container";
    div.innerHTML = `
            <img src="${src}" onclick="visualizarImagem('${src}')" title="Clique para ampliar">
            <button type="button" class="btn-remove-thumb" onclick="removerScreenshot(${index})" title="Remover Imagem">X</button>
        `;
    container.appendChild(div);
  });
}

// Remover uma imagem da lista
window.removerScreenshot = (index) => {
  screenshotsTemporarias.splice(index, 1);
  renderizarMiniaturas();
};

// Abrir a imagem grandona no Visualizador
window.visualizarImagem = (src) => {
  document.getElementById("fullSizeImage").src = src;
  document.getElementById("imageViewerModal").style.display = "flex";
};

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

  // Limpa as screenshots
  screenshotsTemporarias = [];
  renderizarMiniaturas();
}

window.editarTrade = async (id) => {
  // Busca a operação na variável global que já temos
  const trade = todosOsTrades.find((t) => t.id === id);
  if (!trade) return;

  operacaoEditandoId = id; // Avisa o sistema que é uma edição!

  // Preenche campos simples
  document.getElementById("date").value = trade.date;
  document.getElementById("time").value = trade.time;
  // NOVOS CAMPOS (Se o trade antigo não tiver saída, usa a entrada como fallback):
  document.getElementById("exitDate").value = trade.exitDate || trade.date;
  document.getElementById("exitTime").value = trade.exitTime || trade.time;
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

  // Carrega as imagens, se existirem
  screenshotsTemporarias = trade.screenshots ? [...trade.screenshots] : [];
  renderizarMiniaturas();

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

// ================= BOTÃO FLUTUANTE (ABRIR MODAL) =================
document.getElementById("btnFloatingAdd").addEventListener("click", () => {
  // Reseta variáveis caso o usuário tenha clicado em "Editar" antes e cancelado
  operacaoEditandoId = null;
  document.querySelector(".modal-header h2").innerText = "Registrar Operação";

  // Abre o modal
  const modal = document.getElementById("tradeModal");
  if (modal) {
    modal.style.display = "flex";
  }
});

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
    // SALVA AS IMAGENS AQUI:
    screenshots: [...screenshotsTemporarias],
    exitDate: document.getElementById("exitDate").value,
    exitTime: document.getElementById("exitTime").value,
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

// ================= VISUALIZADOR DE TRADES (MODAL RAIO-X) =================

window.abrirVisualizador = (id) => {
  const trade = todosOsTrades.find((t) => t.id === id);
  if (!trade) return;

  // 1. Cálculos e Formatações
  const lucroLiquido = trade.profit - (trade.costs || 0);
  const isGain = lucroLiquido >= 0;

  // 2. Preenche o Cabeçalho
  document.getElementById("viewTicker").innerText = trade.ticker;
  const badge = document.getElementById("viewBadge");
  badge.innerText = isGain ? "Gain" : "Loss";
  badge.className = isGain ? "badge badge-gain" : "badge badge-loss";

  // 3. Preenche Datas e Calcula Duração
  const dIn = trade.date.split("-").reverse().slice(0, 2).join("/");
  const tIn = trade.time;

  // Fallback para trades antigos
  const exitD_raw = trade.exitDate || trade.date;
  const exitT_raw = trade.exitTime || trade.time;

  const dOut = exitD_raw.split("-").reverse().slice(0, 2).join("/");
  const tOut = exitT_raw;

  document.getElementById("viewEntryDateTime").innerText = `${dIn} - ${tIn}`;
  document.getElementById("viewExitDateTime").innerText = `${dOut} - ${tOut}`;

  // Lógica Matemática de Duração
  const start = new Date(`${trade.date}T${trade.time}`);
  const end = new Date(`${exitD_raw}T${exitT_raw}`);
  const diffMs = end - start;

  let durationText = "N/A";
  if (diffMs >= 0) {
    const diffMins = Math.floor(diffMs / 60000);
    const days = Math.floor(diffMins / 1440);
    const hours = Math.floor((diffMins % 1440) / 60);
    const mins = diffMins % 60;

    let partes = [];
    if (days > 0) partes.push(`${days} dia${days > 1 ? "s" : ""}`);
    if (hours > 0) partes.push(`${hours}h`);
    if (mins > 0 || partes.length === 0) partes.push(`${mins} min`);

    durationText = partes.join(" e ");
  }
  document.getElementById("viewDuration").innerText = durationText;

  // 4. Preenche Categoria e Direção
  document.getElementById("viewCategory").innerText =
    trade.category === "futuros" ? "Futuros" : "Ações";

  const dirEl = document.getElementById("viewDirection");
  dirEl.innerText = trade.type;
  dirEl.style.color =
    trade.type === "Compra" ? "var(--profit-green)" : "var(--loss-red)";

  // 4. Preenche o Financeiro
  document.getElementById("viewEntry").innerText =
    trade.entryPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  document.getElementById("viewExit").innerText =
    trade.exitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  document.getElementById("viewCosts").innerText = (
    trade.costs || 0
  ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const profitEl = document.getElementById("viewProfit");
  profitEl.innerText = lucroLiquido.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  profitEl.style.color = isGain ? "var(--profit-green)" : "var(--loss-red)";

  // 5. Preenche o Motivo (Se não tiver, mostra uma mensagem sutil)
  document.getElementById("viewReason").innerText =
    trade.reason || "Nenhuma anotação registrada para esta operação.";

  // 6. Trata as Imagens (Screenshots)
  const screenshotsSection = document.getElementById("viewScreenshotsSection");
  const screenshotsContainer = document.getElementById(
    "viewScreenshotsContainer",
  );
  screenshotsContainer.innerHTML = ""; // Limpa as antigas

  if (trade.screenshots && trade.screenshots.length > 0) {
    screenshotsSection.style.display = "block";
    trade.screenshots.forEach((src) => {
      const div = document.createElement("div");
      div.className = "screenshot-thumb-container";
      // Reaproveita a função visualizarImagem que já criamos antes!
      div.innerHTML = `<img src="${src}" onclick="visualizarImagem('${src}')" title="Clique para ampliar">`;
      screenshotsContainer.appendChild(div);
    });
  } else {
    screenshotsSection.style.display = "none";
  }

  // 7. Mostra o Modal
  document.getElementById("tradeViewerModal").style.display = "flex";
};

window.fecharVisualizador = () => {
  document.getElementById("tradeViewerModal").style.display = "none";
};

// ================= REGRAS DE TRADING =================
let tradingRules = JSON.parse(localStorage.getItem("tradingRules")) || [];

window.abrirModalRegras = () => {
  document.getElementById("rulesModal").style.display = "flex";
  renderizarRegras();
};

function renderizarRegras() {
  const list = document.getElementById("rulesList");
  list.innerHTML = "";

  tradingRules.forEach((rule, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
            <span>🎯 ${rule}</span>
            <button class="btn-delete-rule" onclick="removerRegra(${index})" title="Remover Regra">🗑️</button>
        `;
    list.appendChild(li);
  });

  // Salva automaticamente sempre que renderiza
  localStorage.setItem("tradingRules", JSON.stringify(tradingRules));
}

window.adicionarRegra = () => {
  const input = document.getElementById("newRuleInput");
  const texto = input.value.trim();
  if (texto) {
    tradingRules.push(texto);
    input.value = "";
    renderizarRegras();
  }
};

window.removerRegra = async (index) => {
  const confirmado = await showConfirmDialog(
    "Remover Regra",
    "Deseja excluir esta regra do seu plano de trading?",
    false,
  );
  if (confirmado) {
    tradingRules.splice(index, 1);
    renderizarRegras();
  }
};

// ================= PAINEL DE CONSISTÊNCIA (CALENDÁRIO) =================
// Formato salvo: { "2026-08-01": "success", "2026-08-02": "fail" }
let consistencyData = JSON.parse(localStorage.getItem("consistencyData")) || {};

function renderizarCalendario() {
  const container = document.getElementById("consistencyCalendar");
  container.innerHTML = ""; // Limpa

  // Dias da semana no topo
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  diasSemana.forEach((d) => {
    const div = document.createElement("div");
    div.className = "calendar-header-day";
    div.innerText = d;
    container.appendChild(div);
  });

  // Pega o ano e mês baseado no seletor que já existe (mesVisualizado)
  const [anoStr, mesStr] = mesVisualizado.split("-");
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStr) - 1; // Meses no JS começam no 0

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // Qual dia da semana cai o dia 1?

  // Preenche com blocos vazios até o primeiro dia do mês
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const div = document.createElement("div");
    container.appendChild(div); // Div vazia sem a classe calendar-day
  }

  // Desenha os dias reais do mês
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const div = document.createElement("div");
    div.className = "calendar-day";
    div.innerText = dia;

    // Cria a string da data para buscar/salvar no formato "YYYY-MM-DD"
    const diaStr = dia.toString().padStart(2, "0");
    const dataCompleta = `${mesVisualizado}-${diaStr}`;

    // Colore se tiver status salvo
    const status = consistencyData[dataCompleta];
    if (status === "success") div.classList.add("day-success");
    if (status === "fail") div.classList.add("day-fail");

    // Evento de Clique para alternar o status
    div.onclick = () => alternarStatusDia(dataCompleta, div);

    container.appendChild(div);
  }
}

function alternarStatusDia(dataCompleta, elementoHtml) {
  const statusAtual = consistencyData[dataCompleta];

  // Lógica de alternância: Vazio -> Sucesso -> Falha -> Vazio
  if (!statusAtual) {
    consistencyData[dataCompleta] = "success";
    elementoHtml.classList.add("day-success");
  } else if (statusAtual === "success") {
    consistencyData[dataCompleta] = "fail";
    elementoHtml.classList.remove("day-success");
    elementoHtml.classList.add("day-fail");
  } else {
    delete consistencyData[dataCompleta]; // Remove
    elementoHtml.classList.remove("day-fail");
  }

  // Salva no LocalStorage
  localStorage.setItem("consistencyData", JSON.stringify(consistencyData));
}
