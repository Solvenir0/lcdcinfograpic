document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let drafts = {
        qualifiers: [],
        groups: [],
        playoffs: []
    };
    let currentStage = 'qualifiers';
    let currentTimingSortKey = 'name';
    let currentTimingSortDir = 'asc';
    let currentIdSortKey = 'name';
    let currentIdSortDir = 'asc';
    let masterIDList = [];
    let masterEGOList = [];

    // --- DOM ELEMENT CACHE ---
    const elements = {
        draftStageSelect: document.getElementById('draft-stage-select'),
        draftImportCode: document.getElementById('draft-import-code'),
        draftWinnerSelect: document.getElementById('draft-winner-select'),
        addDraftBtn: document.getElementById('add-draft-btn'),
        analyzeAllBtn: document.getElementById('analyze-all-btn'),
        updateAnalysisBtn: document.getElementById('update-analysis-btn'),
        downloadDataBtn: document.getElementById('download-data-btn'),
        clearAllBtn: document.getElementById('clear-all-btn'),
        draftList: document.getElementById('draft-list'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        qualifiersCount: document.getElementById('qualifiers-count'),
        groupsCount: document.getElementById('groups-count'),
        playoffsCount: document.getElementById('playoffs-count'),
        statsPlaceholder: document.getElementById('stats-placeholder'),
        statsDisplay: document.getElementById('stats-display'),
        totalDraftsAnalyzed: document.getElementById('total-drafts-analyzed'),
        overallStatsGrid: document.getElementById('overall-stats-grid'),
        idSearchInput: document.getElementById('id-search-input'),
        idStatsTableBody: document.querySelector('#id-stats-table tbody'),
        egoSortSelect: document.getElementById('ego-sort-select'),
        egoSearchInput: document.getElementById('ego-search-input'),
        egoStatsTableBody: document.querySelector('#ego-stats-table tbody'),
        pairingIdSelect: document.getElementById('pairing-id-select'),
        pairingResults: document.getElementById('pairing-results'),
        pairingStatsTableBody: document.querySelector('#pairing-stats-table tbody'),
        counterIdSelect: document.getElementById('counter-id-select'),
        counterResults: document.getElementById('counter-results'),
        responsePicksTableBody: document.querySelector('#response-picks-table tbody'),
        strongAgainstTableBody: document.querySelector('#strong-against-table tbody'),
        weakAgainstTableBody: document.querySelector('#weak-against-table tbody'),
        timingStatsTableBody: document.querySelector('#timing-stats-table tbody'),
        loadFileBtn: document.getElementById('load-file-btn'),
        confirmModal: document.getElementById('confirm-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalText: document.getElementById('modal-text'),
        modalConfirmBtn: document.getElementById('modal-confirm-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
    };

    // --- INITIALIZATION ---
    async function initialize() {
        elements.confirmModal.classList.add('hidden'); // Defensively hide modal on startup
        setupEventListeners();
        try {
            processRawData();
        } catch (error) {
            console.error("CRITICAL ERROR: Could not process data.js.", error);
            const header = document.querySelector('header');
            if (header) {
                header.innerHTML = `
                    <h1 style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> FATAL ERROR</h1>
                    <p>Could not load data.js. Please ensure the file is present in the same folder as index.html and is not corrupted.</p>
                `;
            }
            return; // Halt execution
        }
        updateUI();
    }

    function processRawData() {
        masterIDList = parseIDCSV(idCsvData);
        masterEGOList = parseEGOData(egoData);
    }

    function setupEventListeners() {
        elements.addDraftBtn.addEventListener('click', addDraft);
        elements.analyzeAllBtn.addEventListener('click', analyzeAllDrafts);
        elements.updateAnalysisBtn.addEventListener('click', analyzeAllDrafts);
        elements.clearAllBtn.addEventListener('click', () => openConfirmModal('Clear All Data', 'Are you sure you want to delete all imported drafts? This action cannot be undone.', clearAllData));
        elements.downloadDataBtn.addEventListener('click', downloadData);
        elements.loadFileBtn.addEventListener('click', () => loadDraftsFromExistingFolder());
        
        // Pairing analysis
        initializeCustomDropdown(elements.pairingIdSelect);
        elements.pairingIdSelect.addEventListener('change', analyzePairings);
        
        // Counter-pick analysis
        initializeCustomDropdown(elements.counterIdSelect);
        elements.counterIdSelect.addEventListener('change', analyzeCounterPicks);

        // Sortable table headers
        setupTableSorting();

        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentStage = btn.dataset.stage;
                updateUI();
            });
        });

        elements.draftList.addEventListener('click', e => {
            if (e.target.classList.contains('delete-btn')) {
                const index = parseInt(e.target.dataset.index, 10);
                removeDraft(currentStage, index);
            }
        });

        // Sorting and searching listeners
        elements.idSearchInput.addEventListener('input', analyzeAllDrafts);
        elements.egoSortSelect.addEventListener('change', analyzeAllDrafts);
        elements.egoSearchInput.addEventListener('input', analyzeAllDrafts);

        // Draft code input listener to update winner dropdown
        elements.draftImportCode.addEventListener('input', updateWinnerDropdown);

        // Modal listeners
        elements.modalCancelBtn.addEventListener('click', closeConfirmModal);
        elements.modalConfirmBtn.addEventListener('click', () => {
            if (confirmCallback) {
                confirmCallback();
                closeConfirmModal();
            }
        });
    }
    
    // --- DATA PARSING & PREP ---
    function createSlug(name) {
        if (!name) return '';
        let slug = name.toLowerCase();
        slug = slug.replace(/ryōshū/g, 'ryshu').replace(/öufi/g, 'ufi');
        slug = slug.replace(/e\.g\.o::/g, 'ego-');
        slug = slug.replace(/ & /g, ' ').replace(/[.'"]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/[^\w-]+/g, '');
        return slug;
    }

    function parseIDCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.match(regex) || [];
            if (values.length !== headers.length) continue;
            const obj = {};
            headers.forEach((header, idx) => {
                let value = values[idx].trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                obj[header] = value;
            });
            const name = obj.Name;
            const sinnerMatch = name.match(/(Yi Sang|Faust|Don Quixote|Ryōshū|Meursault|Hong Lu|Heathcliff|Ishmael|Rodion|Sinclair|Outis|Gregor)/);
            result.push({
                id: createSlug(name),
                name: name,
                imageFile: `${createSlug(name)}.webp`,
                sinner: sinnerMatch ? sinnerMatch[0] : "Unknown",
            });
        }
        return result;
    }

    function parseEGOData(data) {
        const lines = data.trim().split('\n');
        return lines.map(line => {
            if (!line.includes(' - ')) return null;
            const parts = line.split(' - ');
            if (parts.length < 4) return null;
            const nameAndSinner = parts[0];
            let sinner = "Unknown";
            let name = nameAndSinner;
            for (const s of ["Yi Sang", "Faust", "Don Quixote", "Ryōshū", "Meursault", "Hong Lu", "Heathcliff", "Ishmael", "Rodion", "Sinclair", "Outis", "Gregor"]) {
                if (nameAndSinner.includes(s)) {
                    sinner = s;
                    name = nameAndSinner.replace(s, '').trim();
                    break;
                }
            }
            return {
                id: createSlug(`${name} ${sinner}`),
                name: `${name} (${sinner})`,
            };
        }).filter(Boolean);
    }

    // --- CORE LOGIC ---
    function addDraft() {
        const code = elements.draftImportCode.value.trim();
        const winner = elements.draftWinnerSelect.value;
        
        if (!code) {
            alert("Please paste a draft code.");
            return;
        }

        if (!winner) {
            alert("Please select who won this draft.");
            return;
        }

        try {
            const jsonString = atob(code);
            const draftData = JSON.parse(jsonString);

            if (!draftData.participants || !draftData.draft) {
                throw new Error("Invalid draft data structure.");
            }

            // Add winner information to the draft data
            draftData.winner = winner;
            draftData.winnerName = winner === 'p1' ? 'Left Side' : 'Right Side';

            const stage = elements.draftStageSelect.value;
            const newIndex = drafts[stage].length; // Index for the new draft
            drafts[stage].push(draftData);
            
            // Save individual draft file if directory is available
            if (directoryHandle) {
                saveDraftFile(draftData, stage, newIndex).catch(console.error);
            }
            
            autoSaveDataToFile();
            updateUI();
            elements.draftImportCode.value = '';
            elements.draftWinnerSelect.value = '';
        } catch (error) {
            console.error("Error parsing draft code:", error);
            alert("Invalid or corrupted draft code. Please check the code and try again.");
        }
    }

    function updateWinnerDropdown() {
        const code = elements.draftImportCode.value.trim();
        
        // Always use simple side labels - we don't care about player names
        elements.draftWinnerSelect.innerHTML = `
            <option value="">Select Winner...</option>
            <option value="p1">Left Side</option>
            <option value="p2">Right Side</option>
        `;
    }

    function removeDraft(stage, index) {
        drafts[stage].splice(index, 1);
        autoSaveDataToFile();
        updateUI();
    }
    
    function clearAllData() {
        drafts = { qualifiers: [], groups: [], playoffs: [] };
        autoSaveDataToFile();
        updateUI();
        closeConfirmModal();
        elements.statsDisplay.classList.add('hidden');
        elements.statsPlaceholder.classList.remove('hidden');
    }

    function getFilteredDrafts() {
        const filterQualifiers = document.getElementById('filter-qualifiers').checked;
        const filterGroups = document.getElementById('filter-groups').checked;
        const filterPlayoffs = document.getElementById('filter-playoffs').checked;

        let allDrafts = [];
        
        if (filterQualifiers) {
            allDrafts = [...allDrafts, ...drafts.qualifiers];
        }
        if (filterGroups) {
            allDrafts = [...allDrafts, ...drafts.groups];
        }
        if (filterPlayoffs) {
            allDrafts = [...allDrafts, ...drafts.playoffs];
        }

        return allDrafts;
    }

    function getActiveStageNames() {
        const activeStages = [];
        if (document.getElementById('filter-qualifiers').checked) activeStages.push('Qualifiers');
        if (document.getElementById('filter-groups').checked) activeStages.push('Groups');
        if (document.getElementById('filter-playoffs').checked) activeStages.push('Playoffs/Finals');
        return activeStages;
    }

    // Helper function to get ID image URL
    function getIdImageUrl(id) {
        // Convert ID to filename format (same as your upload folder structure)
        const imageSlug = createSlug(id);
        return `uploads/${imageSlug}.webp`;
    }

    // Custom dropdown functionality
    function initializeCustomDropdown(dropdown) {
        const selected = dropdown.querySelector('.dropdown-selected');
        const options = dropdown.querySelector('.dropdown-options');
        
        selected.addEventListener('click', function() {
            dropdown.classList.toggle('dropdown-open');
            options.style.display = options.style.display === 'none' ? 'block' : 'none';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('dropdown-open');
                options.style.display = 'none';
            }
        });
    }

    function setDropdownValue(dropdown, value, displayText, imageUrl = null) {
        const selected = dropdown.querySelector('.dropdown-selected');
        dropdown.setAttribute('data-value', value);
        
        if (imageUrl) {
            selected.innerHTML = `<span style="display: flex; align-items: center; gap: 10px;"><img src="${imageUrl}" alt="${displayText}" style="width: 24px; height: 24px; border-radius: 4px;"> ${displayText}</span>`;
        } else {
            selected.innerHTML = displayText;
        }
        
        // Close dropdown
        dropdown.classList.remove('dropdown-open');
        dropdown.querySelector('.dropdown-options').style.display = 'none';
        
        // Trigger change event
        const event = new Event('change');
        dropdown.dispatchEvent(event);
    }

    function getDropdownValue(dropdown) {
        return dropdown.getAttribute('data-value') || '';
    }

    function analyzeAllDrafts() {
        const allDrafts = getFilteredDrafts();
        console.log('Analyzing drafts:', allDrafts.length);
        
        if (allDrafts.length === 0) {
            alert("No drafts to analyze. Please add some draft codes or enable stage filters.");
            return;
        }

        elements.statsPlaceholder.classList.add('hidden');
        elements.statsDisplay.classList.remove('hidden');
        
        const activeStages = getActiveStageNames();
        const stageText = activeStages.length > 0 ? ` (${activeStages.join(', ')})` : '';
        elements.totalDraftsAnalyzed.textContent = `${allDrafts.length}${stageText}`;

        // 1. Aggregate all data
        const idStats = {};
        const egoStats = {};
        let totalPicks = 0;
        let totalBans = 0;
        let totalEgoBans = 0;

        masterIDList.forEach(id => {
            idStats[id.id] = { ...id, picks: 0, bans: 0, wins: 0, gamesPlayed: 0 };
        });
        masterEGOList.forEach(ego => {
            egoStats[ego.id] = { ...ego, bans: 0 };
        });

        allDrafts.forEach(data => {
            const draft = data.draft;
            const allPicks = [...draft.picks.p1, ...draft.picks.p2, ...(draft.picks_s2 ? [...draft.picks_s2.p1, ...draft.picks_s2.p2] : [])];
            const allBans = [...draft.idBans.p1, ...draft.idBans.p2];
            const allEgoBans = [...draft.egoBans.p1, ...draft.egoBans.p2];

            // Track picks and games played
            const p1Picks = [...draft.picks.p1, ...(draft.picks_s2 ? draft.picks_s2.p1 : [])];
            const p2Picks = [...draft.picks.p2, ...(draft.picks_s2 ? draft.picks_s2.p2 : [])];
            
            p1Picks.forEach(id => {
                if(idStats[id]) {
                    idStats[id].picks++;
                    idStats[id].gamesPlayed++;
                    if (data.winner === 'p1') {
                        idStats[id].wins++;
                    }
                }
                totalPicks++;
            });
            
            p2Picks.forEach(id => {
                if(idStats[id]) {
                    idStats[id].picks++;
                    idStats[id].gamesPlayed++;
                    if (data.winner === 'p2') {
                        idStats[id].wins++;
                    }
                }
                totalPicks++;
            });

            allBans.forEach(id => {
                if(idStats[id]) idStats[id].bans++;
                totalBans++;
            });
            allEgoBans.forEach(id => {
                if(egoStats[id]) egoStats[id].bans++;
                totalEgoBans++;
            });
        });
        
        // Calculate win rates
        const draftsWithWinners = allDrafts.filter(draft => draft.winner);
        const firstPickWins = allDrafts.filter(draft => draft.winner === 'p1').length;
        const secondPickWins = allDrafts.filter(draft => draft.winner === 'p2').length;
        const totalGamesWithWinners = firstPickWins + secondPickWins;
        
        const winRateStats = {
            totalDraftsWithWinners: draftsWithWinners.length,
            draftsWithoutWinners: allDrafts.length - draftsWithWinners.length,
            firstPickWins,
            secondPickWins,
            firstPickWinRate: totalGamesWithWinners > 0 ? Math.round((firstPickWins / totalGamesWithWinners) * 100) : 0,
            secondPickWinRate: totalGamesWithWinners > 0 ? Math.round((secondPickWins / totalGamesWithWinners) * 100) : 0
        };
        
        // 2. Render Overall Stats
        renderOverallStats({
            totalDrafts: allDrafts.length,
            totalPicks,
            totalBans,
            totalEgoBans,
            ...winRateStats
        });

        // 3. Process and Render ID Stats
        let idArray = Object.values(idStats);

        // Filter out IDs that were never picked or banned
        idArray = idArray.filter(id => id.picks > 0 || id.bans > 0);

        // Search filter
        const idSearchTerm = elements.idSearchInput.value.toLowerCase();
        if (idSearchTerm) {
            idArray = idArray.filter(id => id.name.toLowerCase().includes(idSearchTerm));
        }

        // Sort using header sorting
        const sortedIdArray = sortIdData(idArray, allDrafts.length);

        renderIdStats(sortedIdArray, allDrafts.length);

        // 4. Process and Render EGO Stats
        let egoArray = Object.values(egoStats);

        // Filter out EGOs that were never banned
        egoArray = egoArray.filter(ego => ego.bans > 0);

        // Search filter
        const egoSearchTerm = elements.egoSearchInput.value.toLowerCase();
        if (egoSearchTerm) {
            egoArray = egoArray.filter(ego => ego.name.toLowerCase().includes(egoSearchTerm));
        }
        
        // Sort
        const egoSortKey = elements.egoSortSelect.value;
        egoArray.sort((a, b) => {
            if (egoSortKey === 'name') {
                return a.name.localeCompare(b.name);
            }
            return b.bans - a.bans;
        });

        renderEgoStats(egoArray, allDrafts.length);
        
        // 5. Populate pairing dropdown and analyze timing
        populatePairingDropdown();
        populateCounterDropdown();
        analyzeTimingStats();
    }
    
    function calculateStat(item, key, totalDrafts) {
        switch(key) {
            case 'pickRate': return (item.picks / totalDrafts) || 0;
            case 'banRate': return (item.bans / totalDrafts) || 0;
            case 'presence': return ((item.picks + item.bans) / totalDrafts) || 0;
            case 'winRate': return item.gamesPlayed > 0 ? (item.wins / item.gamesPlayed) : 0;
            default: return 0;
        }
    }


    // --- UI RENDERING ---
    function updateUI() {
        renderDraftList(currentStage);
        updateTabCounts();
        updateActiveTab();
    }

    function updateTabCounts() {
        elements.qualifiersCount.textContent = drafts.qualifiers.length;
        elements.groupsCount.textContent = drafts.groups.length;
        elements.playoffsCount.textContent = drafts.playoffs.length;
    }
    
    function updateActiveTab() {
        elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.stage === currentStage);
        });
    }

    function renderDraftList(stage) {
        const list = drafts[stage];
        elements.draftList.innerHTML = '';

        if (list.length === 0) {
            elements.draftList.innerHTML = '<p class="empty-list">No drafts added for this stage yet.</p>';
            return;
        }

        list.forEach((draft, index) => {
            const p1 = draft.participants.p1.name;
            const p2 = draft.participants.p2.name;
            const winner = draft.winnerName || 'Unknown';
            const winnerIndicator = draft.winner ? `<span class="winner">Winner: ${winner}</span>` : '<span class="no-winner">No winner set</span>';
            
            const item = document.createElement('div');
            item.className = 'draft-item';
            item.innerHTML = `
                <div class="draft-item-info">
                    <div class="draft-title">Draft ${index + 1}: ${p1} vs ${p2}</div>
                    ${winnerIndicator}
                </div>
                <button class="delete-btn" data-index="${index}">&times;</button>
            `;
            elements.draftList.appendChild(item);
        });
    }
    
    function renderOverallStats(stats) {
        const winRatePercentage = stats.totalDrafts > 0 ? 
            Math.round((stats.totalDraftsWithWinners / stats.totalDrafts) * 100) : 0;
            
        elements.overallStatsGrid.innerHTML = `
            <div class="stat-card">
                <div class="value">${stats.totalDrafts}</div>
                <div class="label">Total Drafts</div>
            </div>
            <div class="stat-card">
                <div class="value">${stats.totalDraftsWithWinners}</div>
                <div class="label">Drafts with Winners</div>
            </div>
            <div class="stat-card">
                <div class="value">${winRatePercentage}%</div>
                <div class="label">Win Data Coverage</div>
            </div>
            <div class="stat-card">
                <div class="value">${stats.firstPickWins || 0}</div>
                <div class="label">First Pick Wins</div>
            </div>
            <div class="stat-card">
                <div class="value">${stats.firstPickWinRate || 0}%</div>
                <div class="label">First Pick Win Rate</div>
            </div>
            <div class="stat-card">
                <div class="value">${stats.secondPickWins || 0}</div>
                <div class="label">Second Pick Wins</div>
            </div>
            <div class="stat-card">
                <div class="value">${stats.secondPickWinRate || 0}%</div>
                <div class="label">Second Pick Win Rate</div>
            </div>
            <div class="stat-card">
                <div class="value">${stats.totalPicks}</div>
                <div class="label">Total ID Picks</div>
            </div>
             <div class="stat-card">
                <div class="value">${stats.totalBans}</div>
                <div class="label">Total ID Bans</div>
            </div>
             <div class="stat-card">
                <div class="value">${stats.totalEgoBans}</div>
                <div class="label">Total E.G.O Bans</div>
            </div>
        `;
    }

    function renderIdStats(idArray, totalDrafts) {
        const tbody = elements.idStatsTableBody;
        tbody.innerHTML = '';
        
        idArray.forEach(id => {
            const pickRate = (id.picks / totalDrafts * 100).toFixed(1);
            const banRate = (id.bans / totalDrafts * 100).toFixed(1);
            const presence = ((id.picks + id.bans) / totalDrafts * 100).toFixed(1);
            const winRate = id.gamesPlayed > 0 ? (id.wins / id.gamesPlayed * 100).toFixed(1) : 'N/A';
            const winRateWidth = id.gamesPlayed > 0 ? (id.wins / id.gamesPlayed * 100) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="id-cell">
                        <img src="uploads/${id.imageFile}" alt="${id.name}" onerror="this.style.display='none'">
                        <span>${id.name}</span>
                    </div>
                </td>
                <td>${id.picks}</td>
                <td>${id.bans}</td>
                <td>
                    <div class="rate-bar-container">
                        <div class="rate-bar" style="width: ${pickRate}%; background-color: var(--success);"></div>
                    </div> ${pickRate}%
                </td>
                <td>
                     <div class="rate-bar-container">
                        <div class="rate-bar" style="width: ${banRate}%; background-color: var(--danger);"></div>
                    </div> ${banRate}%
                </td>
                <td>
                     <div class="rate-bar-container">
                        <div class="rate-bar" style="width: ${presence}%; background-color: var(--accent);"></div>
                    </div> ${presence}%
                </td>
                <td>
                    ${id.gamesPlayed > 0 ? `
                        <div class="rate-bar-container">
                            <div class="rate-bar" style="width: ${winRateWidth}%; background-color: var(--primary);"></div>
                        </div> ${winRate}% (${id.wins}/${id.gamesPlayed})
                    ` : 'No win data'}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderEgoStats(egoArray, totalDrafts) {
        const tbody = elements.egoStatsTableBody;
        tbody.innerHTML = '';
        
        egoArray.forEach(ego => {
            const banRate = (ego.bans / totalDrafts * 100).toFixed(1);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong class="ego-cell">${ego.name}</strong></td>
                <td>${ego.bans}</td>
                <td>
                    <div class="rate-bar-container">
                        <div class="rate-bar" style="width: ${banRate}%; background-color: var(--danger);"></div>
                    </div> ${banRate}%
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // --- PAIRING ANALYSIS ---
    function populatePairingDropdown() {
        console.log('Populating pairing dropdown...');
        console.log('Master ID List length:', masterIDList ? masterIDList.length : 'undefined');
        
        if (!masterIDList || masterIDList.length === 0) {
            console.log('Master ID list not loaded yet, skipping dropdown population');
            return;
        }
        
        const dropdown = elements.pairingIdSelect;
        console.log('Dropdown element:', dropdown);
        
        const optionsContainer = dropdown.querySelector('.dropdown-options');
        console.log('Options container:', optionsContainer);
        
        if (!optionsContainer) {
            console.error('Options container not found!');
            return;
        }
        
        optionsContainer.innerHTML = '';
        
        // Reset to default state
        const selected = dropdown.querySelector('.dropdown-selected');
        selected.innerHTML = 'Choose an ID to see pairings...';
        dropdown.setAttribute('data-value', '');
        const pickStats = computePickRateStats();
        if (!pickStats) return;

        // Sort by pickRate DESC then name ASC for stability
        pickStats.sort((a, b) => b.pickRate === a.pickRate ? a.name.localeCompare(b.name) : b.pickRate - a.pickRate);

        pickStats.forEach(stat => {
            const imageUrl = getIdImageUrl(stat.id);
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.innerHTML = `<img src="${imageUrl}" alt="${stat.name}"> ${stat.name} <span style="margin-left:auto;opacity:.7;">${(stat.pickRate*100).toFixed(1)}%</span>`;
            option.addEventListener('click', function() {
                setDropdownValue(dropdown, stat.id, `${stat.name} (${(stat.pickRate*100).toFixed(1)}%)`, imageUrl);
            });
            optionsContainer.appendChild(option);
        });
        console.log('Pairing dropdown populated with', pickStats.length, 'options (sorted by pick rate)');
    }

    function analyzePairings() {
        const selectedId = getDropdownValue(elements.pairingIdSelect);
        if (!selectedId) {
            elements.pairingResults.classList.add('hidden');
            return;
        }

        elements.pairingResults.classList.remove('hidden');
        
        const allDrafts = getFilteredDrafts();
        const pairings = {};
        let totalGamesWithSelectedId = 0;
        let totalWinsWithSelectedId = 0;

        allDrafts.forEach(data => {
            const draft = data.draft;
            const p1Picks = [...draft.picks.p1, ...(draft.picks_s2 ? draft.picks_s2.p1 : [])];
            const p2Picks = [...draft.picks.p2, ...(draft.picks_s2 ? draft.picks_s2.p2 : [])];
            
            // Check if selected ID is in p1 picks
            if (p1Picks.includes(selectedId)) {
                totalGamesWithSelectedId++;
                if (data.winner === 'p1') totalWinsWithSelectedId++;
                
                p1Picks.forEach(id => {
                    if (id !== selectedId) {
                        if (!pairings[id]) pairings[id] = { count: 0, wins: 0 };
                        pairings[id].count++;
                        if (data.winner === 'p1') pairings[id].wins++;
                    }
                });
            }
            
            // Check if selected ID is in p2 picks
            if (p2Picks.includes(selectedId)) {
                totalGamesWithSelectedId++;
                if (data.winner === 'p2') totalWinsWithSelectedId++;
                
                p2Picks.forEach(id => {
                    if (id !== selectedId) {
                        if (!pairings[id]) pairings[id] = { count: 0, wins: 0 };
                        pairings[id].count++;
                        if (data.winner === 'p2') pairings[id].wins++;
                    }
                });
            }
        });

        // Sort by count and take top 5
        const sortedPairings = Object.entries(pairings)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5);

        // Render results
        const tbody = elements.pairingStatsTableBody;
        tbody.innerHTML = '';
        
        sortedPairings.forEach(([id, stats]) => {
            const idData = masterIDList.find(masterID => masterID.id === id);
            const displayName = idData ? idData.name : id;
            const pairingRate = ((stats.count / totalGamesWithSelectedId) * 100).toFixed(1);
            const winRate = stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(1) : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${displayName}</strong></td>
                <td>${stats.count}</td>
                <td>${pairingRate}%</td>
                <td>${winRate}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    // --- TABLE SORTING ---
    function setupTableSorting() {
        // Setup timing table sorting
        const timingHeaders = document.querySelectorAll('#timing-stats-table th.sortable');
        timingHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sort;
                
                // Toggle direction if same column, otherwise start with asc
                if (currentTimingSortKey === sortKey) {
                    currentTimingSortDir = currentTimingSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentTimingSortKey = sortKey;
                    currentTimingSortDir = 'asc';
                }
                
                // Update header visual state
                timingHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                header.classList.add(`sort-${currentTimingSortDir}`);
                
                // Re-render with new sort
                analyzeTimingStats();
            });
        });

        // Setup ID stats table sorting
        const idHeaders = document.querySelectorAll('#id-stats-table th.sortable');
        idHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sort;
                
                // Toggle direction if same column, otherwise start with desc for most columns
                if (currentIdSortKey === sortKey) {
                    currentIdSortDir = currentIdSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentIdSortKey = sortKey;
                    currentIdSortDir = sortKey === 'name' ? 'asc' : 'desc'; // Name starts asc, others start desc
                }
                
                // Update header visual state
                idHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                header.classList.add(`sort-${currentIdSortDir}`);
                
                // Re-render with new sort
                analyzeAllDrafts();
            });
        });
    }

    function sortIdData(idArray, totalDrafts) {
        return idArray.sort((a, b) => {
            let valA, valB;
            
            switch (currentIdSortKey) {
                case 'name':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case 'picks':
                    valA = a.picks;
                    valB = b.picks;
                    break;
                case 'bans':
                    valA = a.bans;
                    valB = b.bans;
                    break;
                case 'pickRate':
                    valA = calculateStat(a, 'pickRate', totalDrafts);
                    valB = calculateStat(b, 'pickRate', totalDrafts);
                    break;
                case 'banRate':
                    valA = calculateStat(a, 'banRate', totalDrafts);
                    valB = calculateStat(b, 'banRate', totalDrafts);
                    break;
                case 'presence':
                    valA = calculateStat(a, 'presence', totalDrafts);
                    valB = calculateStat(b, 'presence', totalDrafts);
                    break;
                case 'winRate':
                    valA = calculateStat(a, 'winRate', totalDrafts);
                    valB = calculateStat(b, 'winRate', totalDrafts);
                    break;
                default:
                    return 0;
            }
            
            if (currentIdSortDir === 'asc') {
                return valA < valB ? -1 : valA > valB ? 1 : 0;
            } else {
                return valA > valB ? -1 : valA < valB ? 1 : 0;
            }
        });
    }

    function sortTimingData(data) {
        return data.sort((a, b) => {
            let valA, valB;
            
            switch (currentTimingSortKey) {
                case 'name':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case 'avgPickPos':
                    valA = a.avgPickPos === 'N/A' ? 999 : parseFloat(a.avgPickPos);
                    valB = b.avgPickPos === 'N/A' ? 999 : parseFloat(b.avgPickPos);
                    break;
                case 'avgBanPos':
                    valA = a.avgBanPos === 'N/A' ? 999 : parseFloat(a.avgBanPos);
                    valB = b.avgBanPos === 'N/A' ? 999 : parseFloat(b.avgBanPos);
                    break;
                case 'pickTendency':
                    const pickOrder = { 'Early': 1, 'Mid': 2, 'Late': 3, 'N/A': 4 };
                    valA = pickOrder[a.pickTendency] || 4;
                    valB = pickOrder[b.pickTendency] || 4;
                    break;
                case 'banTendency':
                    const banOrder = { 'Early': 1, 'Mid': 2, 'Late': 3, 'N/A': 4 };
                    valA = banOrder[a.banTendency] || 4;
                    valB = banOrder[b.banTendency] || 4;
                    break;
                default:
                    return 0;
            }
            
            if (currentTimingSortDir === 'asc') {
                return valA < valB ? -1 : valA > valB ? 1 : 0;
            } else {
                return valA > valB ? -1 : valA < valB ? 1 : 0;
            }
        });
    }

    // --- TIMING ANALYSIS ---
    function analyzeTimingStats() {
        const allDrafts = getFilteredDrafts();
        const timingStats = {};

        allDrafts.forEach(data => {
            const draft = data.draft;
            
            // Use the history array which contains chronological order of all actions
            if (draft.history && draft.history.length > 0) {
                // Track per-player action counts
                const playerPickCounts = { p1: 0, p2: 0 };
                const playerBanCounts = { p1: 0, p2: 0 };
                
                draft.history.forEach((event) => {
                    const playerId = event.player;
                    const targetId = event.targetId;
                    
                    if (!timingStats[targetId]) {
                        timingStats[targetId] = { pickPositions: [], banPositions: [] };
                    }
                    
                    // Record position based on event type and player
                    if (event.type === 'ID_PICK') {
                        playerPickCounts[playerId]++;
                        // Position is per-player (1-12 for each player)
                        timingStats[targetId].pickPositions.push(playerPickCounts[playerId]);
                    } else if (event.type === 'ID_BAN') {
                        playerBanCounts[playerId]++;
                        // Position is per-player (1-7 for each player)
                        timingStats[targetId].banPositions.push(playerBanCounts[playerId]);
                    }
                    // Note: EGO_BAN events are ignored for ID timing analysis
                });
            } else {
                // Fallback to old method if no history available (for backwards compatibility)
                // Calculate per-player positions
                [draft.picks.p1, draft.picks.p2].forEach(playerPicks => {
                    playerPicks.forEach((id, index) => {
                        if (!timingStats[id]) {
                            timingStats[id] = { pickPositions: [], banPositions: [] };
                        }
                        timingStats[id].pickPositions.push(index + 1); // 1-indexed per player
                    });
                });
                
                if (draft.picks_s2) {
                    [draft.picks_s2.p1, draft.picks_s2.p2].forEach(playerPicks => {
                        playerPicks.forEach((id, index) => {
                            if (!timingStats[id]) {
                                timingStats[id] = { pickPositions: [], banPositions: [] };
                            }
                            // Continue counting from where first picks left off
                            const firstPicksLength = draft.picks.p1.length || draft.picks.p2.length || 0;
                            timingStats[id].pickPositions.push(firstPicksLength + index + 1);
                        });
                    });
                }
                
                [draft.idBans.p1, draft.idBans.p2].forEach(playerBans => {
                    playerBans.forEach((id, index) => {
                        if (!timingStats[id]) {
                            timingStats[id] = { pickPositions: [], banPositions: [] };
                        }
                        timingStats[id].banPositions.push(index + 1); // 1-indexed per player
                    });
                });
            }
        });

        // Calculate averages and render - ONLY for IDs that have actual data and sufficient occurrences
        const tbody = elements.timingStatsTableBody;
        tbody.innerHTML = '';
        
        const timingData = Object.entries(timingStats)
            .filter(([id, stats]) => {
                const totalOccurrences = stats.pickPositions.length + stats.banPositions.length;
                return totalOccurrences >= 5; // Must have at least 5 picks/bans combined
            })
            .map(([id, stats]) => {
                const idData = masterIDList.find(masterID => masterID.id === id);
                const displayName = idData ? idData.name : id;
                
                // Calculate averages - only show if there's actual data
                const avgPickPos = stats.pickPositions.length > 0 ? 
                    (stats.pickPositions.reduce((a, b) => a + b, 0) / stats.pickPositions.length).toFixed(1) : 'N/A';
                const avgBanPos = stats.banPositions.length > 0 ? 
                    (stats.banPositions.reduce((a, b) => a + b, 0) / stats.banPositions.length).toFixed(1) : 'N/A';
                
                // Determine tendency (per-player positions: picks 1-12, bans 1-7)
                const pickTendency = avgPickPos !== 'N/A' ? 
                    (avgPickPos <= 4 ? 'Early' : avgPickPos <= 8 ? 'Mid' : 'Late') : 'N/A';
                const banTendency = avgBanPos !== 'N/A' ? 
                    (avgBanPos <= 2 ? 'Early' : avgBanPos <= 4 ? 'Mid' : 'Late') : 'N/A';
                
                return {
                    id,
                    name: displayName,
                    avgPickPos,
                    avgBanPos,
                    pickTendency,
                    banTendency
                };
            });

        // Sort the data
        const sortedData = sortTimingData(timingData);

        // Render sorted data
        sortedData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${item.avgPickPos}</td>
                <td><span class="timing-indicator timing-${item.pickTendency.toLowerCase()}">${item.pickTendency}</span></td>
                <td>${item.avgBanPos}</td>
                <td><span class="timing-indicator timing-${item.banTendency.toLowerCase()}">${item.banTendency}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    // --- COUNTER-PICK ANALYSIS ---
    function populateCounterDropdown() {
        console.log('Populating counter dropdown...');
        console.log('Master ID List length:', masterIDList ? masterIDList.length : 'undefined');
        
        if (!masterIDList || masterIDList.length === 0) {
            console.log('Master ID list not loaded yet, skipping dropdown population');
            return;
        }
        
        const dropdown = elements.counterIdSelect;
        const optionsContainer = dropdown.querySelector('.dropdown-options');
        
        if (!optionsContainer) {
            console.error('Counter options container not found!');
            return;
        }
        
        optionsContainer.innerHTML = '';
        
        // Reset to default state
        const selected = dropdown.querySelector('.dropdown-selected');
        selected.innerHTML = 'Choose an ID to see counter relationships...';
        dropdown.setAttribute('data-value', '');
        const pickStats = computePickRateStats();
        if (!pickStats) return;

        pickStats.sort((a, b) => b.pickRate === a.pickRate ? a.name.localeCompare(b.name) : b.pickRate - a.pickRate);

        pickStats.forEach(stat => {
            const imageUrl = getIdImageUrl(stat.id);
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.innerHTML = `<img src="${imageUrl}" alt="${stat.name}"> ${stat.name} <span style=\"margin-left:auto;opacity:.7;\">${(stat.pickRate*100).toFixed(1)}%</span>`;
            option.addEventListener('click', function() {
                setDropdownValue(dropdown, stat.id, `${stat.name} (${(stat.pickRate*100).toFixed(1)}%)`, imageUrl);
            });
            optionsContainer.appendChild(option);
        });
        console.log('Counter dropdown populated with', pickStats.length, 'options (sorted by pick rate)');
    }

    function analyzeCounterPicks() {
        const selectedId = getDropdownValue(elements.counterIdSelect);
        if (!selectedId) {
            elements.counterResults.classList.add('hidden');
            return;
        }

        elements.counterResults.classList.remove('hidden');
        
        const allDrafts = getFilteredDrafts();
        
        // Track response picks, counter relationships, and performance
        const responsePicks = {};
        const vsMatchups = {}; // selectedId vs other IDs
        
        allDrafts.forEach(data => {
            const draft = data.draft;
            const p1Picks = [...draft.picks.p1, ...(draft.picks_s2 ? draft.picks_s2.p1 : [])];
            const p2Picks = [...draft.picks.p2, ...(draft.picks_s2 ? draft.picks_s2.p2 : [])];
            
            // Find which side has the selected ID
            const selectedOnP1 = p1Picks.includes(selectedId);
            const selectedOnP2 = p2Picks.includes(selectedId);
            
            if (selectedOnP1) {
                // Analyze p2's response picks and matchup performance
                p2Picks.forEach(id => {
                    if (id !== selectedId) {
                        // Response pick tracking
                        if (!responsePicks[id]) responsePicks[id] = { count: 0, wins: 0 };
                        responsePicks[id].count++;
                        if (data.winner === 'p2') responsePicks[id].wins++;
                        
                        // Matchup tracking (selectedId vs this ID)
                        if (!vsMatchups[id]) vsMatchups[id] = { games: 0, selectedWins: 0 };
                        vsMatchups[id].games++;
                        if (data.winner === 'p1') vsMatchups[id].selectedWins++;
                    }
                });
            }
            
            if (selectedOnP2) {
                // Analyze p1's response picks and matchup performance
                p1Picks.forEach(id => {
                    if (id !== selectedId) {
                        // Response pick tracking
                        if (!responsePicks[id]) responsePicks[id] = { count: 0, wins: 0 };
                        responsePicks[id].count++;
                        if (data.winner === 'p1') responsePicks[id].wins++;
                        
                        // Matchup tracking (selectedId vs this ID)
                        if (!vsMatchups[id]) vsMatchups[id] = { games: 0, selectedWins: 0 };
                        vsMatchups[id].games++;
                        if (data.winner === 'p2') vsMatchups[id].selectedWins++;
                    }
                });
            }
        });
        
        // Calculate total games with selected ID
        const totalGamesWithSelected = Object.values(responsePicks).reduce((sum, pick) => sum + pick.count, 0);
        
        // Render Response Picks
        renderResponsePicks(responsePicks, totalGamesWithSelected);
        
        // Render Strong Against / Weak Against
        renderMatchupAnalysis(vsMatchups, selectedId);
    }

    function renderResponsePicks(responsePicks, totalGames) {
        const tbody = elements.responsePicksTableBody;
        tbody.innerHTML = '';
        
        // Sort by response count and take top 10
        const sortedResponses = Object.entries(responsePicks)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 10);
        
        sortedResponses.forEach(([id, stats]) => {
            const idData = masterIDList.find(masterID => masterID.id === id);
            const displayName = idData ? idData.name : id;
            const responseRate = ((stats.count / totalGames) * 100).toFixed(1);
            const successRate = stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(1) : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${displayName}</strong></td>
                <td>${stats.count}</td>
                <td>${responseRate}%</td>
                <td>${successRate}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderMatchupAnalysis(vsMatchups, selectedId) {
        // Separate into strong against and weak against
        const strongAgainst = [];
        const weakAgainst = [];
        
        Object.entries(vsMatchups).forEach(([id, stats]) => {
            if (stats.games >= 2) { // Only include matchups with at least 2 games
                const winRate = (stats.selectedWins / stats.games) * 100;
                const matchupData = {
                    id,
                    games: stats.games,
                    winRate: winRate.toFixed(1),
                    advantage: Math.abs(winRate - 50).toFixed(1)
                };
                
                if (winRate >= 60) {
                    strongAgainst.push(matchupData);
                } else if (winRate <= 40) {
                    weakAgainst.push(matchupData);
                }
            }
        });
        
        // Sort by advantage (how far from 50%)
        strongAgainst.sort((a, b) => b.winRate - a.winRate);
        weakAgainst.sort((a, b) => a.winRate - b.winRate);
        
        // Render Strong Against
        renderMatchupTable(elements.strongAgainstTableBody, strongAgainst, true);
        
        // Render Weak Against
        renderMatchupTable(elements.weakAgainstTableBody, weakAgainst, false);
    }

    function renderMatchupTable(tbody, matchups, isStrongAgainst) {
        tbody.innerHTML = '';
        
        matchups.slice(0, 8).forEach(matchup => {
            const idData = masterIDList.find(masterID => masterID.id === matchup.id);
            const displayName = idData ? idData.name : matchup.id;
            
            let advantageClass = 'advantage-moderate';
            let advantageText = 'Moderate';
            
            if (matchup.advantage >= 25) {
                advantageClass = 'advantage-strong';
                advantageText = 'Strong';
            } else if (matchup.advantage >= 15) {
                advantageClass = 'advantage-moderate';
                advantageText = 'Moderate';
            } else {
                advantageClass = 'advantage-weak';
                advantageText = 'Slight';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${displayName}</strong></td>
                <td>${matchup.games}</td>
                <td>${matchup.winRate}%</td>
                <td><span class="advantage-indicator ${advantageClass}">${advantageText}</span></td>
            `;
            tbody.appendChild(row);
        });
        
        if (matchups.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="4" style="text-align: center; color: #aaa; font-style: italic;">
                    ${isStrongAgainst ? 'No strong advantages found' : 'No significant weaknesses found'} (need more data)
                </td>
            `;
            tbody.appendChild(row);
        }
    }

    // --- PICK RATE UTIL ---
    function computePickRateStats() {
        const allDrafts = getFilteredDrafts();
        const totalDrafts = allDrafts.length;
        if (totalDrafts === 0) return null;

        const pickCounts = {}; // id -> picks
        allDrafts.forEach(data => {
            const draft = data.draft;
            const p1Picks = [...draft.picks.p1, ...(draft.picks_s2 ? draft.picks_s2.p1 : [])];
            const p2Picks = [...draft.picks.p2, ...(draft.picks_s2 ? draft.picks_s2.p2 : [])];
            [...p1Picks, ...p2Picks].forEach(id => {
                pickCounts[id] = (pickCounts[id] || 0) + 1;
            });
        });

        return Object.entries(pickCounts).map(([id, picks]) => {
            const meta = masterIDList.find(m => m.id === id);
            return {
                id,
                name: meta ? meta.name : id,
                picks,
                pickRate: picks / totalDrafts
            };
        });
    }

    // --- FILE STORAGE (Individual JSON Files) ---
    let directoryHandle = null;
    
    // Helper function to sanitize filenames
    function sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').substring(0, 50);
    }
    
    // Parse winner information from filename
    function parseWinnerFromFilename(filename) {
        const winnerMatch = filename.match(/_W-([12])\.json$/);
        if (winnerMatch) {
            const side = winnerMatch[1];
            return side === '1' ? 'p1' : 'p2'; // 1=left side, 2=right side
        }
        return null;
    }
    
    // Generate filename for a draft
    function generateDraftFilename(draft, stage, index) {
        const p1 = sanitizeFilename(draft.participants.p1.name);
        const p2 = sanitizeFilename(draft.participants.p2.name);
        const stagePrefix = stage.charAt(0).toUpperCase();
        const paddedIndex = String(index + 1).padStart(3, '0');
        
        // Add winner to filename using side numbers (1=left side, 2=right side)
        let winnerPart = '';
        if (draft.winner) {
            const winnerSide = draft.winner === 'p1' ? '1' : '2';
            winnerPart = `_W-${winnerSide}`;
        }
        
        return `${stagePrefix}${paddedIndex}_${p1}-vs-${p2}${winnerPart}.json`;
    }
    
    // Save individual draft file
    async function saveDraftFile(draft, stage, index) {
        if (!directoryHandle || !('showDirectoryPicker' in window)) {
            console.log('Directory API not available, falling back to localStorage');
            return false;
        }
        
        try {
            // Create stage subdirectory if it doesn't exist
            let stageDir;
            try {
                stageDir = await directoryHandle.getDirectoryHandle(stage);
            } catch {
                stageDir = await directoryHandle.getDirectoryHandle(stage, { create: true });
            }
            
            const filename = generateDraftFilename(draft, stage, index);
            const fileData = {
                draftCode: btoa(JSON.stringify({
                    participants: draft.participants,
                    draft: draft.draft
                })),
                winner: draft.winner || null,
                winnerName: draft.winnerName || null,
                stage: stage,
                timestamp: new Date().toISOString(),
                playerNames: {
                    p1: draft.participants.p1.name,
                    p2: draft.participants.p2.name
                }
            };
            
            const fileHandle = await stageDir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(fileData, null, 2));
            await writable.close();
            
            console.log(`Draft saved as ${filename}`);
            return true;
        } catch (error) {
            console.error('Error saving draft file:', error);
            return false;
        }
    }
    
    // Save all drafts as individual files
    async function saveDataToFile() {
        try {
            // Request directory access if we don't have it
            if (!directoryHandle && 'showDirectoryPicker' in window) {
                directoryHandle = await window.showDirectoryPicker();
                updateStorageStatus();
            }
            
            if (!directoryHandle) {
                throw new Error('Directory access not available');
            }
            
            let savedCount = 0;
            
            // Save each draft as individual file
            for (const [stage, draftList] of Object.entries(drafts)) {
                for (let i = 0; i < draftList.length; i++) {
                    const success = await saveDraftFile(draftList[i], stage, i);
                    if (success) savedCount++;
                }
            }
            
            console.log(`Successfully saved ${savedCount} draft files`);
            
            // Also save an index file for quick loading
            await saveIndexFile();
            
        } catch (error) {
            console.error('Error saving individual draft files:', error);
            // Fallback to localStorage
            localStorage.setItem('limbusInfographicData', JSON.stringify(drafts));
        }
    }
    
    // Save index file with metadata
    async function saveIndexFile() {
        if (!directoryHandle) return;
        
        try {
            const indexData = {
                lastUpdated: new Date().toISOString(),
                totalDrafts: Object.values(drafts).flat().length,
                stageCount: {
                    qualifiers: drafts.qualifiers.length,
                    groups: drafts.groups.length,
                    playoffs: drafts.playoffs.length
                },
                files: []
            };
            
            // List all draft files for reference
            for (const [stage, draftList] of Object.entries(drafts)) {
                for (let i = 0; i < draftList.length; i++) {
                    const filename = generateDraftFilename(draftList[i], stage, i);
                    indexData.files.push({
                        filename,
                        stage,
                        players: `${draftList[i].participants.p1.name} vs ${draftList[i].participants.p2.name}`,
                        winner: draftList[i].winnerName || 'Unknown'
                    });
                }
            }
            
            const indexHandle = await directoryHandle.getFileHandle('_index.json', { create: true });
            const writable = await indexHandle.createWritable();
            await writable.write(JSON.stringify(indexData, null, 2));
            await writable.close();
            
            console.log('Index file saved');
        } catch (error) {
            console.error('Error saving index file:', error);
        }
    }
    
    // Load all draft files from directory
    async function loadDataFromFile() {
        try {
            if (!('showDirectoryPicker' in window)) {
                throw new Error('Directory API not supported');
            }
            
            directoryHandle = await window.showDirectoryPicker();
            
            // Reset drafts
            drafts = { qualifiers: [], groups: [], playoffs: [] };
            
            updateStorageStatus();
            
            // Load from each stage directory
            for (const stage of ['qualifiers', 'groups', 'playoffs']) {
                try {
                    const stageDir = await directoryHandle.getDirectoryHandle(stage);
                    
                    for await (const [name, handle] of stageDir.entries()) {
                        if (handle.kind === 'file' && name.endsWith('.json') && !name.startsWith('_')) {
                            try {
                                const file = await handle.getFile();
                                const content = await file.text();
                                const fileData = JSON.parse(content);
                                
                                // Reconstruct draft data
                                const draftData = JSON.parse(atob(fileData.draftCode));
                                
                                // Parse winner info from filename (primary source)
                                const winnerFromFilename = parseWinnerFromFilename(name);
                                
                                if (winnerFromFilename) {
                                    // Winner is left side (p1) or right side (p2) based on filename
                                    draftData.winner = winnerFromFilename;
                                    draftData.winnerName = winnerFromFilename === 'p1' ? 'Left Side' : 'Right Side';
                                } else {
                                    // No winner in filename, use JSON data as fallback
                                    draftData.winner = fileData.winner || null;
                                    draftData.winnerName = fileData.winnerName || null;
                                }
                                
                                drafts[stage].push(draftData);
                                console.log(`Loaded ${name} - Winner: ${draftData.winnerName || 'None'} (${draftData.winner || 'N/A'})`);
                            } catch (error) {
                                console.error(`Error loading file ${name}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Stage directory '${stage}' not found, skipping`);
                }
            }
            
            console.log('Draft files loaded successfully');
            console.log(`Total drafts loaded: ${Object.values(drafts).flat().length}`);
            console.log(`Drafts with winners: ${Object.values(drafts).flat().filter(d => d.winner).length}`);
            updateUI();
            return true;
            
        } catch (error) {
            console.error('Error loading draft files:', error);
            
            // Fallback: try localStorage
            const savedData = localStorage.getItem('limbusInfographicData');
            if (savedData) {
                drafts = JSON.parse(savedData);
                console.log('Data loaded from localStorage (fallback)');
                return true;
            }
            return false;
        }
    }

    // Auto-save function that saves individual files
    function autoSaveDataToFile() {
        try {
            // Always save to localStorage as backup
            localStorage.setItem('limbusInfographicData', JSON.stringify(drafts));
            
            // Also try to save individual files if directory is available
            if (directoryHandle) {
                saveDataToFile().catch(console.error);
            }
        } catch (error) {
            console.error('Error in auto-save:', error);
        }
    }
    
    // Load drafts from existing folder (read-only operation)
    async function loadDraftsFromExistingFolder() {
        try {
            if (!('showDirectoryPicker' in window)) {
                throw new Error('Directory API not supported');
            }
            
            const selectedDirectoryHandle = await window.showDirectoryPicker();
            
            // Reset drafts to load fresh data
            drafts = { qualifiers: [], groups: [], playoffs: [] };
            
            // Load from each stage directory
            for (const stage of ['qualifiers', 'groups', 'playoffs']) {
                try {
                    const stageDir = await selectedDirectoryHandle.getDirectoryHandle(stage);
                    
                    for await (const [name, handle] of stageDir.entries()) {
                        if (handle.kind === 'file' && name.endsWith('.json') && !name.startsWith('_')) {
                            try {
                                const file = await handle.getFile();
                                const content = await file.text();
                                const fileData = JSON.parse(content);
                                
                                let draftData;
                                
                                // Handle different JSON file formats
                                if (fileData.draftCode) {
                                    // New format: has draftCode field with base64 data
                                    draftData = JSON.parse(atob(fileData.draftCode));
                                } else if (fileData.participants && fileData.draft) {
                                    // Direct format: the file contains the draft data directly
                                    draftData = fileData;
                                } else {
                                    // Try to detect if this is raw draft data
                                    draftData = fileData;
                                }
                                
                                // Ensure we have the required structure
                                if (!draftData.participants || !draftData.draft) {
                                    console.error(`Invalid draft structure in ${name}`);
                                    continue;
                                }
                                
                                // Parse winner info from filename (primary source)
                                const winnerFromFilename = parseWinnerFromFilename(name);
                                
                                if (winnerFromFilename) {
                                    // Winner is left side (p1) or right side (p2) based on filename
                                    draftData.winner = winnerFromFilename;
                                    draftData.winnerName = winnerFromFilename === 'p1' ? 'Left Side' : 'Right Side';
                                } else {
                                    // No winner in filename, use JSON data as fallback
                                    draftData.winner = fileData.winner || null;
                                    draftData.winnerName = fileData.winnerName || null;
                                }
                                
                                drafts[stage].push(draftData);
                                console.log(`Loaded ${name} - Winner: ${draftData.winnerName || 'None'} (${draftData.winner || 'N/A'})`);
                            } catch (error) {
                                console.error(`Error loading file ${name}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Stage directory '${stage}' not found, skipping`);
                }
            }
            
            console.log('Draft files loaded successfully from existing folder');
            console.log(`Total drafts loaded: ${Object.values(drafts).flat().length}`);
            console.log(`Drafts with winners: ${Object.values(drafts).flat().filter(d => d.winner).length}`);
            updateUI();
            return true;
            
        } catch (error) {
            console.error('Error loading draft files:', error);
            alert('Error loading draft files. Please make sure you selected a folder containing draft JSON files organized in qualifiers/groups/playoffs subfolders.');
            return false;
        }
    }

    // Update storage status display
    function updateStorageStatus() {
        if (directoryHandle) {
            elements.storageStatusText.textContent = 'Connected to folder - drafts will be saved as individual JSON files';
            elements.storageStatus.classList.add('connected');
        } else {
            elements.storageStatusText.textContent = 'No folder selected. Drafts will be saved to browser storage.';
            elements.storageStatus.classList.remove('connected');
        }
    }
    
    // --- DATA EXPORT ---
    function downloadData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(drafts));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "limbus_infographic_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    // --- MODAL LOGIC ---
    let confirmCallback = null;
    function openConfirmModal(title, text, callback) {
        elements.modalTitle.textContent = title;
        elements.modalText.textContent = text;
        confirmCallback = callback;
        elements.confirmModal.classList.remove('hidden');
    }

    function closeConfirmModal() {
        elements.confirmModal.classList.add('hidden');
        confirmCallback = null;
    }

    // --- START THE APP ---
    initialize().catch(console.error);
});

