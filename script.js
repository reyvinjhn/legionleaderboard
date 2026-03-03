const API_URL = "https://script.google.com/macros/s/AKfycbx-sv0nQvzxMgXY37J_UKTGFyHymMOX7RTREgUoDXSUC5o7PE_yIualu2uqS4CSUhkl/exec";

// DOM Elements
const scoreForm = document.getElementById('score-form');
const leaderboardList = document.getElementById('leaderboard-list');

// --- Dashboard Elements ---
const dashboardView = document.getElementById('dashboard-view');
const managerView = document.getElementById('manager-view');
const boardsList = document.getElementById('boards-list');
const createBoardForm = document.getElementById('create-board-form');
const currentBoardTitle = document.getElementById('current-board-title');
const backBtn = document.getElementById('back-to-dashboard');

let currentBoard = null;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the dashboard/manager page
    if (dashboardView && managerView) {
        fetchBoards();

        // Bind Create Form
        if (createBoardForm) {
            createBoardForm.addEventListener('submit', handleCreateBoard);
        }

        // Bind Back Button
        if (backBtn) {
            backBtn.addEventListener('click', showDashboard);
        }

        // Bind Open Live View Button
        const openLiveBtn = document.getElementById('open-live-view');
        if (openLiveBtn) {
            openLiveBtn.addEventListener('click', () => {
                if (currentBoard) {
                    window.open(`leaderboard.html?board=${encodeURIComponent(currentBoard)}`, '_blank');
                }
            });
        }
    } else {
        // We are probably on the public leaderboard.html display page
        // Check for URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const requestedBoard = urlParams.get('board');

        if (requestedBoard) {
            currentBoard = requestedBoard;
            // Optionally update title if element exists
            const headerTitle = document.querySelector('header h1');
            if (headerTitle) {
                headerTitle.innerText = requestedBoard;
            }
            fetchLeaderboard();
        } else {
            // No board specified on display page
            if (leaderboardList) {
                leaderboardList.innerHTML = '<div class="loading">Please provide a ?board=Name in the URL to view a leaderboard.</div>';
            }
        }
    }
});

// --- Dashboard Logic ---

function showDashboard() {
    dashboardView.style.display = 'block';
    managerView.style.display = 'none';
    currentBoard = null;
    fetchBoards(); // Refresh list when going back
}

function showManager(boardName) {
    currentBoard = boardName;
    currentBoardTitle.innerText = boardName;
    dashboardView.style.display = 'none';
    managerView.style.display = 'block';
    resetFormState();
    fetchLeaderboard();
}

async function fetchBoards() {
    if (!boardsList) return;
    boardsList.innerHTML = '<div class="loading">Loading your leaderboards...</div>';

    try {
        const response = await fetch(`${API_URL}?action=list_boards`);
        const data = await response.json();

        if (data.boards) {
            renderBoards(data.boards);
        } else {
            boardsList.innerHTML = '<div class="loading">No boards found.</div>';
        }
    } catch (error) {
        console.error("Error fetching boards:", error);
        boardsList.innerHTML = '<div class="loading">Failed to load leaderboards.</div>';
    }
}

function renderBoards(boards) {
    if (boards.length === 0) {
        boardsList.innerHTML = '<div class="loading">No leaderboards yet. Create one below!</div>';
        return;
    }

    boardsList.innerHTML = '';
    boards.forEach(boardName => {
        const card = document.createElement('div');
        card.className = 'board-card';
        card.innerHTML = `
            <div class="board-title">${escapeHtml(boardName)}</div>
            <div class="note" style="margin-top: 5px;">Click to manage</div>
            <button class="board-delete-btn" title="Delete Board" onclick="event.stopPropagation(); deleteBoard('${escapeHtml(boardName).replace(/'/g, "\\'")}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        `;
        card.addEventListener('click', () => showManager(boardName));
        boardsList.appendChild(card);
    });
}

async function handleCreateBoard(e) {
    e.preventDefault();
    const input = document.getElementById('new-board-name');
    const boardName = input.value.trim();
    if (!boardName) return;

    const btn = document.getElementById('create-board-btn');
    const originalText = btn.innerText;
    btn.innerText = "Creating...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'create_board', board: boardName })
        });

        // Optimistically wait and refresh
        setTimeout(() => {
            input.value = '';
            btn.innerText = originalText;
            btn.disabled = false;
            fetchBoards();
        }, 1500);

    } catch (error) {
        console.error(error);
        alert("Failed to create board");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function deleteBoard(boardName) {
    if (confirm(`CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE the entire "${boardName}" leaderboard? This cannot be undone.`)) {
        boardsList.innerHTML = `<div class="loading">Deleting ${escapeHtml(boardName)}...</div>`;

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'delete_board', board: boardName })
            });
            setTimeout(fetchBoards, 1500);
        } catch (error) {
            console.error(error);
            alert("Failed to delete board");
            fetchBoards();
        }
    }
}

