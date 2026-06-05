const CSV_URL = "https://docs.google.com/spreadsheets/d/1IGkI1foAYcKUYWSF2jknjaqhrDwXHAuJJ_984qGwSJQ/export?format=csv&gid=1142490697";

const COLUNAS_DESEJADAS = [
    "Status",
    "Número da OSMC",
    "Solicitante",
    "Bloco",
    "Piso",
    "Equipamento",
    "Sala",
    "Descrição do Problema",
    "Observação",
    "Motivo",
    "Data/hora de fechamento"
];

let allData = [];
let filteredData = [];
const rowsPerPage = 50; 
let currentPage = 1;
let osmcChartInstance = null; 

const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterSolicitante = document.getElementById('filterSolicitante'); // Novo elemento
const filterBloco = document.getElementById('filterBloco');
const filterMotivo = document.getElementById('filterMotivo');
const btnRefresh = document.getElementById('btnRefresh');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const tableWrapper = document.getElementById('tableWrapper');
const loadingState = document.getElementById('loadingState');
const paginationContainer = document.getElementById('paginationContainer');
const pageInfo = document.getElementById('pageInfo');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const currentPageIndicator = document.getElementById('currentPageIndicator');
const jumpInput = document.getElementById('jumpInput');
const btnJump = document.getElementById('btnJump');
const dashboardSummary = document.getElementById('dashboardSummary'); 
const kpiCardsContainer = document.getElementById('kpiCardsContainer'); 

function init() {
    Chart.register(ChartDataLabels);
    fetchData();
    setInterval(() => { fetchData(true); }, 10800000); 
}

btnRefresh.addEventListener('click', () => { fetchData(false); });

function fetchData(isSilentUpdate = false) {
    if (!isSilentUpdate) {
        loadingState.style.display = 'block';
        tableWrapper.style.display = 'none';
        paginationContainer.style.display = 'none';
        dashboardSummary.style.display = 'none'; 
    }

    Papa.parse(CSV_URL, {
        download: true,
        header: false,
        skipEmptyLines: true,
        complete: function(results) {
            const rawData = results.data;
            let headerIndex = -1;

            for (let i = 0; i < rawData.length; i++) {
                if (rawData[i].includes("Número da OSMC")) {
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex === -1) {
                if (!isSilentUpdate) loadingState.innerHTML = '<span style="color:red">Erro: Cabeçalho não encontrado.</span>';
                return;
            }

            const headerRow = rawData[headerIndex];
            
            let colIndices = COLUNAS_DESEJADAS.map(colName => {
                let index = headerRow.findIndex(h => h && h.trim().toLowerCase() === colName.toLowerCase());
                if (index === -1) index = headerRow.findIndex(h => h && h.toLowerCase().includes(colName.toLowerCase()));
                if (index === -1 && colName === "Status") {
                    index = headerRow.findIndex(h => h && (h.toLowerCase().includes("pendente") || h.toLowerCase().includes("situação") || h.toLowerCase().includes("status")));
                }
                return index;
            });

            const statusIdx = colIndices[0]; 
            const osmcIdx = colIndices[1];   
            
            allData = [];

            for (let j = headerIndex + 1; j < rawData.length; j++) {
                let row = rawData[j];
                if (!row || row.length === 0 || osmcIdx === -1) continue;

                let osmcVal = row[osmcIdx] ? row[osmcIdx].toString().trim() : "";
                
                let statusVal = (statusIdx !== -1 && row[statusIdx]) ? row[statusIdx].toString().trim() : "";
                let statusValido = statusVal !== "" && statusVal !== "-"; 
                
                let anoValido = false;
                if (osmcVal.includes("2025") || osmcVal.includes("2026") || osmcVal.includes("2027")) {
                    anoValido = true;
                }

                if (osmcVal && osmcVal.includes("/") && osmcVal.toLowerCase() !== "número da osmc" && anoValido && statusValido) {
                    const newRow = colIndices.map(cIdx => {
                        return (cIdx !== -1 && row[cIdx]) ? row[cIdx].toString().trim() : "-";
                    });
                    allData.push(newRow);
                }
            }

            allData.reverse();

            popularFiltrosDinamicos();
            aplicarFiltrosGerais();
            renderTableHeaders();
            
            loadingState.style.display = 'none';
            tableWrapper.style.display = 'block';
            paginationContainer.style.display = 'flex';
            dashboardSummary.style.display = 'flex'; 
        },
        error: function(err) {
            console.error("Erro na leitura do CSV:", err);
            if (!isSilentUpdate) {
                loadingState.innerHTML = '<span style="color:red">Erro de comunicação com a planilha.</span>';
            }
        }
    });
}

function popularFiltrosDinamicos() {
    const statusSet = new Set();
    const solicitanteSet = new Set(); // Novo conjunto para os solicitantes
    const blocoSet = new Set();
    const motivoSet = new Set();

    allData.forEach(row => {
        if (row[0] !== "-") statusSet.add(row[0]); 
        if (row[2] !== "-") solicitanteSet.add(row[2]); // Índice 2 é a coluna Solicitante
        if (row[3] !== "-") blocoSet.add(row[3]); 
        if (row[9] !== "-") motivoSet.add(row[9]); 
    });

    function preencherSelect(selectElement, valoresSet) {
        const valorAtual = selectElement.value;
        const textoPadrao = selectElement.options[0].text;
        selectElement.innerHTML = `<option value="">${textoPadrao}</option>`;
        
        Array.from(valoresSet).sort().forEach(valor => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = valor;
            if (valor === valorAtual) option.selected = true; 
            selectElement.appendChild(option);
        });
    }

    preencherSelect(filterStatus, statusSet);
    preencherSelect(filterSolicitante, solicitanteSet); // Preenche o novo filtro
    preencherSelect(filterBloco, blocoSet);
    preencherSelect(filterMotivo, motivoSet);
}

