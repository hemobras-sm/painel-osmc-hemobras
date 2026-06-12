const CSV_URL = "https://docs.google.com/spreadsheets/d/1IGkI1foAYcKUYWSF2jknjaqhrDwXHAuJJ_984qGwSJQ/export?format=csv&gid=1142490697";

// INCLUÍDA A COLUNA "PLANTA" NO FINAL
const COLUNAS_DESEJADAS = [
    "Status", "Número da OSMC", "Solicitante", "Bloco", "Piso",
    "Equipamento", "Sala", "Descrição do Problema", "Observação", "Motivo", "Data/hora de fechamento", "Planta"
];

let allData = [];
let filteredData = [];
const rowsPerPage = 50; 
let currentPage = 1;

let osmcChartInstance = null; 
let blocoChartInstance = null;
let plantaChartInstance = null; // Variável atualizada para a Planta

let isTableVisible = false;

const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterSolicitante = document.getElementById('filterSolicitante');
const filterPlanta = document.getElementById('filterPlanta'); // Novo Filtro
const filterBloco = document.getElementById('filterBloco');
const filterMotivo = document.getElementById('filterMotivo');
const btnRefresh = document.getElementById('btnRefresh');

const loadingState = document.getElementById('loadingState');
const dashboardSummary = document.getElementById('dashboardSummary'); 
const kpiCardsContainer = document.getElementById('kpiCardsContainer'); 
const chartsGrid = document.getElementById('chartsGrid');
const tableToggleContainer = document.getElementById('tableToggleContainer');
const btnToggleTable = document.getElementById('btnToggleTable');
const tableSection = document.getElementById('tableSection');

const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const currentPageIndicator = document.getElementById('currentPageIndicator');
const pageInfo = document.getElementById('pageInfo');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const jumpInput = document.getElementById('jumpInput');
const btnJump = document.getElementById('btnJump');

function init() {
    Chart.register(ChartDataLabels);
    fetchData();
    setInterval(() => { fetchData(true); }, 10800000); 
}

btnRefresh.addEventListener('click', () => { fetchData(false); });

btnToggleTable.addEventListener('click', () => {
    isTableVisible = !isTableVisible;
    if(isTableVisible) {
        tableSection.style.display = 'block';
        btnToggleTable.textContent = 'Ocultar Lista de O.S. (Detalhamento)';
        btnToggleTable.style.backgroundColor = '#444'; 
    } else {
        tableSection.style.display = 'none';
        btnToggleTable.textContent = 'Visualizar Lista de O.S. (Detalhamento)';
        btnToggleTable.style.backgroundColor = 'var(--primary-color)'; 
    }
});

function fetchData(isSilentUpdate = false) {
    if (!isSilentUpdate) {
        loadingState.style.display = 'block';
        dashboardSummary.style.display = 'none'; 
        chartsGrid.style.display = 'none';
        tableToggleContainer.style.display = 'none';
        if(isTableVisible) tableSection.style.display = 'none';
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
            dashboardSummary.style.display = 'flex'; 
            chartsGrid.style.display = 'grid';
            tableToggleContainer.style.display = 'block';
            if(isTableVisible) tableSection.style.display = 'block';
        }
    });
}