// --- Specific Board Logic ---

// Fetch and Render Leaderboard
async function fetchLeaderboard() {
    if (!leaderboardList || !currentBoard) return;

    // Only show loading if the list is completely empty, to avoid flashing on auto-refresh
    if (leaderboardList.innerHTML.trim() === '' || leaderboardList.innerHTML.includes('No scores yet') || leaderboardList.innerHTML.includes('Loading scores')) {
        leaderboardList.innerHTML = '<div class="loading">Refreshing scores...</div>';
    }

    try {
        const url = `${API_URL}?board=${encodeURIComponent(currentBoard)}`;
        const response = await fetch(url);

        // Handle no-cors or other silent body issues gracefully
        const textData = await response.text();
        let data = [];
        try {
            data = JSON.parse(textData);
        } catch (e) {
            console.warn("Could not parse JSON. Probably opaque no-cors response. Expected for display.");
            return;
        }

        if (data.error) {
            leaderboardList.innerHTML = `<div class="loading error">${escapeHtml(data.error)}</div>`;
            return;
        }

        // Data is expected to be an array of objects
        const aggregatedScores = {};
        const aggregatedEmblems = {};

        if (Array.isArray(data)) {
            data.forEach(entry => {
                // Normalize name
                if (entry && entry.name) {
                    const nameKey = entry.name.trim();

                    const score = parseInt(entry.score) || 0;

                    if (aggregatedScores[nameKey] !== undefined) {
                        aggregatedScores[nameKey] += score;
                    } else {
                        aggregatedScores[nameKey] = score;
                    }

                    // Emblems
                    if (entry.emblems) {
                        const raw = entry.emblems.toString();
                        if (aggregatedEmblems[nameKey]) {
                            aggregatedEmblems[nameKey] += "," + raw;
                        } else {
                            aggregatedEmblems[nameKey] = raw;
                        }
                    }
                }
            });
        }

        // Convert back to array
        const sortedPlayers = Object.keys(aggregatedScores).map(name => {
            // Clean Emblems
            let uniqueEmblems = [];
            if (aggregatedEmblems[name]) {
                const all = aggregatedEmblems[name].split(',');
                // Unique + Remove empty
                uniqueEmblems = [...new Set(all.map(s => s.trim()).filter(s => s))];
            }

            return {
                name: name,
                score: aggregatedScores[name],
                emblems: uniqueEmblems
            };
        }).sort((a, b) => b.score - a.score); // Descending sort

        // Check if we are on the editable page (index.html) or display page
        const isEditable = !!document.getElementById('score-form');

        renderLeaderboard(sortedPlayers, isEditable);

    } catch (error) {
        console.error("Error fetching data:", error);
        leaderboardList.innerHTML = '<div class="loading">Failed to load scores. Please try again.</div>';
    }
}

function renderLeaderboard(players, editable = false) {
    if (!leaderboardList) return;

    if (players.length === 0) {
        leaderboardList.innerHTML = '<div class="loading">No scores yet in this leaderboard.</div>';
        return;
    }

    leaderboardList.innerHTML = '';

    players.forEach((player, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const editableClass = editable ? 'editable' : '';

        const card = document.createElement('div');
        card.className = `player-card ${rankClass} ${editableClass}`;

        let actionsHtml = '';
        if (editable) {
            // Simple escape for attribute: convert " to &quot;
            const safeName = escapeHtml(player.name).replace(/"/g, '&quot;');

            actionsHtml = `
            <div class="card-actions">
                <button class="icon-btn trophy-icon" data-action="award" data-name="${safeName}" title="Award Emblem">
                   <svg pointer-events="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                </button>
                <button class="icon-btn edit-icon" data-action="edit" data-name="${safeName}" data-score="${player.score}" title="Set Score">
                    <svg pointer-events="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="icon-btn delete-icon" data-action="delete" data-name="${safeName}" title="Delete Player">
                    <svg pointer-events="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>`;
        }

        const emblemsList = player.emblems && player.emblems.length > 0
            ? `<div class="emblems-container">${player.emblems.map(e => `<span class="emblem-badge">${escapeHtml(e)}</span>`).join('')}</div>`
            : '';

        card.innerHTML = `
            <div class="rank">#${rank}</div>
            <div class="player-info">
                <div class="player-name">${escapeHtml(player.name)}</div>
                ${emblemsList}
            </div>
            <div class="score">${player.score}pts</div>
            ${actionsHtml}
        `;

        leaderboardList.appendChild(card);
    });
}

// Event Delegation for Leaderboard Actions
if (leaderboardList) {
    leaderboardList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const name = btn.dataset.name;

        if (!action || !name) return;

        if (action === 'delete') {
            await deletePlayer(name, btn);
        } else if (action === 'edit') {
            const score = btn.dataset.score;
            populateEdit(name, score);
        } else if (action === 'award') {
            openEmblemModal(name);
        }
    });
}