function aplicarFiltrosGerais() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusFiltro = filterStatus.value;
    const solicitanteFiltro = filterSolicitante.value; // Captura o valor do novo filtro
    const blocoFiltro = filterBloco.value;
    const motivoFiltro = filterMotivo.value;

    filteredData = allData.filter(row => {
        const passouPesquisa = !searchTerm || 
            (row[1] && row[1].toString().toLowerCase().includes(searchTerm)) || 
            (row[3] && row[3].toString().toLowerCase().includes(searchTerm));
            
        const passouStatus = !statusFiltro || row[0] === statusFiltro;
        const passouSolicitante = !solicitanteFiltro || row[2] === solicitanteFiltro; // Aplica a regra na coluna 2
        const passouBloco = !blocoFiltro || row[3] === blocoFiltro;
        const passouMotivo = !motivoFiltro || row[9] === motivoFiltro;

        // Agora exige que o solicitante também bata com a seleção
        return passouPesquisa && passouStatus && passouSolicitante && passouBloco && passouMotivo;
    });

    currentPage = 1;
    renderTableBody();
    updatePagination();
    
    atualizarGraficoEKPIs(); 
}

function atualizarGraficoEKPIs() {
    const contagemStatus = {};
    let resolvidas = 0;
    let pendentes = 0;

    filteredData.forEach(row => {
        let status = row[0] ? row[0].toString().trim() : '';
        if (status && status !== '-') {
            contagemStatus[status] = (contagemStatus[status] || 0) + 1;
            
            let statusMin = status.toLowerCase();
            if (statusMin.includes('aprovado') || statusMin.includes('concluído') || statusMin.includes('concluido') || statusMin.includes('resolvido')) {
                resolvidas++;
            } else {
                pendentes++;
            }
        }
    });

    const coresBase = ['#155724', '#004085', '#6c757d', '#d39e00', '#17a2b8', '#5a6268'];
    const labels = Object.keys(contagemStatus);
    const data = Object.values(contagemStatus);

    kpiCardsContainer.innerHTML = `
        <div class="kpi-card" style="border-left-color: var(--primary-color);">
            <h3>Total Filtrado</h3>
            <p style="color: var(--primary-color)">${filteredData.length}</p>
        </div>
        <div class="kpi-card" style="border-left-color: #155724;">
            <h3>O.S Resolvidas</h3>
            <p style="color: #155724">${resolvidas}</p>
        </div>
        <div class="kpi-card" style="border-left-color: #004085;">
            <h3>O.S Pendentes</h3>
            <p style="color: #004085">${pendentes}</p>
        </div>
    `;

    const ctx = document.getElementById('osmcChart').getContext('2d');
    const coresGrafico = labels.map((_, i) => coresBase[i % coresBase.length]);
    
    if (osmcChartInstance) {
        osmcChartInstance.data.labels = labels;
        osmcChartInstance.data.datasets[0].data = data;
        osmcChartInstance.data.datasets[0].backgroundColor = coresGrafico;
        osmcChartInstance.update();
    } else {
        osmcChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: coresGrafico,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                layout: {
                    padding: 25 
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 11, family: "'Inter', sans-serif" } }
                    },
                    datalabels: {
                        color: '#444444', 
                        anchor: 'end',    
                        align: 'end',     
                        offset: 4,        
                        font: {
                            weight: 'bold',
                            size: 11,
                            family: "'Inter', sans-serif"
                        },
                        formatter: (value, context) => {
                            let sum = 0;
                            let dataArr = context.chart.data.datasets[0].data;
                            dataArr.forEach(data => { sum += data; });
                            let percentage = (value * 100 / sum).toFixed(1) + "%";
                            
                            return value > 0 ? percentage : null;
                        }
                    }
                }
            }
        });
    }
}