function popularFiltrosDinamicos() {
    const statusSet = new Set();
    const solicitanteSet = new Set(); 
    const plantaSet = new Set(); // Conjunto para a Planta
    const blocoSet = new Set();
    const motivoSet = new Set();

    allData.forEach(row => {
        if (row[0] !== "-") statusSet.add(row[0]); 
        if (row[2] !== "-") solicitanteSet.add(row[2]); 
        if (row[3] !== "-") blocoSet.add(row[3]); 
        if (row[9] !== "-") motivoSet.add(row[9]); 
        if (row[11] && row[11] !== "-") plantaSet.add(row[11]); // Índice 11 é a Planta
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
    preencherSelect(filterSolicitante, solicitanteSet); 
    preencherSelect(filterPlanta, plantaSet); // Preenche o novo filtro
    preencherSelect(filterBloco, blocoSet);
    preencherSelect(filterMotivo, motivoSet);
}

function aplicarFiltrosGerais() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusFiltro = filterStatus.value;
    const solicitanteFiltro = filterSolicitante.value; 
    const plantaFiltro = filterPlanta.value; // Captura a Planta
    const blocoFiltro = filterBloco.value;
    const motivoFiltro = filterMotivo.value;

    filteredData = allData.filter(row => {
        const passouPesquisa = !searchTerm || 
            (row[1] && row[1].toString().toLowerCase().includes(searchTerm)) || 
            (row[3] && row[3].toString().toLowerCase().includes(searchTerm)) ||
            (row[5] && row[5].toString().toLowerCase().includes(searchTerm));
            
        const passouStatus = !statusFiltro || row[0] === statusFiltro;
        const passouSolicitante = !solicitanteFiltro || row[2] === solicitanteFiltro; 
        const passouPlanta = !plantaFiltro || row[11] === plantaFiltro; // Regra da Planta
        const passouBloco = !blocoFiltro || row[3] === blocoFiltro;
        const passouMotivo = !motivoFiltro || row[9] === motivoFiltro;

        return passouPesquisa && passouStatus && passouSolicitante && passouPlanta && passouBloco && passouMotivo;
    });

    currentPage = 1;
    renderTableBody();
    updatePagination();
    
    atualizarDashboards(); 
}

function getTopNData(dataArray, colIndex, topN) {
    const counts = {};
    dataArray.forEach(row => {
        let val = row[colIndex] ? row[colIndex].toString().trim() : '';
        if (val && val !== '-' && val.toLowerCase() !== 'n/a') {
            counts[val] = (counts[val] || 0) + 1;
        }
    });

    const sorted = Object.keys(counts)
        .map(key => ({ label: key, count: counts[key] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN);

    return {
        labels: sorted.map(item => item.label),
        data: sorted.map(item => item.count)
    };
}

function atualizarDashboards() {
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

    const pieDataLabels = {
        color: '#444444',
        anchor: 'end',
        align: 'end',
        offset: 4,
        font: { weight: 'bold', size: 11, family: "'Inter', sans-serif" },
        formatter: (value, context) => {
            let sum = 0;
            let dataArr = context.chart.data.datasets[0].data;
            dataArr.forEach(data => { sum += data; });
            return value > 0 ? (value * 100 / sum).toFixed(0) + "%" : null;
        }
    };

    const coresBase = ['#155724', '#004085', '#8A151B', '#d39e00', '#6c757d', '#17a2b8', '#343a40', '#28a745'];

    // GRÁFICO 1: Status
    const statusLabels = Object.keys(contagemStatus);
    const statusData = Object.values(contagemStatus);
    const ctxStatus = document.getElementById('osmcChart').getContext('2d');
    
    if (osmcChartInstance) {
        osmcChartInstance.data.labels = statusLabels;
        osmcChartInstance.data.datasets[0].data = statusData;
        osmcChartInstance.update();
    } else {
        osmcChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: { labels: statusLabels, datasets: [{ data: statusData, backgroundColor: coresBase, borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, layout: { padding: 25 }, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: {size: 10} } }, datalabels: pieDataLabels } }
        });
    }

    // GRÁFICO 2: Top 5 Blocos
    const blocoStats = getTopNData(filteredData, 3, 5);
    const ctxBloco = document.getElementById('blocoChart').getContext('2d');
    
    if (blocoChartInstance) {
        blocoChartInstance.data.labels = blocoStats.labels;
        blocoChartInstance.data.datasets[0].data = blocoStats.data;
        blocoChartInstance.update();
    } else {
        blocoChartInstance = new Chart(ctxBloco, {
            type: 'bar',
            data: { labels: blocoStats.labels, datasets: [{ label: 'Qtd de OSMC', data: blocoStats.data, backgroundColor: '#004085' }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                layout: { padding: { top: 25 } }, 
                plugins: { 
                    legend: { display: false }, 
                    datalabels: { color: '#444', anchor: 'end', align: 'end', offset: 4, font: { weight: 'bold', size: 11 } } 
                }, 
                scales: { y: { beginAtZero: true } } 
            }
        });
    }

    // GRÁFICO 3: Planta (Configurado como Pizza)
    const plantaStats = getTopNData(filteredData, 11, 5); // Índice 11 é a Planta
    const ctxPlanta = document.getElementById('plantaChart').getContext('2d');
    
    if (plantaChartInstance) {
        plantaChartInstance.data.labels = plantaStats.labels;
        plantaChartInstance.data.datasets[0].data = plantaStats.data;
        plantaChartInstance.update();
    } else {
        plantaChartInstance = new Chart(ctxPlanta, {
            type: 'pie', // Gráfico de Pizza para diferenciar do Status (Rosca)
            data: { labels: plantaStats.labels, datasets: [{ data: plantaStats.data, backgroundColor: coresBase.slice(1), borderWidth: 1 }] }, // slice(1) para inverter as cores
            options: { responsive: true, maintainAspectRatio: false, layout: { padding: 25 }, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: {size: 10} } }, datalabels: pieDataLabels } }
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
jumpInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') jumpToPage(); });

searchInput.addEventListener('input', aplicarFiltrosGerais);
filterStatus.addEventListener('change', aplicarFiltrosGerais);
filterSolicitante.addEventListener('change', aplicarFiltrosGerais); 
filterPlanta.addEventListener('change', aplicarFiltrosGerais); // Gatilho do novo filtro
filterBloco.addEventListener('change', aplicarFiltrosGerais);
filterMotivo.addEventListener('change', aplicarFiltrosGerais);

document.addEventListener('DOMContentLoaded', init);