// Stats for Emblems
let currentEmblemTarget = '';

window.openEmblemModal = (name) => {
    currentEmblemTarget = name;
    document.getElementById('modal-player-name').innerText = name;
    const modal = document.getElementById('emblem-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeEmblemModal = () => {
    currentEmblemTarget = '';
    const modal = document.getElementById('emblem-modal');
    if (modal) modal.style.display = 'none';
};

window.submitEmblem = async (emblem) => {
    if (!currentEmblemTarget || !currentBoard) return;
    const name = currentEmblemTarget;

    // Close modal immediately
    closeEmblemModal();

    // Show some loading state?
    leaderboardList.innerHTML = '<div class="loading">Awarding Emblem...</div>';

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ board: currentBoard, name: name, emblem: emblem, action: 'add_emblem' })
        });

        // Loop refresh
        setTimeout(fetchLeaderboard, 1500);

    } catch (e) {
        console.error(e);
        alert("Failed to award emblem.");
        fetchLeaderboard();
    }
};

async function deletePlayer(name, btnElement) {
    if (!currentBoard) return;
    if (confirm(`Are you sure you want to PERMANENTLY DELETE "${name}" from ${currentBoard}?`)) {

        // UI Feedback
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = '⏳';
        btnElement.disabled = true;

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ board: currentBoard, name: name, score: 0, action: 'delete' })
            });

            // Refresh
            setTimeout(() => {
                // If we were editing this user, reset form
                const currentNameInForm = document.getElementById('player-name').value;
                if (currentNameInForm === name) {
                    resetFormState();
                }
                fetchLeaderboard();
            }, 1000);

        } catch (error) {
            console.error("Delete failed", error);
            alert("Delete failed.");
            // Restore icon
            btnElement.innerHTML = originalContent;
            btnElement.disabled = false;
        }
    }
}


// Handle Form Submission
let currentAction = 'add';
let editingPlayerScore = 0; // Store original score for delta calculation

window.populateEdit = (name, score) => {
    // Fill Form
    document.getElementById('player-name').value = name;
    document.getElementById('player-score').value = score;

    // Store original
    editingPlayerScore = score;

    // Switch to Set Mode
    currentAction = 'set';

    const btn = document.getElementById('add-btn');
    btn.innerText = "Set Score (=)";
    btn.classList.add('set-mode-active'); // For styling if needed

    // Visual cue
    document.querySelector('.form-card').style.borderColor = 'var(--accent-color)';

    // Scroll and focus
    document.getElementById('score-form').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('player-score').focus();
};

window.resetFormState = () => {
    currentAction = 'add';
    editingPlayerScore = 0;
    const btn = document.getElementById('add-btn');
    if (btn) {
        btn.innerText = "Add to Score (+)";
        btn.classList.remove('set-mode-active');
    }
    const fc = document.querySelector('.form-card');
    if (fc) fc.style.borderColor = 'var(--glass-border)';

    const pName = document.getElementById('player-name');
    if (pName) pName.value = '';
    const pScore = document.getElementById('player-score');
    if (pScore) pScore.value = '';
};

if (scoreForm) {
    scoreForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('player-name');
        const scoreInput = document.getElementById('player-score');
        const primaryBtn = document.getElementById('add-btn');

        const name = nameInput.value.trim();
        let inputScore = parseInt(scoreInput.value);

        if (!name) {
            alert("Please enter a name.");
            return;
        }
        if (isNaN(inputScore)) {
            alert("Please enter a valid score.");
            return;
        }
        if (!currentBoard) {
            alert("No board selected.");
            return;
        }

        // Lock UI
        const originalText = primaryBtn.innerText;
        primaryBtn.innerText = "Processing...";
        primaryBtn.disabled = true;

        try {
            // Logic for Delta
            let finalScorePayload = inputScore;

            if (currentAction === 'set') {
                // Calculate difference: Target - Current
                finalScorePayload = inputScore - editingPlayerScore;
            }

            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ board: currentBoard, name, score: finalScorePayload, action: currentAction })
            });

            primaryBtn.innerText = "Success!";

            // Refresh
            setTimeout(() => {
                primaryBtn.innerText = originalText;
                primaryBtn.disabled = false;

                // Reset State
                resetFormState();

                fetchLeaderboard();
            }, 1000);

        } catch (error) {
            console.error("Error:", error);
            alert("Action failed!");
            primaryBtn.innerText = originalText;
            primaryBtn.disabled = false;
        }
    });
}

// Helper XSS prevention
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}