function renderTableHeaders() {
    tableHead.innerHTML = '';
    const tr = document.createElement('tr');
    COLUNAS_DESEJADAS.forEach(colName => {
        const th = document.createElement('th');
        th.textContent = colName;
        tr.appendChild(th);
    });
    tableHead.appendChild(tr);
}

function renderTableBody() {
    tableBody.innerHTML = '';
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = filteredData.slice(startIndex, endIndex);

    paginatedItems.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach((cellValue, i) => {
            const td = document.createElement('td');
            let val = cellValue ? cellValue.toString().trim() : '-';

            if (i === 0) {
                let valMin = val.toLowerCase();
                if (valMin.includes('aprovado') || valMin.includes('concluído') || valMin.includes('concluido')) {
                    td.innerHTML = `<span style="background-color: #d4edda; color: #155724; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">${val}</span>`;
                } else if (valMin.includes('certificação') || valMin.includes('aguardando')) {
                    td.innerHTML = `<span style="background-color: #cce5ff; color: #004085; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">${val}</span>`;
                } else {
                    td.textContent = val;
                }
            } else {
                td.textContent = val;
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    currentPageIndicator.textContent = currentPage;
    pageInfo.textContent = `Mostrando ${filteredData.length} registros (Página ${currentPage} de ${totalPages || 1})`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages || totalPages === 0;
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTableBody();
        updatePagination();
    }
}

function jumpToPage() {
    const page = parseInt(jumpInput.value);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTableBody();
        updatePagination();
        jumpInput.value = ''; 
    } else {
        alert(`Por favor, digite uma página válida entre 1 e ${totalPages}`);
    }
}

btnPrev.addEventListener('click', () => changePage(-1));
btnNext.addEventListener('click', () => changePage(1));
btnJump.addEventListener('click', jumpToPage);
jumpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') jumpToPage();
});

searchInput.addEventListener('input', aplicarFiltrosGerais);
filterStatus.addEventListener('change', aplicarFiltrosGerais);
filterSolicitante.addEventListener('change', aplicarFiltrosGerais); // Adicionado ouvinte pro novo filtro
filterBloco.addEventListener('change', aplicarFiltrosGerais);
filterMotivo.addEventListener('change', aplicarFiltrosGerais);

document.addEventListener('DOMContentLoaded', init);