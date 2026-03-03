const API_URL = "https://script.google.com/macros/s/AKfycbxC0b9N7Ai1gpZBiKki_80A4_Eaj3aB6EkD0xqyi4tCYNLQWnoElfjbtjav7QSE0u3WGw/exec";

// DOM Elements
const scoreForm = document.getElementById('score-form');
const leaderboardList = document.getElementById('leaderboard-list');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();
});

// Tab Switching Logic Removed

// Fetch and Render Leaderboard
async function fetchLeaderboard() {
    if (!leaderboardList) return; // Guard against missing element
    leaderboardList.innerHTML = '<div class="loading">Refreshing scores...</div>';

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // Data is expected to be an array of objects, e.g., [{name: "A", score: 10}, {name: "A", score: 5}]
        // We need to aggregate by name.
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
        const adminList = document.getElementById('admin-player-list');
        if (adminList) adminList.innerHTML = '<div class="loading">Failed to load list.</div>';
    }
}

function renderLeaderboard(players, editable = false) {
    if (!leaderboardList) return;

    if (players.length === 0) {
        leaderboardList.innerHTML = '<div class="loading">No scores yet. Be the first!</div>';
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
            // Using data attributes for event delegation
            // We need to ensure we don't break HTML with quotes in names
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
    document.getElementById('emblem-modal').style.display = 'flex';
};

window.closeEmblemModal = () => {
    currentEmblemTarget = '';
    document.getElementById('emblem-modal').style.display = 'none';
};

window.submitEmblem = async (emblem) => {
    if (!currentEmblemTarget) return;
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
            body: JSON.stringify({ name: name, emblem: emblem, action: 'add_emblem' })
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
    if (confirm(`Are you sure you want to PERMANENTLY DELETE "${name}"?`)) {

        // UI Feedback
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = '⏳';
        btnElement.disabled = true;

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ name: name, score: 0, action: 'delete' })
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
    btn.innerText = "Add to Score (+)";
    btn.classList.remove('set-mode-active');
    document.querySelector('.form-card').style.borderColor = 'var(--glass-border)';
    document.getElementById('player-name').value = '';
    document.getElementById('player-score').value = '';
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

        // Lock UI
        const originalText = primaryBtn.innerText;
        primaryBtn.innerText = "Processing...";
        primaryBtn.disabled = true;

        try {
            // Logic for Delta
            let finalScorePayload = inputScore;

            if (currentAction === 'set') {
                // Calculate difference: Target - Current
                // Example: Current 10. Target 50. Diff 40. New Total = 10 + 40 = 50.
                finalScorePayload = inputScore - editingPlayerScore;

                // Edge case: If I type the same number, diff is 0.
            }

            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ name, score: finalScorePayload, action: currentAction })
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
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}
