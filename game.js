// Game state
const gameState = {
    currentTeam: 1,
    selectedPlayer: null,
    selectedCell: null,
    actionMode: null, // 'move', 'block', 'blitz', 'pass'
    blitzUsed: false, // Whether blitz action has been used this turn (once per team per turn)
    blitzTarget: null, // { row, col } - target opponent to block after movement in blitz
    passUsed: false, // Whether pass action has been used this turn (once per team per turn)
    passTarget: null, // { row, col } - target teammate to pass to after movement
    players: [],
    board: [],
    boardWidth: 20,
    boardHeight: 11,
    turnNumber: 1,
    scores: { team1: 0, team2: 0 },
    pendingFollowUp: null, // { attacker, defenderOldRow, defenderOldCol }
    ballHolder: null, // Reference to player holding the ball
    ballPosition: null, // { row, col } - position of ball on the ground (null if held by player)
    movementPath: [], // Array of {row, col} for selected movement path
    stoodUpThisMove: null, // { player, standUpCost } - tracks if player stood up during current move action
    gfiSquaresUsed: 0, // Number of "Go For It" squares used in current movement (max 2)
    statusHistory: [], // Array of status messages (last 5)
    pendingBlockRolls: null, // { dice: [roll1, roll2], target, attacker } - stores block dice rolls for selection
    pendingPushSelection: null, // { target, attacker, defenderOldRow, defenderOldCol, shouldKnockDown } - stores push selection state
    removedPlayers: [], // Array of players removed from the board (pushed off)
    setupPhase: true, // Whether we're in setup phase
    setupTeam: 2, // Team currently setting up (defending team sets up first)
    playersToPlace: [], // Array of players that need to be placed during setup
    attackingTeam: 1, // Team that is attacking (gets first turn after setup)
    defendingTeam: 2, // Team that is defending (sets up first)
    originalAttackingTeamForHalf: 1, // Original attacking team at start of current half (used for halftime swap)
    totalTurns: 0, // Total number of turns completed (both teams combined)
    currentHalf: 1, // Current half (1 or 2)
    turnsPerHalf: 8, // Turns per team per half
    turnsInHalf: 0, // Number of turns completed in current half (1-8)
    turnTimer: null, // Timer interval ID
    turnTimeRemaining: 120, // Time remaining in seconds (2 minutes = 120 seconds)
    turnTimerActive: false, // Whether the timer is currently running
    turnEnding: false, // Flag to prevent multiple simultaneous turn ends
    demoMode: false, // Whether we're in a demo (prevents GFI squares from showing)
    pendingPlayerToSelect: null // Player to select after movement completes (when switching players)
};

// Player type configurations
// Each player type has different stats
const PLAYER_TYPES = {
    Lineman: {
        position: 'Lineman',
        letter: 'L',
        movement: 6,
        strength: 3,
        agility: 3,
        armour: 8,
        skills: []
    }
    // Future player types can be added here, e.g.:
    // Blitzer: {
    //     position: 'Blitzer',
    //     letter: 'B',
    //     movement: 7,
    //     strength: 3,
    //     agility: 3,
    //     armour: 8,
    //     skills: ['Block']
    // },
    // Thrower: {
    //     position: 'Thrower',
    //     letter: 'T',
    //     movement: 6,
    //     strength: 3,
    //     agility: 3,
    //     armour: 8,
    //     skills: ['Pass']
    // }
};

// TEMPORARY: Skip setup for testing - set to false to restore setup
const SKIP_SETUP = false;

// Place players in default positions (temporary for testing)
function placePlayersDefault() {
    gameState.players = [];
    gameState.ballHolder = null;
    gameState.ballPosition = null;

    // Team 1 players (left side, endzone at col 0)
    // Middle 6 columns (7-12) are excluded, so Team 1 can use cols 0-6
    // 3 players on column nearest middle (col 6 - last column before exclusion), 1 space apart: rows 3, 5, 7
    gameState.players.push(createPlayer(1, 1, 3, 6));
    gameState.players.push(createPlayer(1, 2, 5, 6));
    gameState.players.push(createPlayer(1, 3, 7, 6));
    // 1 player in middle (row 5), one square from endzone: row 5, col 1
    gameState.players.push(createPlayer(1, 4, 5, 1));
    // 3 players 2 squares behind the first 3: col 4, rows 3, 5, 7
    gameState.players.push(createPlayer(1, 5, 3, 4));
    gameState.players.push(createPlayer(1, 6, 5, 4));
    gameState.players.push(createPlayer(1, 7, 7, 4));

    // Team 2 players (right side, endzone at col 19)
    // Middle 6 columns (7-12) are excluded, so Team 2 can use cols 13-19
    // 3 players on column nearest middle (col 13 - first column after exclusion), 1 space apart: rows 3, 5, 7
    gameState.players.push(createPlayer(2, 1, 3, 13));
    gameState.players.push(createPlayer(2, 2, 5, 13));
    gameState.players.push(createPlayer(2, 3, 7, 13));
    // 1 player in middle (row 5), one square from endzone: row 5, col 18
    gameState.players.push(createPlayer(2, 4, 5, 18));
    // 3 players 2 squares behind the first 3: col 15, rows 3, 5, 7
    gameState.players.push(createPlayer(2, 5, 3, 15));
    gameState.players.push(createPlayer(2, 6, 5, 15));
    gameState.players.push(createPlayer(2, 7, 7, 15));
}

// Initialize game
function initGame() {
    createBoard();

    if (SKIP_SETUP) {
        // TEMPORARY: Skip setup, place players directly
        placePlayersDefault();
        gameState.setupPhase = false;
        gameState.attackingTeam = 1;
        gameState.defendingTeam = 2;
        gameState.originalAttackingTeamForHalf = 1; // Store original attacking team for first half
        gameState.currentTeam = 1;
        gameState.turnNumber = 1;
        gameState.totalTurns = 0;
        gameState.currentHalf = 1;
        gameState.turnsInHalf = 1;

        // Place ball and start kickoff
        startKickoff();
    } else {
        // Normal setup flow
        createPlayersForSetup();
        // Start with coin toss
        startCoinToss();
    }

    updateUI();
    setupEventListeners();
    hideFollowUpButtons();
    hideMovementButtons();
    hideBlockDiceButtons();
    updateTeamControls();
    // Initialize status history
    gameState.statusHistory = [];
    if (!SKIP_SETUP) {
        gameState.totalTurns = 0;
        gameState.currentHalf = 1;
        gameState.turnsInHalf = 0;
    }
}

// Create the game board
function createBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    gameState.board = [];

    for (let row = 0; row < gameState.boardHeight; row++) {
        gameState.board[row] = [];
        for (let col = 0; col < gameState.boardWidth; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Mark endzones (Blood Bowl Sevens: 1 square endzones, rotated 90 degrees)
            if (col === 0) {
                cell.classList.add('endzone', 'team1');
            } else if (col === gameState.boardWidth - 1) {
                cell.classList.add('endzone', 'team2');
            }

            // Track if a double-click is pending to prevent single click from firing
            let doubleClickPending = false;

            // Handle single click (with delay to detect double-click)
            cell.addEventListener('click', () => {
                doubleClickPending = true;
                setTimeout(() => {
                    if (doubleClickPending) {
                        // It was a single click, not a double click
                        doubleClickPending = false;
                        handleCellClick(row, col);
                    }
                }, 250); // Wait 250ms to see if double-click happens
            });

            // Handle double click
            cell.addEventListener('dblclick', (e) => {
                e.preventDefault();
                doubleClickPending = false; // Cancel the single click
                handleCellDoubleClick(row, col);
            });
            board.appendChild(cell);
            gameState.board[row][col] = { cell, player: null };
        }
    }
}

// Create players for setup (7 players per team, not placed on board yet)
function createPlayersForSetup() {
    gameState.players = [];
    gameState.ballHolder = null;
    gameState.ballPosition = null;

    // Create 7 players for Team 1 (not placed on board yet)
    for (let i = 1; i <= 7; i++) {
        const player = createPlayer(1, i, -1, -1); // -1, -1 means not placed yet
        player.placed = false;
        gameState.players.push(player);
    }

    // Create 7 players for Team 2 (not placed on board yet)
    for (let i = 1; i <= 7; i++) {
        const player = createPlayer(2, i, -1, -1); // -1, -1 means not placed yet
        player.placed = false;
        gameState.players.push(player);
    }
}

// Check if a square is in a team's half
function isInTeamHalf(row, col, team) {
    // Middle 6 columns (7-12) are excluded from setup
    const middleStartCol = 7;
    const middleEndCol = 12;

    // Check if column is in the excluded middle area
    if (col >= middleStartCol && col <= middleEndCol) {
        return false;
    }

    const midCol = Math.floor(gameState.boardWidth / 2);
    if (team === 1) {
        // Team 1's half is left side (cols 0 to midCol-1), excluding middle
        return col < midCol;
    } else {
        // Team 2's half is right side (cols midCol to boardWidth-1), excluding middle
        return col >= midCol;
    }
}

// Start setup phase
function startSetupPhase() {
    gameState.setupPhase = true;
    gameState.setupTeam = gameState.defendingTeam; // Defending team sets up first
    gameState.currentTeam = gameState.defendingTeam;

    // Reset all players to not placed
    gameState.players.forEach(player => {
        player.placed = false;
        player.row = -1;
        player.col = -1;
    });

    // Get players for current setup team
    gameState.playersToPlace = gameState.players.filter(p => p.team === gameState.setupTeam);

    const teamLabel = gameState.setupTeam === gameState.defendingTeam ? 'Defending' : 'Attacking';
    updateStatus(`Setup Phase: Team ${gameState.setupTeam} (${teamLabel}) - Place your 7 players in your half. Click on squares in your half to place players.`);
    highlightSetupArea();
    updatePlayerBoxes();
}

// Highlight the setup area (team's half)
function highlightSetupArea() {
    // Clear previous highlights
    document.querySelectorAll('.setup-area').forEach(cell => {
        cell.classList.remove('setup-area');
    });

    // Highlight squares in the setup team's half
    for (let row = 0; row < gameState.boardHeight; row++) {
        for (let col = 0; col < gameState.boardWidth; col++) {
            if (isInTeamHalf(row, col, gameState.setupTeam)) {
                const cell = gameState.board[row][col].cell;
                // Only highlight if square is empty
                if (!gameState.board[row][col].player) {
                    cell.classList.add('setup-area');
                }
            }
        }
    }
}

// Place a player during setup
function placePlayerInSetup(row, col) {
    // Check if square is in setup team's half
    if (!isInTeamHalf(row, col, gameState.setupTeam)) {
        updateStatus(`You can only place players in your half!`);
        return;
    }

    // Check if square is occupied
    if (gameState.board[row][col].player) {
        updateStatus(`That square is already occupied!`);
        return;
    }

    // Find next unplaced player for this team
    const unplacedPlayer = gameState.playersToPlace.find(p => !p.placed);

    if (!unplacedPlayer) {
        updateStatus(`All players for Team ${gameState.setupTeam} have been placed!`);
        return;
    }

    // Place the player
    unplacedPlayer.row = row;
    unplacedPlayer.col = col;
    unplacedPlayer.placed = true;

    // Update board
    gameState.board[row][col].player = unplacedPlayer;

    // Create visual element
    const cell = gameState.board[row][col].cell;
    const playerElement = document.createElement('div');
    playerElement.className = `player team${unplacedPlayer.team}`;
    playerElement.textContent = unplacedPlayer.positionLetter;
    playerElement.dataset.playerId = unplacedPlayer.id;

    // Show stats on hover
    playerElement.addEventListener('mouseenter', () => {
        showPlayerStats(unplacedPlayer);
    });

    playerElement.addEventListener('mouseleave', () => {
        hidePlayerStats(unplacedPlayer.team);
    });

    // Add click event listener for selection (only works after setup)
    playerElement.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!gameState.setupPhase) {
            selectPlayer(unplacedPlayer);
        }
    });

    cell.appendChild(playerElement);

    // Update highlight area (remove this square from highlights)
    cell.classList.remove('setup-area');

    // Check if all players for this team are placed
    const allPlaced = gameState.playersToPlace.every(p => p.placed);

    if (allPlaced) {
        // Clear setup highlights
        document.querySelectorAll('.setup-area').forEach(cell => {
            cell.classList.remove('setup-area');
        });

        if (gameState.setupTeam === gameState.defendingTeam) {
            // Defending team done, now attacking team sets up
            gameState.setupTeam = gameState.attackingTeam;
            gameState.currentTeam = gameState.attackingTeam;
            gameState.playersToPlace = gameState.players.filter(p => p.team === gameState.attackingTeam);
            updateStatus(`Setup Phase: Team ${gameState.setupTeam} (Attacking) - Place your 7 players in your half.`);
            highlightSetupArea();
            updatePlayerBoxes();
        } else {
            // Both teams done, start the game
            completeSetup();
        }
    } else {
        const remaining = gameState.playersToPlace.filter(p => !p.placed).length;
        updateStatus(`Player ${unplacedPlayer.number} placed! ${remaining} player${remaining !== 1 ? 's' : ''} remaining for Team ${gameState.setupTeam}.`);

        // Update highlight area (remove placed square from highlights)
        highlightSetupArea();
    }

    // Update player boxes (remove placed player from box)
    updatePlayerBoxes();
    updateUI();
}

// Update player boxes to show unplaced/removed players
function updatePlayerBoxes() {
    // Update Team 1 box
    const team1Box = document.getElementById('player-box-content-team1');
    team1Box.innerHTML = '';

    const team1Unplaced = gameState.players.filter(p =>
        p.team === 1 && (!p.placed || p.removedFromBoard)
    );

    team1Unplaced.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-box-item team1`;
        playerElement.textContent = player.positionLetter;
        playerElement.dataset.playerId = player.id;

        // Show stats on hover
        playerElement.addEventListener('mouseenter', () => {
            showPlayerStats(player);
        });

        playerElement.addEventListener('mouseleave', () => {
            hidePlayerStats(player.team);
        });

        team1Box.appendChild(playerElement);
    });

    // Update Team 2 box
    const team2Box = document.getElementById('player-box-content-team2');
    team2Box.innerHTML = '';

    const team2Unplaced = gameState.players.filter(p =>
        p.team === 2 && (!p.placed || p.removedFromBoard)
    );

    team2Unplaced.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-box-item team2`;
        playerElement.textContent = player.positionLetter;
        playerElement.dataset.playerId = player.id;

        // Show stats on hover
        playerElement.addEventListener('mouseenter', () => {
            showPlayerStats(player);
        });

        playerElement.addEventListener('mouseleave', () => {
            hidePlayerStats(player.team);
        });

        team2Box.appendChild(playerElement);
    });

    // Show/hide boxes based on whether there are unplaced players
    const team1BoxContainer = document.getElementById('player-box-team1');
    const team2BoxContainer = document.getElementById('player-box-team2');

    if (team1Unplaced.length > 0) {
        team1BoxContainer.style.display = 'block';
    } else {
        team1BoxContainer.style.display = 'none';
    }

    if (team2Unplaced.length > 0) {
        team2BoxContainer.style.display = 'block';
    } else {
        team2BoxContainer.style.display = 'none';
    }
}

// Complete setup and start the game
function completeSetup() {
    gameState.setupPhase = false;

    // Remove any players that weren't placed (shouldn't happen, but safety check)
    gameState.players = gameState.players.filter(p => p.placed);

    // Clear setup highlights
    document.querySelectorAll('.setup-area').forEach(cell => {
        cell.classList.remove('setup-area');
    });

    // Set current team to attacking team (they get the first turn)
    gameState.currentTeam = gameState.attackingTeam;
    // Store the original attacking team for this half (used for halftime swap)
    gameState.originalAttackingTeamForHalf = gameState.attackingTeam;
    gameState.turnNumber = 1;
    gameState.totalTurns = 0; // Reset total turns for new half
    gameState.turnsInHalf = 1; // Start at turn 1 for the half

    // Start kickoff (shows overlay, places ball, scatters)
    startKickoff();
}

// Show coin toss overlay
function showCoinTossOverlay() {
    const overlay = document.getElementById('coin-toss-overlay');
    overlay.classList.add('show');
}

// Hide coin toss overlay
function hideCoinTossOverlay() {
    const overlay = document.getElementById('coin-toss-overlay');
    overlay.classList.remove('show');
}

// Start coin toss sequence
function startCoinToss() {
    // Show coin toss overlay
    showCoinTossOverlay();

    // Perform coin toss (50/50 chance)
    const coinFlip = Math.random() < 0.5;
    const winner = coinFlip ? 1 : 2;

    // Update overlay with result
    const coinResult = document.getElementById('coin-toss-result');
    const coinWinner = document.getElementById('coin-toss-winner');

    coinResult.textContent = coinFlip ? '🪙 Heads' : '🪙 Tails';
    coinWinner.textContent = `Team ${winner} wins! Team ${winner} will attack first.`;

    // Set attacking and defending teams based on coin toss
    gameState.attackingTeam = winner;
    gameState.defendingTeam = winner === 1 ? 2 : 1;

    // After 1.5 seconds, hide overlay and start setup
    setTimeout(() => {
        hideCoinTossOverlay();
        startSetupPhase();
    }, 1500);
}

// Show half-time overlay
function showHalftimeOverlay() {
    const overlay = document.getElementById('halftime-overlay');
    overlay.classList.add('show');
}

// Hide half-time overlay
function hideHalftimeOverlay() {
    const overlay = document.getElementById('halftime-overlay');
    overlay.classList.remove('show');
}

// Handle half-time transition
function handleHalftime() {
    // Stop the turn timer
    stopTurnTimer();

    // Show half-time overlay
    showHalftimeOverlay();

    // Remove all players and ball from the board
    removeAllPlayersAndBall();

    // Swap attacking and defending teams based on who originally attacked first in the first half
    // The team that originally attacked first in first half should defend first in second half
    const originalAttacker = gameState.originalAttackingTeamForHalf;
    const originalDefender = originalAttacker === 1 ? 2 : 1;

    // Set teams for second half: original attacker becomes defender, original defender becomes attacker
    gameState.attackingTeam = originalDefender;
    gameState.defendingTeam = originalAttacker;
    gameState.originalAttackingTeamForHalf = originalDefender; // Store for potential future use

    // Set current team to the new attacking team (they start the second half)
    gameState.currentTeam = gameState.attackingTeam;

    // Move to second half
    gameState.currentHalf = 2;
    gameState.totalTurns = 0; // Reset turn counter for second half
    gameState.turnsInHalf = 1; // Start at turn 1 for the half

    // After 1.5 seconds, hide overlay and start setup phase
    setTimeout(() => {
        hideHalftimeOverlay();
        if (SKIP_SETUP) {
            // TEMPORARY: Skip setup, place players directly
            placePlayersDefault();
            gameState.setupPhase = false;
            // originalAttackingTeamForHalf is already set above
            startKickoff();
        } else {
            startSetupPhase();
        }
    }, 1500);
}

// Show game over overlay
function showGameOverOverlay() {
    const overlay = document.getElementById('game-over-overlay');
    overlay.classList.add('show');
}

// Hide game over overlay
function hideGameOverOverlay() {
    const overlay = document.getElementById('game-over-overlay');
    overlay.classList.remove('show');
}

// Handle game over
function handleGameOver() {
    // Stop the turn timer
    stopTurnTimer();

    const team1Score = gameState.scores.team1;
    const team2Score = gameState.scores.team2;

    // Update overlay with final scores
    const gameOverScore = document.getElementById('game-over-score');
    const gameOverWinner = document.getElementById('game-over-winner');

    gameOverScore.textContent = `Final Score: Team 1 - ${team1Score} | Team 2 - ${team2Score}`;

    // Determine winner or draw
    if (team1Score > team2Score) {
        gameOverWinner.textContent = `Team 1 Wins! 🏆`;
    } else if (team2Score > team1Score) {
        gameOverWinner.textContent = `Team 2 Wins! 🏆`;
    } else {
        gameOverWinner.textContent = `What a boring game - It's a draw! 🤷`;
    }

    // Show game over overlay
    showGameOverOverlay();

    // Disable all game controls
    disableAllGameControls();
}

// Disable all game controls when game is over
function disableAllGameControls() {
    // Disable end turn buttons
    const team1EndBtn = document.getElementById('end-turn-team1');
    const team2EndBtn = document.getElementById('end-turn-team2');
    if (team1EndBtn) team1EndBtn.disabled = true;
    if (team2EndBtn) team2EndBtn.disabled = true;

    // Disable action buttons
    const blockBtn = document.getElementById('btn-block');
    const passBtn = document.getElementById('btn-pass');
    if (blockBtn) blockBtn.disabled = true;
    if (passBtn) passBtn.disabled = true;

    // Clear any selected player
    gameState.selectedPlayer = null;
    gameState.actionMode = null;
    clearValidMoves();
    updateUI();
}

// Show kickoff overlay
function showKickoffOverlay() {
    const overlay = document.getElementById('kickoff-overlay');
    overlay.classList.add('show');
}

// Hide kickoff overlay
function hideKickoffOverlay() {
    const overlay = document.getElementById('kickoff-overlay');
    overlay.classList.remove('show');
}

// Start kickoff sequence
function startKickoff() {
    // Show kickoff overlay
    showKickoffOverlay();

    // After 1.5 seconds, perform kickoff
    setTimeout(() => {
        hideKickoffOverlay();
        performKickoff();
    }, 1500);
}

// Perform kickoff: place ball in middle of attacker's half and scatter 1-4 squares
function performKickoff() {
    // Calculate middle of attacker's half
    const midRow = Math.floor(gameState.boardHeight / 2);
    let midCol;

    if (gameState.attackingTeam === 1) {
        // Team 1's half is left side (cols 0-9), middle is around col 4-5
        midCol = Math.floor((gameState.boardWidth / 2) / 2); // Middle of left half
    } else {
        // Team 2's half is right side (cols 10-19), middle is around col 14-15
        midCol = Math.floor(gameState.boardWidth / 2) + Math.floor((gameState.boardWidth / 2) / 2);
    }

    // Scatter ball 1-4 squares in random direction from center of attacker's half
    // Roll D4 to determine distance (1-4 squares)
    const scatterDistance = Math.floor(Math.random() * 4) + 1;
    // (ball is placed at the scattered position, not before scatter)
    scatterBallDirection(midRow, midCol, scatterDistance);

    updateStatus(`Kickoff! Ball placed and scattered. Half ${gameState.currentHalf} - Turn ${gameState.turnsInHalf} - Team ${gameState.currentTeam}'s turn. Select a player to begin.`);
    updateUI();
    updateActionButtons();
    updatePlayerBoxes();
}

// Scatter ball in a random direction for a specific number of squares
function scatterBallDirection(originRow, originCol, distance, originalTeam = null, ballHolderKnockedDown = false) {
    // Roll D8 to determine scatter direction (8 directions)
    const directionRoll = Math.floor(Math.random() * 8) + 1;

    // 8 directions: N, NE, E, SE, S, SW, W, NW
    const directions = [
        { row: -1, col: 0 },   // 1 - North
        { row: -1, col: 1 },   // 2 - Northeast
        { row: 0, col: 1 },    // 3 - East
        { row: 1, col: 1 },    // 4 - Southeast
        { row: 1, col: 0 },    // 5 - South
        { row: 1, col: -1 },   // 6 - Southwest
        { row: 0, col: -1 },   // 7 - West
        { row: -1, col: -1 }   // 8 - Northwest
    ];

    const direction = directions[directionRoll - 1];

    // Calculate final position (distance squares in that direction)
    const finalRow = originRow + (direction.row * distance);
    const finalCol = originCol + (direction.col * distance);

    // Clamp to board bounds
    const clampedRow = Math.max(0, Math.min(gameState.boardHeight - 1, finalRow));
    const clampedCol = Math.max(0, Math.min(gameState.boardWidth - 1, finalCol));

    // Remove ball from previous position if it exists
    if (gameState.ballPosition) {
        const prevBallCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
        const prevBallOnGround = prevBallCell.cell.querySelector('.ball-on-ground');
        if (prevBallOnGround) {
            prevBallOnGround.remove();
        }
    }

    // Place ball at final position
    gameState.ballPosition = { row: clampedRow, col: clampedCol };
    const ballCell = gameState.board[clampedRow][clampedCol];

    // Add ball visual
    const ballOnGround = document.createElement('div');
    ballOnGround.className = 'ball-on-ground';
    ballOnGround.textContent = '🏈';
    ballCell.cell.appendChild(ballOnGround);

    // Check if a player is on that square
    if (ballCell.player) {
        if (ballCell.player.knockedDown) {
            // Ball landed on knocked down player - scatter again 1 square
            updateStatus(`Ball scattered ${distance} squares ${getDirectionName(directionRoll)}! Ball landed on knocked down player ${ballCell.player.id}. Ball scatters again 1 square.`);
            scatterBallDirection(clampedRow, clampedCol, 1, originalTeam, ballHolderKnockedDown);
            return;
        } else {
            // Standing player - they attempt to catch/pick it up
            // If this is from kickoff (originalTeam is null and ballHolderKnockedDown is false), use kickoff catch logic
            if (originalTeam === null && !ballHolderKnockedDown) {
                attemptBallCatchOnKickoff(ballCell.player, clampedRow, clampedCol);
            } else {
                // Otherwise, use normal pickup logic
                attemptBallPickupOnScatter(ballCell.player, clampedRow, clampedCol, null, originalTeam, ballHolderKnockedDown);
            }
        }
    } else {
        // Ball landed on unoccupied square
        updateStatus(`Ball scattered ${distance} squares ${getDirectionName(directionRoll)}! Ball is now at (${clampedRow}, ${clampedCol}).`);

        // End turn only if this was from a pickup attempt (not if ball-holder was knocked down)
        // If ball-holder was knocked down, turn only ends if a player fails to catch the ball
        // If ball lands on unoccupied square, it just sits there (no turnover)
        if (originalTeam !== null && !ballHolderKnockedDown) {
            updateStatus(`Ball landed on unoccupied square. Turn ends.`);
            endTurn(true, 'Ball landed on unoccupied square'); // Automatic turnover
        }
    }
}

// Get direction name for display
function getDirectionName(directionRoll) {
    const names = ['', 'North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return names[directionRoll] || '';
}

// Attempt to catch the ball on kickoff (turn doesn't end if dropped)
function attemptBallCatchOnKickoff(player, ballRow, ballCol) {
    if (player.hasBall || !gameState.ballPosition) {
        return;
    }

    // Check if ball is at player's position
    if (gameState.ballPosition.row !== ballRow ||
        gameState.ballPosition.col !== ballCol) {
        return;
    }

    // Count tackle zones at ball position (each adds -1 modifier = +1 to target)
    const tackleZones = countTackleZonesInSquare(ballRow, ballCol, player.team);
    const tackleZoneModifier = tackleZones; // Each tackle zone adds +1 to target number

    // Roll D6 for catch attempt (using agility)
    const roll = rollDice();
    const agility = player.agility;
    const targetNumber = getPickupTargetNumber(agility, tackleZoneModifier);
    const success = isPickupSuccessful(roll, agility, tackleZoneModifier);

    if (success) {
        // Successful catch
        giveBallToPlayer(player);
        const modifierText = tackleZones > 0 ? ` (${tackleZones} tackle zone${tackleZones > 1 ? 's' : ''} = +${tackleZones} modifier)` : '';
        updateStatus(`Ball scattered to (${ballRow}, ${ballCol})! Player ${player.number} attempts catch: Rolled ${roll} (needed ${targetNumber}+${modifierText}, 1 always fails, 6 always succeeds). Success! Player ${player.number} has the ball!`);
    } else {
        // Failed catch - ball scatters again (turn doesn't end on kickoff)
        const modifierText = tackleZones > 0 ? ` (${tackleZones} tackle zone${tackleZones > 1 ? 's' : ''} = +${tackleZones} modifier)` : '';
        updateStatus(`Ball scattered to (${ballRow}, ${ballCol})! Player ${player.number} attempts catch: Rolled ${roll} (needed ${targetNumber}+${modifierText}, 1 always fails, 6 always succeeds). Failed! Ball scatters again...`);

        // Scatter the ball again from current position using normal scatter (D9)
        // Pass special flag to indicate this is kickoff scatter (don't end turn)
        scatterBallOnKickoff(ballRow, ballCol);
    }
}

// Scatter ball on kickoff (recursive - continues until caught or lands on empty square)
function scatterBallOnKickoff(originRow, originCol) {
    // Use normal D9 scatter
    const roll = rollD9();

    // D9 scatter directions (same as normal scatter)
    const directions = [
        { row: 0, col: 0 },      // 1 - same square
        { row: -1, col: -1 },     // 2 - top-left
        { row: -1, col: 0 },      // 3 - top
        { row: -1, col: 1 },     // 4 - top-right
        { row: 0, col: -1 },     // 5 - left
        { row: 0, col: 1 },      // 6 - right
        { row: 1, col: -1 },     // 7 - bottom-left
        { row: 1, col: 0 },      // 8 - bottom
        { row: 1, col: 1 }       // 9 - bottom-right
    ];

    const direction = directions[roll - 1];
    if (!direction) return;

    const newRow = originRow + direction.row;
    const newCol = originCol + direction.col;

    // Clamp to board bounds
    const clampedRow = Math.max(0, Math.min(gameState.boardHeight - 1, newRow));
    const clampedCol = Math.max(0, Math.min(gameState.boardWidth - 1, newCol));

    // Remove ball from previous position
    if (gameState.ballPosition) {
        const prevBallCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
        const prevBallOnGround = prevBallCell.cell.querySelector('.ball-on-ground');
        if (prevBallOnGround) {
            prevBallOnGround.remove();
        }
    }

    // Place ball at new position
    gameState.ballPosition = { row: clampedRow, col: clampedCol };
    const ballCell = gameState.board[clampedRow][clampedCol];

    // Add ball visual
    const ballOnGround = document.createElement('div');
    ballOnGround.className = 'ball-on-ground';
    ballOnGround.textContent = '🏈';
    ballCell.cell.appendChild(ballOnGround);

    // Check if a player is on that square
    if (ballCell.player) {
        if (ballCell.player.knockedDown) {
            // Ball landed on knocked down player - scatter again 1 square
            updateStatus(`Ball scattered to (${clampedRow}, ${clampedCol}). Ball landed on knocked down player ${ballCell.player.id}. Ball scatters again 1 square.`);
            scatterBallDirection(clampedRow, clampedCol, 1, null, false);
            return;
        } else {
            // Standing player - they attempt to catch it
            attemptBallCatchOnKickoff(ballCell.player, clampedRow, clampedCol);
        }
    } else {
        // Ball landed on unoccupied square
        updateStatus(`Ball scattered to (${clampedRow}, ${clampedCol}).`);
    }
}

// Create a player
// playerType: string - the type of player (e.g., 'Lineman', 'Blitzer', etc.)
//                     defaults to 'Lineman' if not specified
function createPlayer(team, number, row, col, playerType = 'Lineman') {
    // Get player type configuration, defaulting to Lineman if type doesn't exist
    const typeConfig = PLAYER_TYPES[playerType] || PLAYER_TYPES.Lineman;

    const player = {
        id: `team${team}-player${number}`,
        team,
        number,
        row,
        col,
        hasActed: false,
        hasMoved: false,
        movement: typeConfig.movement,
        remainingMovement: typeConfig.movement,
        strength: typeConfig.strength,
        agility: typeConfig.agility,
        armour: typeConfig.armour,
        position: typeConfig.position,
        positionLetter: typeConfig.letter, // Letter to display (e.g., 'L' for Lineman)
        skills: [...typeConfig.skills], // Copy skills array
        playerType: playerType, // Store the type for reference
        dodgeModifier: 1, // +1 bonus to dodge rolls (reduces target number)
        knockedDown: false,
        hasBall: false,
        placed: false // Whether player has been placed on board
    };

    // Only create visual element if player is placed (row/col not -1)
    if (row >= 0 && col >= 0) {
        const cell = gameState.board[row][col].cell;
        const playerElement = document.createElement('div');
        playerElement.className = `player team${team}`;
        playerElement.textContent = player.positionLetter;
        playerElement.dataset.playerId = player.id;

        // Single click to select (only if it's your own team and not in an action mode that targets opponents)
        playerElement.addEventListener('click', (e) => {
            // In block mode or pass mode, let the click propagate to the cell to trigger the action
            if (gameState.actionMode === 'block' || gameState.actionMode === 'pass') {
                return; // Don't stop propagation, let cell handle it
            }
            e.stopPropagation();
            // Only select if it's your own team's player
            if (player.team === gameState.currentTeam) {
                selectPlayer(player);
            }
        });

        // Show stats on hover
        playerElement.addEventListener('mouseenter', () => {
            showPlayerStats(player);
        });

        playerElement.addEventListener('mouseleave', () => {
            hidePlayerStats(player.team);
        });

        cell.appendChild(playerElement);
        gameState.board[row][col].player = player;
        player.placed = true;
    }

    return player;
}

// Give ball to a player
function giveBallToPlayer(player) {
    // Remove ball from previous holder
    if (gameState.ballHolder) {
        gameState.ballHolder.hasBall = false;
        const prevPlayerElement = document.querySelector(`[data-player-id="${gameState.ballHolder.id}"]`);
        if (prevPlayerElement) {
            prevPlayerElement.classList.remove('has-ball');
            // Remove ball visual if it exists
            const prevBall = prevPlayerElement.querySelector('.ball');
            if (prevBall) {
                prevBall.remove();
            }
        }
    }

    // Remove ball from ground if it's on the ground
    if (gameState.ballPosition) {
        const ballCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
        const ballOnGround = ballCell.cell.querySelector('.ball-on-ground');
        if (ballOnGround) {
            ballOnGround.remove();
        }
        gameState.ballPosition = null;
    }

    // Give ball to new player
    player.hasBall = true;
    gameState.ballHolder = player;
    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    if (playerElement) {
        playerElement.classList.add('has-ball');
        // Add ball visual
        const ball = document.createElement('div');
        ball.className = 'ball';
        ball.textContent = '🏈';
        playerElement.appendChild(ball);
    }
}

// Select a player
function selectPlayer(player) {
    // Cannot select during setup phase
    if (gameState.setupPhase) {
        return;
    }

    // Can only select players from current team
    if (player.team !== gameState.currentTeam) {
        updateStatus(`Cannot select opponent's player!`);
        return;
    }

    // Can't select if already acted
    if (player.hasActed) {
        updateStatus(`This player has already acted this turn.`);
        return;
    }

    // Allow knocked down players to be selected (they can stand up)

    // Deselect previous player
    if (gameState.selectedPlayer) {
        const prevPlayer = gameState.selectedPlayer;
        const prevCell = gameState.board[prevPlayer.row][prevPlayer.col].cell;
        prevCell.classList.remove('selected');
        document.querySelector(`[data-player-id="${prevPlayer.id}"]`)?.classList.remove('selected');

        // If switching players during a move action
        if (gameState.actionMode === 'move') {
            // If player has already moved (has a movement path) or stood up, complete the action
            if (gameState.movementPath.length > 0 || gameState.stoodUpThisMove) {
                // Store the new player to select after movement completes
                gameState.pendingPlayerToSelect = player;
                // Execute the movement to complete the action
                executeMovement();
                // Note: executeMovement will handle clearing state and deselecting
                // The new player will be selected after movement completes (handled in executeMovement)
                return; // Exit early, new player will be selected after movement completes
            } else {
                // Player hasn't moved yet, cancel the action
                // Revert stand up if player was standing up
                if (gameState.stoodUpThisMove) {
                    const { player: stoodUpPlayer, standUpCost } = gameState.stoodUpThisMove;
                    if (stoodUpPlayer === prevPlayer) {
                        stoodUpPlayer.knockedDown = true;
                        stoodUpPlayer.remainingMovement += standUpCost;
                        const prevPlayerElement = document.querySelector(`[data-player-id="${stoodUpPlayer.id}"]`);
                        if (prevPlayerElement) {
                            prevPlayerElement.classList.add('knocked-down');
                        }
                    }
                }
            }
        } else if (gameState.actionMode === 'block') {
            // Cancel block action when switching players
            cancelBlock();
        }

        // Clear movement state (only if not executing movement)
        if (gameState.actionMode !== 'move' || (gameState.movementPath.length === 0 && !gameState.stoodUpThisMove)) {
            gameState.movementPath = [];
            gameState.stoodUpThisMove = null;
            clearMovementPathDisplay();
            hideMovementButtons();
            hideBlockCancelButton();
            gameState.actionMode = null;
            updateActionButtons();
        }

        // Clear push selection if switching players
        if (gameState.pendingPushSelection) {
            clearPushSelection();
            gameState.pendingPushSelection = null;
        }
    }

    gameState.selectedPlayer = player;
    const cell = gameState.board[player.row][player.col].cell;
    cell.classList.add('selected');
    document.querySelector(`[data-player-id="${player.id}"]`)?.classList.add('selected');

    // Enable action buttons
    document.getElementById('btn-block').disabled = false;
    document.getElementById('btn-pass').disabled = false;
    updateActionButtons(); // This will handle blitz button state

    // Automatically set action mode to 'move'
    // Clear any previous stand up tracking
    gameState.stoodUpThisMove = null;

    // If knocked down, stand up first (costs half movement)
    if (player.knockedDown) {
        const standUpCost = Math.ceil(player.movement / 2);
        if (!standUpPlayer(player)) {
            // Failed to stand up (not enough movement) - don't set move mode
            updateStatus(`Player ${player.number} is knocked down but doesn't have enough movement to stand up.`);
            clearValidMoves();
            return;
        }
        // Track that player stood up during this move action
        gameState.stoodUpThisMove = { player, standUpCost };
    }

    gameState.actionMode = 'move';
    gameState.movementPath = [];
    clearMovementPathDisplay();
    showValidMoves();
    updateActionButtons();

    if (gameState.stoodUpThisMove) {
        updateStatus('Player stood up! You can move additional squares or double-click to finish.');
    } else {
        updateStatus('Click adjacent squares to build your movement path. Double-click to execute movement.');
    }
}

// Handle cell double click (for move execution)
function handleCellDoubleClick(row, col) {
    // Handle setup phase first
    if (gameState.setupPhase) {
        // Double click doesn't do anything special in setup
        return;
    }

    const cellData = gameState.board[row][col];

    // Handle push selection first (highest priority)
    if (gameState.pendingPushSelection) {
        // Double click doesn't do anything special for push selection
        return;
    }

    if (gameState.actionMode === 'block' && gameState.selectedPlayer) {
        // Double click on an opponent player: perform block roll
        if (cellData.player && cellData.player.team !== gameState.selectedPlayer.team && !cellData.player.knockedDown) {
            attemptBlock(row, col);
            return;
        }
    }

    if (gameState.actionMode === 'move' && gameState.selectedPlayer) {
        // Check if double-clicking on the player's own square when they've stood up - confirm stand up and end movement
        if (gameState.stoodUpThisMove && cellData.player === gameState.selectedPlayer) {
            // Player double-clicked on themselves after standing up - confirm and end movement
            executeMovement();
            return;
        }

        // Check if double-clicking on a square already in the movement path - execute move immediately
        // This check should happen first, including for GFI squares that were added via single click
        if (gameState.movementPath.length > 0) {
            const isInPath = gameState.movementPath.some(step => step.row === row && step.col === col);
            if (isInPath) {
                // Double-clicked on a square in the path (including GFI squares) - execute movement
                executeMovement();
                return;
            }
        }

        // Check if double-clicking on a GFI square (that's not in path yet) - add it and execute
        // This works even if the GFI square isn't adjacent (unlike single-click which requires adjacency)
        if (cellData.cell.classList.contains('gfi-available')) {
            const player = gameState.selectedPlayer;
            // Get current position (starting position or end of current path)
            let currentRow = player.row;
            let currentCol = player.col;
            if (gameState.movementPath.length > 0) {
                const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
                currentRow = lastStep.row;
                currentCol = lastStep.col;
            }

            // Check if GFI square is adjacent to current position
            const rowDiff = Math.abs(row - currentRow);
            const colDiff = Math.abs(col - currentCol);
            const isAdjacent = rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);

            if (isAdjacent) {
                // Check if we can add another GFI square (max 2)
                const currentGfiSquaresInPath = Math.max(0, gameState.movementPath.length - player.remainingMovement);
                if (currentGfiSquaresInPath < 2) {
                    // Add the GFI square to the path
                    gameState.movementPath.push({ row, col });
                    updateMovementPathDisplay();
                    // Execute movement (will roll for GFI)
                    executeMovement();
                    return;
                }
            }
        }

        // Check if double-clicking on an opposing player - try blitz first if available
        if (cellData.player &&
            cellData.player.team !== gameState.selectedPlayer.team &&
            !cellData.player.knockedDown) {
            const player = gameState.selectedPlayer;

            // Check if opponent is already adjacent - switch to block
            const rowDiff = Math.abs(row - player.row);
            const colDiff = Math.abs(col - player.col);
            if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
                // Adjacent opponent - cancel movement and switch to block
                gameState.movementPath = [];
                gameState.stoodUpThisMove = null;
                clearMovementPathDisplay();
                clearValidMoves();
                hideMovementButtons();
                gameState.actionMode = 'block';
                showValidBlocks();
                updateActionButtons();
                // Perform the block immediately
                attemptBlock(row, col);
                return;
            }

            // Not adjacent - check if blitz is available and we can reach an adjacent square
            if (!gameState.blitzUsed) {
                // Try to find the closest adjacent square to this opponent that we can reach
                const directions = [
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1],           [0, 1],
                    [1, -1],  [1, 0],  [1, 1]
                ];

                const remainingMovement = player.remainingMovement - gameState.movementPath.length;
                const reachableSquares = [];

                // Try each adjacent square to the target and collect all reachable ones
                for (const [rowOffset, colOffset] of directions) {
                    const adjacentRow = row + rowOffset;
                    const adjacentCol = col + colOffset;

                    // Check bounds
                    if (adjacentRow < 0 || adjacentRow >= gameState.boardHeight ||
                        adjacentCol < 0 || adjacentCol >= gameState.boardWidth) {
                        continue;
                    }

                    // Check if square is occupied (can't move to occupied square)
                    const adjacentCell = gameState.board[adjacentRow][adjacentCol];
                    if (adjacentCell.player) {
                        continue;
                    }

                    // Calculate path to this adjacent square
                    const path = calculatePathToDestination(adjacentRow, adjacentCol);
                    if (path !== null && path.length <= remainingMovement) {
                        reachableSquares.push({
                            row: adjacentRow,
                            col: adjacentCol,
                            path: path,
                            pathLength: path.length
                        });
                    }
                }

                // If we found reachable squares, pick the closest one (shortest path)
                if (reachableSquares.length > 0) {
                    // Sort by path length (shortest first)
                    reachableSquares.sort((a, b) => a.pathLength - b.pathLength);
                    const closest = reachableSquares[0];

                    // Switch to blitz and execute
                    gameState.actionMode = 'blitz';
                    gameState.movementPath = [...gameState.movementPath, ...closest.path];
                    // Store target for blocking after movement
                    gameState.blitzTarget = { row, col };
                    executeMovement();
                    return;
                }

                // Couldn't reach an adjacent square - fall through to normal move behavior
            }
        }

        // Double click on a reachable square: calculate path and execute move
        // Check if square has the class OR if it's actually reachable via pathfinding
        const hasReachableClass = cellData.cell.classList.contains('reachable-area') ||
                                  cellData.cell.classList.contains('valid-move') ||
                                  cellData.cell.classList.contains('gfi-available');

        // Also check if the square is actually reachable (even if class wasn't applied)
        if (hasReachableClass || (!cellData.player && row >= 0 && row < gameState.boardHeight && col >= 0 && col < gameState.boardWidth)) {
            // Calculate path to this destination
            const path = calculatePathToDestination(row, col);
            if (path && path.length > 0) {
                // Check if path is within movement range (including GFI)
                const player = gameState.selectedPlayer;
                const remainingMovement = player.remainingMovement - gameState.movementPath.length;
                const maxPathLength = remainingMovement + 2; // Allow up to 2 GFI squares

                if (path.length <= maxPathLength) {
                    // Append to existing path and execute
                    gameState.movementPath = [...gameState.movementPath, ...path];
                    executeMovement();
                    return;
                }
            } else if (path && path.length === 0) {
                // Destination is already reached, just execute with current path
                executeMovement();
                return;
            }
        }
    }

    if (gameState.actionMode === 'blitz' && gameState.selectedPlayer) {
        // Check if double-clicking on an opponent player
        if (cellData.player && cellData.player.team !== gameState.selectedPlayer.team && !cellData.player.knockedDown) {
            const player = gameState.selectedPlayer;
            // Get current position (starting position or end of current path)
            let currentRow = player.row;
            let currentCol = player.col;
            if (gameState.movementPath.length > 0) {
                const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
                currentRow = lastStep.row;
                currentCol = lastStep.col;
            }

            // Check if opponent is adjacent to current position (after any movement)
            const rowDiff = Math.abs(row - currentRow);
            const colDiff = Math.abs(col - currentCol);
            if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
                // Adjacent opponent - execute movement if there's a path, then block
                if (gameState.movementPath.length > 0) {
                    // Store target and execute movement (will block after movement)
                    gameState.blitzTarget = { row, col };
                    executeMovement();
                    return;
                } else {
                    // No movement path - block immediately
                    attemptBlock(row, col);
                    return;
                }
            } else {
                // Not adjacent - try to find an adjacent square to this opponent and move there, then block
                handleBlitzTargetClick(row, col, cellData.player);
                return;
            }
        }

        // Check if double-clicking on a square already in the movement path - execute move immediately
        if (gameState.movementPath.length > 0) {
            const isInPath = gameState.movementPath.some(step => step.row === row && step.col === col);
            if (isInPath) {
                // Double-clicked on a square in the path - execute movement
                executeMovement();
                return;
            }
        }

        // Double click on a reachable square: calculate path and execute move
        if (cellData.cell.classList.contains('reachable-area') || cellData.cell.classList.contains('valid-move') || cellData.cell.classList.contains('gfi-available')) {
            // Calculate path to this destination and execute automatically
            const path = calculatePathToDestination(row, col);
            if (path && path.length > 0) {
                // Append to existing path and execute
                gameState.movementPath = [...gameState.movementPath, ...path];
                executeMovement();
                return;
            } else if (path && path.length === 0) {
                // Destination is already reached, just execute with current path
                executeMovement();
                return;
            }
        }
    }
}

// Handle cell click
function handleCellClick(row, col) {
    // Handle setup phase first
    if (gameState.setupPhase) {
        placePlayerInSetup(row, col);
        return;
    }

    const cellData = gameState.board[row][col];

    // Handle push selection first (highest priority)
    if (gameState.pendingPushSelection) {
        handlePushSquareSelection(row, col);
        return;
    }

    if (gameState.actionMode === 'blitz' && gameState.selectedPlayer) {
        // In blitz mode, check if clicking on an opponent player
        if (cellData.player && cellData.player.team !== gameState.selectedPlayer.team && !cellData.player.knockedDown) {
            const player = gameState.selectedPlayer;
            // Get current position (starting position or end of current path)
            let currentRow = player.row;
            let currentCol = player.col;
            if (gameState.movementPath.length > 0) {
                const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
                currentRow = lastStep.row;
                currentCol = lastStep.col;
            }

            // Check if opponent is adjacent to current position (after any movement)
            const rowDiff = Math.abs(row - currentRow);
            const colDiff = Math.abs(col - currentCol);
            if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
                // Adjacent opponent - only block if we've already moved (have a path)
            // Otherwise, allow movement first
            if (gameState.movementPath.length > 0) {
                // Already moved - update target and block this opponent
                gameState.blitzTarget = { row, col };
                attemptBlock(row, col);
                return;
            } else {
                // Not moved yet - allow building movement path first
                // Store this as a potential target but allow movement
                gameState.blitzTarget = { row, col };
                // Don't block immediately - allow movement to build path
                // Player can move away and then click on a different opponent to block
            }
            } else {
                // Not adjacent - try to find an adjacent square to this opponent and move there, then block
                handleBlitzTargetClick(row, col, cellData.player);
                return;
            }
        }
        // Treat as normal movement path building (allows moving away from adjacent opponents)
        addToMovementPath(row, col);
    } else if (gameState.actionMode === 'move' && gameState.selectedPlayer) {
        // Single click: step-by-step path building (only for adjacent squares)
        addToMovementPath(row, col);
    } else if (gameState.actionMode === 'pass' && gameState.selectedPlayer) {
        // In pass mode, check if clicking on a teammate to pass to
        if (cellData.player && cellData.player.team === gameState.selectedPlayer.team &&
            cellData.player !== gameState.selectedPlayer && !cellData.player.knockedDown) {
            // Clicking on a teammate - attempt pass
            attemptPass(row, col);
        } else if (!cellData.player || cellData.player === gameState.selectedPlayer) {
            // Clicking on empty square or own square - treat as movement
            addToMovementPath(row, col);
        }
    } else if (gameState.actionMode === 'block' && gameState.selectedPlayer) {
        // If clicking on your own player, cancel block and select that player
        if (cellData.player && cellData.player.team === gameState.currentTeam) {
            cancelBlock();
            selectPlayer(cellData.player);
        } else {
            // Otherwise, attempt block on opponent
            attemptBlock(row, col);
        }
    } else if (cellData.player && cellData.player.team === gameState.currentTeam) {
        selectPlayer(cellData.player);
    }
}

// Handle clicking on an opponent player during blitz action
function handleBlitzTargetClick(targetRow, targetCol, targetPlayer) {
    const player = gameState.selectedPlayer;
    if (!player) return;

    // Get current position (starting position or end of current path)
    let currentRow = player.row;
    let currentCol = player.col;
    if (gameState.movementPath.length > 0) {
        const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
        currentRow = lastStep.row;
        currentCol = lastStep.col;
    }

    // Check if we're already adjacent to the target
    const rowDiff = Math.abs(targetRow - currentRow);
    const colDiff = Math.abs(targetCol - currentCol);
    if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
        // Already adjacent - just execute movement and block
        executeBlitzMovementAndBlock(targetRow, targetCol);
        return;
    }

    // Find the closest adjacent square to the target that we can reach
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    const remainingMovement = player.remainingMovement - gameState.movementPath.length;
    const reachableSquares = [];

    // Try each adjacent square to the target and collect all reachable ones
    for (const [rowOffset, colOffset] of directions) {
        const adjacentRow = targetRow + rowOffset;
        const adjacentCol = targetCol + colOffset;

        // Check bounds
        if (adjacentRow < 0 || adjacentRow >= gameState.boardHeight ||
            adjacentCol < 0 || adjacentCol >= gameState.boardWidth) {
            continue;
        }

        // Check if square is occupied (can't move to occupied square)
        const adjacentCell = gameState.board[adjacentRow][adjacentCol];
        if (adjacentCell.player) {
            continue;
        }

        // Calculate path to this adjacent square
        const path = calculatePathToDestination(adjacentRow, adjacentCol);
        if (path !== null && path.length <= remainingMovement) {
            reachableSquares.push({
                row: adjacentRow,
                col: adjacentCol,
                path: path,
                pathLength: path.length
            });
        }
    }

    // If we found reachable squares, pick the closest one (shortest path)
    if (reachableSquares.length > 0) {
        // Sort by path length (shortest first)
        reachableSquares.sort((a, b) => a.pathLength - b.pathLength);
        const closest = reachableSquares[0];

        // Complete movement and block
        gameState.movementPath = [...gameState.movementPath, ...closest.path];
        executeBlitzMovementAndBlock(targetRow, targetCol);
        return;
    }

    // No reachable adjacent square found
    updateStatus(`Cannot reach an adjacent square to block ${targetPlayer.id}. Not enough movement or no path available.`);
}

// Execute movement and then block during blitz
function executeBlitzMovementAndBlock(targetRow, targetCol) {
    // Store the target for blocking after movement
    gameState.blitzTarget = { row: targetRow, col: targetCol };

    // Execute movement - it will automatically transition to block mode
    executeMovement();
}

// Add square to movement path
function addToMovementPath(row, col) {
    const player = gameState.selectedPlayer;
    if (!player || player.hasMoved) {
        updateStatus('This player has already moved this turn.');
        return;
    }

    // Calculate current position (starting position or last position in path)
    let currentRow = player.row;
    let currentCol = player.col;
    if (gameState.movementPath.length > 0) {
        const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
        currentRow = lastStep.row;
        currentCol = lastStep.col;
    }

    // Check if clicking the same square (remove it if it's the last one)
    if (gameState.movementPath.length > 0) {
        const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
        if (lastStep.row === row && lastStep.col === col) {
            // Remove last step
            gameState.movementPath.pop();
            updateMovementPathDisplay();
            // Clear and re-show tackle zones and valid moves
            clearTackleZones();
            showValidMoves();
            updateStatus(`Path updated. Remaining movement: ${player.remainingMovement - gameState.movementPath.length}`);
            return;
        }
    }

    // Check if square is adjacent to current position (including diagonals)
    const rowDiff = Math.abs(row - currentRow);
    const colDiff = Math.abs(col - currentCol);
    if (rowDiff > 1 || colDiff > 1 || (rowDiff === 0 && colDiff === 0)) {
        updateStatus('Must select an adjacent square (including diagonals).');
        return;
    }

    // Check if path length exceeds remaining movement (allow up to 2 GFI squares)
    const currentNormalMovementUsed = Math.min(gameState.movementPath.length, player.remainingMovement);
    const currentGfiSquaresInPath = Math.max(0, gameState.movementPath.length - player.remainingMovement);

    if (currentGfiSquaresInPath >= 2) {
        updateStatus(`Cannot add more squares! Maximum 2 "Go For It" squares allowed.`);
        return;
    }

    if (gameState.movementPath.length >= player.remainingMovement + 2) {
        updateStatus(`Cannot add more squares! Maximum movement + 2 "Go For It" squares.`);
        return;
    }

    // Check if square is occupied
    // Allow the player's starting position (they can move back to where they started)
    const isStartingPosition = (row === player.row && col === player.col);
    const cellPlayer = gameState.board[row][col].player;
    if (cellPlayer && !isStartingPosition) {
        updateStatus('Cannot move to a cell occupied by another player.');
        return;
    }

    // Allow going back to previously visited squares - removed restriction
    // Players can move back to squares they were on earlier in their path

    // Add to path
    gameState.movementPath.push({ row, col });
    updateMovementPathDisplay();
    // Clear and re-show tackle zones and valid moves (tackle zones may have changed)
    clearTackleZones();
    showValidMoves();

    const pathNormalMovementUsed = Math.min(gameState.movementPath.length, player.remainingMovement);
    const pathGfiSquaresInPath = Math.max(0, gameState.movementPath.length - player.remainingMovement);
    const pathRemaining = Math.max(0, player.remainingMovement - gameState.movementPath.length);

    let statusMsg = `Path: ${gameState.movementPath.length} squares`;
    if (pathGfiSquaresInPath > 0) {
        statusMsg += ` (${pathGfiSquaresInPath} "Go For It" - will roll d6 for each)`;
    }
    if (pathRemaining > 0) {
        statusMsg += `. Remaining movement: ${pathRemaining}`;
    }
    statusMsg += `. Click Confirm Move when done.`;
    updateStatus(statusMsg);
}

// Update movement path visual display
function updateMovementPathDisplay() {
    const player = gameState.selectedPlayer;
    if (!player) return;

    // Clear previous path highlighting
    document.querySelectorAll('.cell.path-step').forEach(cell => {
        cell.classList.remove('path-step', 'gfi-step');
        cell.removeAttribute('data-step-number');
    });

    // Highlight path squares with high visibility
    gameState.movementPath.forEach((step, index) => {
        const cell = gameState.board[step.row][step.col].cell;
        // Remove any conflicting classes that might hide the path
        cell.classList.remove('valid-move', 'reachable-area');

        // Check if this is a GFI square (beyond remaining movement)
        const isGFI = index >= player.remainingMovement;

        // Add path-step class
        cell.classList.add('path-step');
        if (isGFI) {
            // Add special class for GFI squares (risky)
            cell.classList.add('gfi-step');
        }

        // Add step number
        cell.setAttribute('data-step-number', index + 1);
    });
}

// Check if a square is in a tackle zone (adjacent to any defending player)
function isInTackleZone(row, col, currentTeam) {
    // Find all defending players (opponents who are not knocked down)
    const defendingPlayers = gameState.players.filter(p =>
        p.team !== currentTeam && !p.knockedDown
    );

    // Directions for 8 adjacent squares (including diagonals)
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    // Check if the square is adjacent to any defending player
    for (const defender of defendingPlayers) {
        for (const [rowOffset, colOffset] of directions) {
            const tackleRow = defender.row + rowOffset;
            const tackleCol = defender.col + colOffset;

            if (tackleRow === row && tackleCol === col) {
                return true;
            }
        }
    }

    return false;
}

// Count how many tackle zones are in a square (number of defending players whose tackle zone includes this square)
function countTackleZonesInSquare(row, col, currentTeam) {
    // Find all defending players (opponents who are not knocked down)
    const defendingPlayers = gameState.players.filter(p =>
        p.team !== currentTeam && !p.knockedDown
    );

    // Directions for 8 adjacent squares (including diagonals)
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    let count = 0;

    // Count how many defending players have this square in their tackle zone
    for (const defender of defendingPlayers) {
        for (const [rowOffset, colOffset] of directions) {
            const tackleRow = defender.row + rowOffset;
            const tackleCol = defender.col + colOffset;

            if (tackleRow === row && tackleCol === col) {
                count++;
                break; // Each defender only counts once, even if square is in multiple adjacent positions
            }
        }
    }

    return count;
}

// Attempt a dodge roll (D6 against player's agility with dodge modifier)
// leavingTackleZone: if true, applies -1 modifier to the roll
// destinationTackleZones: number of tackle zones in the destination square (each adds -1 modifier)
function attemptDodge(player, leavingTackleZone = false, destinationTackleZones = 0) {
    const roll = rollDice();
    const agility = player.agility;
    const dodgeModifier = player.dodgeModifier || 0;
    let targetNumber = agility - dodgeModifier; // +1 modifier means -1 to target number

    // Apply -1 modifier if leaving a tackle zone (increases target number by 1)
    if (leavingTackleZone) {
        targetNumber += 1;
    }

    // Apply -1 modifier for each tackle zone in the destination square
    targetNumber += destinationTackleZones;

    let modifierText = '';
    if (dodgeModifier > 0) {
        modifierText = ` with +${dodgeModifier} dodge modifier`;
    }
    if (leavingTackleZone) {
        modifierText += modifierText ? ' and -1 for leaving tackle zone' : ' with -1 for leaving tackle zone';
    }
    if (destinationTackleZones > 0) {
        modifierText += modifierText ? ` and -${destinationTackleZones} for ${destinationTackleZones} tackle zone${destinationTackleZones > 1 ? 's' : ''} in destination` : ` with -${destinationTackleZones} for ${destinationTackleZones} tackle zone${destinationTackleZones > 1 ? 's' : ''} in destination`;
    }

    updateStatus(`Dodge roll! Rolled ${roll} (needed ${targetNumber}+${modifierText}).`);

    if (roll >= targetNumber) {
        // Successful dodge
        updateStatus(`Dodge successful! Rolled ${roll} (needed ${targetNumber}+). Player continues moving.`);
        return true;
    } else {
        // Failed dodge - player falls over
        updateStatus(`Dodge failed! Rolled ${roll} (needed ${targetNumber}+). Player falls over!`);
        knockDownPlayer(player);
        return false;
    }
}

// Execute movement along the path
function executeMovement() {
    const player = gameState.selectedPlayer;
    if (!player) {
        updateStatus('No player selected.');
        return;
    }

    // Allow confirming if player stood up (even with empty path) or if there's a path
    if (gameState.movementPath.length === 0 && !gameState.stoodUpThisMove) {
        updateStatus('No movement path selected.');
        return;
    }

    // Debug: Log the path to help diagnose issues
    console.log('Executing movement with path:', gameState.movementPath, 'Player at:', player.row, player.col);

    // Store the original cell position before movement (to clear selection later)
    const originalCell = gameState.board[player.row][player.col].cell;

    // Clear path highlights immediately when move is confirmed
    clearMovementPathDisplay();

    // IMPORTANT: Clear action mode and selected player immediately so other players can be selected
    // even while the movement animation is playing. Store player reference for use in setTimeout callback.
    const movingPlayer = gameState.selectedPlayer;
    const actionModeBeforeMove = gameState.actionMode; // Store for blitz/pass handling
    gameState.actionMode = null;
    gameState.selectedPlayer = null;

    // Clear valid moves immediately so UI is ready for new player selection
    clearValidMoves();

    // Track if movement was stopped due to failed ball pickup, failed dodge, or failed GFI
    let movementStopped = false;

    // Track current position as we move (starts at player's current position)
    let currentRow = movingPlayer.row;
    let currentCol = movingPlayer.col;
    let currentWasInTackleZone = isInTackleZone(currentRow, currentCol, movingPlayer.team);

    // Reset GFI squares used for this movement
    gameState.gfiSquaresUsed = 0;

    // Store path length before starting (in case path gets modified)
    const pathLength = gameState.movementPath.length;
    const pathCopy = [...gameState.movementPath]; // Make a copy to avoid issues if path is modified

    // Move player step by step along the path
    pathCopy.forEach((step, index) => {
        setTimeout(() => {
            // Don't continue if movement was stopped (e.g., failed ball pickup, failed dodge, or failed GFI)
            if (movementStopped) {
                return;
            }

            // Check if this step requires "Go For It" (beyond remaining movement)
            const requiresGFI = index >= movingPlayer.remainingMovement;

            if (requiresGFI) {
                // Roll d6 for "Go For It" BEFORE moving
                const gfiRoll = Math.floor(Math.random() * 6) + 1;
                gameState.gfiSquaresUsed++;

                if (gfiRoll === 1) {
                    // GFI failed - player falls over in the square they were trying to reach
                    movementStopped = true;

                    // Move player to the square they were trying to reach (they fall there)
                    movePlayer(movingPlayer, step.row, step.col);

                    // Knock down the player
                    knockDownPlayer(movingPlayer);

                    // Calculate how many steps were actually completed (including this one)
                    const completedSteps = index + 1;

                    // Deduct movement for completed steps (normal movement only, GFI doesn't count)
                    const normalStepsCompleted = Math.min(completedSteps, movingPlayer.remainingMovement);
                    movingPlayer.remainingMovement -= normalStepsCompleted;

                    // Update player state
                    movingPlayer.hasMoved = true;
                    movingPlayer.hasActed = true;

                    // Clear movement state
                    gameState.movementPath = [];
                    gameState.stoodUpThisMove = null;
                    gameState.gfiSquaresUsed = 0;
                    gameState.blitzTarget = null; // Clear blitz target if movement failed
                    clearValidMoves();
                    hideMovementButtons();
                    gameState.actionMode = null;
                    updateActionButtons();

                    // Clear selected highlighting
                    document.querySelectorAll('.cell.selected').forEach(cell => {
                        cell.classList.remove('selected');
                    });
                    document.querySelectorAll('.player.selected').forEach(p => {
                        p.classList.remove('selected');
                    });
                    gameState.selectedPlayer = null;

                    // Player fell over during GFI - turn ends
                    updateStatus(`Player ${movingPlayer.number} attempted "Go For It" but rolled a 1! Player falls over! Turn ends.`);
                    endTurn(true, `Player ${movingPlayer.number} failed "Go For It"`); // Automatic turnover
                    return;
                } else {
                    // GFI succeeded - continue movement
                    updateStatus(`Player ${movingPlayer.number} "Go For It": Rolled ${gfiRoll} (success).`);
                }
            }

            // Move player to new position
            movePlayer(movingPlayer, step.row, step.col);

            // Check if destination is in a tackle zone
            const willBeInTackleZone = isInTackleZone(step.row, step.col, movingPlayer.team);

            // Count how many tackle zones are in the destination square
            const destinationTackleZones = countTackleZonesInSquare(step.row, step.col, movingPlayer.team);

            // If player was in a tackle zone before moving, they must dodge
            // (regardless of whether destination is also in a tackle zone)
            if (currentWasInTackleZone) {
                // Player was leaving a tackle zone - must dodge with modifiers
                const dodgeSuccess = attemptDodge(movingPlayer, true, destinationTackleZones);

                if (!dodgeSuccess) {
                    // Dodge failed - player falls over in the square they moved to
                    movementStopped = true;

                    // Calculate how many steps were actually completed (including this one)
                    const completedSteps = index + 1;

                    // Deduct movement for completed steps (only normal movement, not GFI)
                    const normalStepsCompleted = Math.min(completedSteps, movingPlayer.remainingMovement);
                    movingPlayer.remainingMovement -= normalStepsCompleted;

                    // Update player state
                    movingPlayer.hasMoved = true;
                    movingPlayer.hasActed = true;

                    // Clear movement state
                    gameState.movementPath = [];
                    gameState.stoodUpThisMove = null;
                    gameState.gfiSquaresUsed = 0;
                    gameState.blitzTarget = null; // Clear blitz target if movement failed
                    clearValidMoves();
                    hideMovementButtons();
                    gameState.actionMode = null;
                    updateActionButtons();

                    // Clear selected highlighting
                    document.querySelectorAll('.cell.selected').forEach(cell => {
                        cell.classList.remove('selected');
                    });
                    document.querySelectorAll('.player.selected').forEach(p => {
                        p.classList.remove('selected');
                    });
                    gameState.selectedPlayer = null;

                    // Player fell over during dodge - turn ends
                    updateStatus(`Player ${movingPlayer.number} fell over during dodge! Turn ends.`);
                    endTurn(true, `Player ${movingPlayer.number} fell over during dodge`); // Automatic turnover
                    return;
                }
            }

            // Update current position and tackle zone status for next iteration
            currentRow = step.row;
            currentCol = step.col;
            currentWasInTackleZone = willBeInTackleZone;

            // Check if ball is on the ground at this position and attempt pickup
            if (gameState.ballPosition &&
                gameState.ballPosition.row === movingPlayer.row &&
                gameState.ballPosition.col === movingPlayer.col &&
                !movingPlayer.knockedDown &&
                !movingPlayer.hasBall) {
                const hadBallBefore = movingPlayer.hasBall;
                attemptBallPickup(movingPlayer);

                // If pickup failed, stop movement (endTurn() is called inside attemptBallPickup)
                if (!movingPlayer.hasBall && !hadBallBefore) {
                    movementStopped = true;
                    return;
                }
                // If pickup succeeded, player can continue moving with the ball
            }
        }, index * 200); // Small delay between steps for visual effect
    });

    // Update player state after movement completes
    setTimeout(() => {
        // Don't update if movement was stopped due to failed ball pickup or failed dodge
        if (movementStopped) {
            return;
        }

        // Deduct movement for path (stand up cost was already deducted)
        // Only deduct normal movement squares, not GFI squares
        const normalMovementUsed = Math.min(pathLength, movingPlayer.remainingMovement);
        movingPlayer.remainingMovement -= normalMovementUsed;
        movingPlayer.hasMoved = true;

        // Reset GFI squares used
        gameState.gfiSquaresUsed = 0;

        // Clear path and stand up tracking
        gameState.movementPath = [];
        gameState.stoodUpThisMove = null;
        clearValidMoves();
        // Path highlights already cleared when move was confirmed
        hideMovementButtons();

        // If in blitz mode, transition to block mode after movement
        if (actionModeBeforeMove === 'blitz') {
            // Don't mark as acted yet - they still need to block
            // Re-select the player and set to block mode
            gameState.selectedPlayer = movingPlayer;
            gameState.actionMode = 'block';

            // If there's a stored blitz target, automatically block it
            if (gameState.blitzTarget) {
                const { row: targetRow, col: targetCol } = gameState.blitzTarget;
                gameState.blitzTarget = null; // Clear the target
                // Small delay to let movement animation complete
                setTimeout(() => {
                    attemptBlock(targetRow, targetCol);
                }, 100);
            } else {
                showValidBlocks();
                updateActionButtons();
                updateStatus(`Player ${movingPlayer.number} moved! Now select an adjacent opponent to block.`);
            }

            // If there's a pending player to select (from switching players), select them now
            if (gameState.pendingPlayerToSelect) {
                const playerToSelect = gameState.pendingPlayerToSelect;
                gameState.pendingPlayerToSelect = null;
                // Small delay to ensure UI updates
                setTimeout(() => {
                    selectPlayer(playerToSelect);
                }, 50);
                return; // Exit early, new player selection will update status
            }
        } else if (actionModeBeforeMove === 'pass') {
            // Re-select the player for pass action
            gameState.selectedPlayer = movingPlayer;
            gameState.actionMode = 'pass';

            // If there's a stored pass target, automatically attempt pass
            if (gameState.passTarget) {
                const { row: targetRow, col: targetCol } = gameState.passTarget;
                gameState.passTarget = null; // Clear the target
                // Small delay to let movement animation complete
                setTimeout(() => {
                    attemptPass(targetRow, targetCol);
                }, 100);
            } else {
                // Show valid pass targets
                showValidPassTargets();
                updateActionButtons();
                updateStatus(`Player ${movingPlayer.number} moved! Now select a teammate to pass to.`);
            }
        } else {
            // Normal move action - mark as acted and complete
            // If this was a move after a blitz block, mark as acted now (blitz is complete)
            movingPlayer.hasActed = true;
            gameState.actionMode = null;
            updateActionButtons();

            // Clear selected highlighting from original cell (before player moved)
            originalCell.classList.remove('selected');
            // Also clear from player's current cell (in case they moved)
            const currentCell = gameState.board[movingPlayer.row][movingPlayer.col].cell;
            currentCell.classList.remove('selected');
            // Clear from all cells and players (safety check)
            document.querySelectorAll('.cell.selected').forEach(cell => {
                cell.classList.remove('selected');
            });
            document.querySelectorAll('.player.selected').forEach(p => {
                p.classList.remove('selected');
            });
            gameState.selectedPlayer = null;

            // Clear valid moves and movement path to reset UI for selecting other players
            clearValidMoves();
            clearMovementPathDisplay();
            hideMovementButtons();

            // If there's a pending player to select (from switching players), select them now
            if (gameState.pendingPlayerToSelect) {
                const playerToSelect = gameState.pendingPlayerToSelect;
                gameState.pendingPlayerToSelect = null;
                // Small delay to ensure UI updates
                setTimeout(() => {
                    selectPlayer(playerToSelect);
                }, 50);
                return; // Exit early, new player selection will update status
            }

            if (gameState.movementPath.length === 0) {
                updateStatus(`Player ${movingPlayer.number} stood up! (Remaining movement: ${movingPlayer.remainingMovement})`);
            } else {
                updateStatus(`Player ${movingPlayer.number} moved successfully! (Remaining movement: ${movingPlayer.remainingMovement})`);
            }
        }
    }, gameState.movementPath.length * 200);
}

// Clear movement path display
function clearMovementPathDisplay() {
    document.querySelectorAll('.cell.path-step').forEach(cell => {
        cell.classList.remove('path-step');
        cell.removeAttribute('data-step-number');
    });
}

// Show movement buttons
function showMovementButtons() {
    const movementButtons = document.getElementById('movement-buttons');
    if (movementButtons) {
        movementButtons.style.display = 'flex';
    }
}

// Hide movement buttons
function hideMovementButtons() {
    const movementButtons = document.getElementById('movement-buttons');
    if (movementButtons) {
        movementButtons.style.display = 'none';
    }
}

// Show block cancel button
function showBlockCancelButton() {
    const blockCancelButton = document.getElementById('block-cancel-button');
    if (blockCancelButton) {
        blockCancelButton.style.display = 'flex';
    }
}

// Hide block cancel button
function hideBlockCancelButton() {
    const blockCancelButton = document.getElementById('block-cancel-button');
    if (blockCancelButton) {
        blockCancelButton.style.display = 'none';
    }
}

// Cancel block action
function cancelBlock() {
    clearValidMoves();
    hideBlockCancelButton();
    gameState.actionMode = null;
    updateActionButtons();
    updateStatus('Block action cancelled.');
}

// Cancel movement
function cancelMovement() {
    // If player stood up during this move action, revert it
    if (gameState.stoodUpThisMove) {
        const { player, standUpCost } = gameState.stoodUpThisMove;
        player.knockedDown = true;
        player.remainingMovement += standUpCost;

        // Update visual
        const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
        if (playerElement) {
            playerElement.classList.add('knocked-down');
        }

        gameState.stoodUpThisMove = null;
    }

    gameState.movementPath = [];
    clearMovementPathDisplay();
    clearValidMoves();
    hideMovementButtons();
    hideBlockCancelButton();
    gameState.actionMode = null;
    updateActionButtons();
    updateStatus('Movement cancelled.');
}

// Move player to new position
function movePlayer(player, newRow, newCol) {
    const oldCell = gameState.board[player.row][player.col];
    const newCell = gameState.board[newRow][newCol];

    // Update board state
    oldCell.player = null;
    newCell.player = player;

    // Move visual element (ball moves with player if they have it)
    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    oldCell.cell.removeChild(playerElement);
    newCell.cell.appendChild(playerElement);

    // Update player position
    player.row = newRow;
    player.col = newCol;

    // Note: Ball pickup is handled after movement completes in executeMovement()
    // (not during individual steps)

    // Check for touchdown
    checkTouchdown(player);
}

// Attempt block
function attemptBlock(row, col) {
    const player = gameState.selectedPlayer;
    const targetCell = gameState.board[row][col];

    if (!targetCell.player || targetCell.player.team === player.team) {
        updateStatus('No opponent to block at that location.');
        return;
    }

    // Cannot block if knocked down
    if (player.knockedDown) {
        updateStatus('Cannot block while knocked down. You must stand up first by declaring a move action.');
        return;
    }

    // Check if target is in any of the 8 adjacent squares
    const rowDiff = Math.abs(row - player.row);
    const colDiff = Math.abs(col - player.col);
    if (rowDiff > 1 || colDiff > 1 || (rowDiff === 0 && colDiff === 0)) {
        updateStatus('Must be adjacent to block.');
        return;
    }

    const target = targetCell.player;

    // Cannot block a knocked down player
    if (target.knockedDown) {
        updateStatus('Cannot block a knocked down player.');
        return;
    }

    // Count adjacent defending players (excluding the target being blocked)
    // Defending players can assist if they are not adjacent to any attacking players except the attacker
    const adjacentDefenders = countAdjacentDefenders(player.row, player.col, player.team, target, player);

    // Count adjacent attacking players (teammates adjacent to the target being blocked)
    // Attacking players can assist if they are not adjacent to any defending players except the defender
    const adjacentAttackers = countAdjacentAttackers(target.row, target.col, player.team, player, target);

    // Calculate modified strengths
    const attackerBaseStrength = player.strength;
    const attackerModifier = adjacentAttackers; // +1 for each adjacent attacker
    const attackerModifiedStrength = attackerBaseStrength + attackerModifier;
    const defenderBaseStrength = target.strength;
    const defenderModifier = adjacentDefenders; // +1 for each adjacent defender
    const defenderModifiedStrength = defenderBaseStrength + defenderModifier;

    // Determine number of dice based on modified attacker strength vs modified defender strength
    let numDice = 1; // Default: same strength = 1 die

    if (attackerModifiedStrength > defenderModifiedStrength) {
        // Attacker is stronger
        if (attackerModifiedStrength >= defenderModifiedStrength * 2) {
            numDice = 3; // Attacker strength is 2x or more = 3 dice
        } else {
            numDice = 2; // Attacker stronger = 2 dice
        }
    } else if (defenderModifiedStrength > attackerModifiedStrength) {
        // Defender is stronger (with modifiers) - always 2 dice
        numDice = 2; // Defender stronger = 2 dice (even if 2x or more)
    }

    // Determine who picks the result (defender picks if their modified strength is higher)
    const defenderPicks = defenderModifiedStrength > attackerModifiedStrength;

    // Roll the appropriate number of dice
    const dice = [];
    for (let i = 0; i < numDice; i++) {
        dice.push(rollDice());
    }

    // If this is a blitz action, reduce remaining movement by 1 (block costs 1 square of movement)
    if (gameState.actionMode === 'blitz') {
        player.remainingMovement = Math.max(0, player.remainingMovement - 1);
    }

    // Store the dice rolls and show selection buttons
    gameState.pendingBlockRolls = {
        dice: dice,
        target: target,
        attacker: player,
        defenderPicks: defenderPicks
    };

    // Show dice selection buttons
    showBlockDiceButtons(dice, defenderPicks);

    // Create status message with dice results
    const diceText = dice.join(', ');
    const diceWord = numDice === 1 ? 'die' : 'dice';
    const attackerModifierText = attackerModifier > 0 ? ` (+${attackerModifier} from ${adjacentAttackers} adjacent attacker${adjacentAttackers > 1 ? 's' : ''})` : '';
    const defenderModifierText = defenderModifier > 0 ? ` (+${defenderModifier} from ${adjacentDefenders} adjacent defender${adjacentDefenders > 1 ? 's' : ''})` : '';
    const pickerText = defenderPicks ? 'Defender' : 'Attacker';
    updateStatus(`Block! Rolled ${diceText} (${numDice} ${diceWord} - Attacker STR ${attackerBaseStrength}${attackerModifierText} = ${attackerModifiedStrength} vs Defender STR ${defenderBaseStrength}${defenderModifierText} = ${defenderModifiedStrength}). ${pickerText} chooses which result to use.`);
}

// Count adjacent defending players (excluding the target being blocked)
// A defending player can assist if they are:
// 1. Adjacent to the attacker
// 2. NOT adjacent to any attacking players EXCEPT the attacker performing the block
function countAdjacentDefenders(row, col, currentTeam, excludeTarget, attacker) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    let count = 0;

    // Check all 8 adjacent squares around the attacker
    for (const [rowOffset, colOffset] of directions) {
        const checkRow = row + rowOffset;
        const checkCol = col + colOffset;

        // Check if within bounds
        if (checkRow >= 0 && checkRow < gameState.boardHeight &&
            checkCol >= 0 && checkCol < gameState.boardWidth) {
            const cellData = gameState.board[checkRow][checkCol];

            // Check if there's a defending player (opponent, not knocked down, and not the target)
            if (cellData.player &&
                cellData.player.team !== currentTeam &&
                !cellData.player.knockedDown &&
                cellData.player !== excludeTarget) {

                // Check if this defending player is adjacent to any attacking players except the attacker
                // If they are, they cannot assist
                const canAssist = !isAdjacentToOpposingPlayers(cellData.player.row, cellData.player.col, currentTeam, attacker);

                if (canAssist) {
                    count++;
                }
            }
        }
    }

    return count;
}

// Check if a player at (row, col) is adjacent to any opposing players, excluding a specific player
// Returns true if they are adjacent to any opposing players (excluding the excludePlayer)
function isAdjacentToOpposingPlayers(row, col, opposingTeam, excludePlayer) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    // Check all 8 adjacent squares
    for (const [rowOffset, colOffset] of directions) {
        const checkRow = row + rowOffset;
        const checkCol = col + colOffset;

        // Check if within bounds
        if (checkRow >= 0 && checkRow < gameState.boardHeight &&
            checkCol >= 0 && checkCol < gameState.boardWidth) {
            const cellData = gameState.board[checkRow][checkCol];

            // Check if there's an opposing player (not knocked down, and not the excluded player)
            if (cellData.player &&
                cellData.player.team === opposingTeam &&
                !cellData.player.knockedDown &&
                cellData.player !== excludePlayer) {
                return true; // Found an adjacent opposing player
            }
        }
    }

    return false; // Not adjacent to any opposing players (excluding the excluded one)
}

// Calculate block dice for a given attacker/defender pair
// Returns: { numDice, defenderPicks, attackerModifiedStrength, defenderModifiedStrength }
function calculateBlockDice(attacker, defender) {
    // Count adjacent defending players (excluding the target being blocked)
    // Defending players can assist if they are not adjacent to any attacking players except the attacker
    const adjacentDefenders = countAdjacentDefenders(attacker.row, attacker.col, attacker.team, defender, attacker);

    // Count adjacent attacking players (teammates adjacent to the target being blocked)
    // Attacking players can assist if they are not adjacent to any defending players except the defender
    const adjacentAttackers = countAdjacentAttackers(defender.row, defender.col, attacker.team, attacker, defender);

    // Calculate modified strengths
    const attackerBaseStrength = attacker.strength;
    const attackerModifier = adjacentAttackers; // +1 for each adjacent attacker
    const attackerModifiedStrength = attackerBaseStrength + attackerModifier;
    const defenderBaseStrength = defender.strength;
    const defenderModifier = adjacentDefenders; // +1 for each adjacent defender
    const defenderModifiedStrength = defenderBaseStrength + defenderModifier;

    // Determine number of dice based on modified attacker strength vs modified defender strength
    let numDice = 1; // Default: same strength = 1 die

    if (attackerModifiedStrength > defenderModifiedStrength) {
        // Attacker is stronger
        if (attackerModifiedStrength >= defenderModifiedStrength * 2) {
            numDice = 3; // Attacker strength is 2x or more = 3 dice
        } else {
            numDice = 2; // Attacker stronger = 2 dice
        }
    } else if (defenderModifiedStrength > attackerModifiedStrength) {
        // Defender is stronger (with modifiers) - always 2 dice
        numDice = 2; // Defender stronger = 2 dice (even if 2x or more)
    }

    // Determine who picks the result (defender picks if their modified strength is higher)
    const defenderPicks = defenderModifiedStrength > attackerModifiedStrength;

    return {
        numDice,
        defenderPicks,
        attackerModifiedStrength,
        defenderModifiedStrength
    };
}

// Count adjacent attacking players (teammates adjacent to the target being blocked, excluding the attacker)
// IMPORTANT: Only counts teammates that are in contact (adjacent) with the DEFENDER (the target of the block)
// This function is called with defender.row, defender.col to ensure we only count assists from teammates
// that are adjacent to the defender, not the attacker
// A attacking player can assist if they are:
// 1. Adjacent to the defender (the target of the block)
// 2. NOT adjacent to any defending players EXCEPT the defender targeted by the block action
function countAdjacentAttackers(row, col, attackingTeam, excludeAttacker, defender) {
    // row, col should be the defender's position (the target of the block)
    // We check all 8 adjacent squares around the DEFENDER to find assisting teammates
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    let count = 0;

    // Check all 8 adjacent squares around the DEFENDER (target of the block)
    for (const [rowOffset, colOffset] of directions) {
        const checkRow = row + rowOffset;
        const checkCol = col + colOffset;

        // Check if within bounds
        if (checkRow >= 0 && checkRow < gameState.boardHeight &&
            checkCol >= 0 && checkCol < gameState.boardWidth) {
            const cellData = gameState.board[checkRow][checkCol];

            // Check if there's an attacking player (teammate) that is:
            // 1. On the attacking team
            // 2. Not knocked down (standing)
            // 3. Not the attacker themselves
            // 4. Adjacent to the DEFENDER (this is ensured by checking squares around row, col which is the defender's position)
            if (cellData.player &&
                cellData.player.team === attackingTeam &&
                !cellData.player.knockedDown &&
                cellData.player !== excludeAttacker) {

                // Check if this attacking player is adjacent to any defending players except the defender
                // If they are, they cannot assist
                const defendingTeam = defender.team;
                const canAssist = !isAdjacentToOpposingPlayers(cellData.player.row, cellData.player.col, defendingTeam, defender);

                if (canAssist) {
                    count++;
                }
            }
        }
    }

    return count;
}

// Process the selected block die result
function processBlockResult(selectedRoll) {
    if (!gameState.pendingBlockRolls) {
        return;
    }

    const { dice, target, attacker } = gameState.pendingBlockRolls;
    const roll = selectedRoll;

    // Clear pending block rolls
    gameState.pendingBlockRolls = null;
    hideBlockDiceButtons();

    let resultMessage = '';

    // Block result based on selected dice roll
    switch(roll) {
        case 1:
            // Attacker down - knocked down and turn ends immediately
            knockDownPlayer(attacker);
            resultMessage = `Attacker Down! ${attacker.id} is knocked down! Turn ends immediately.`;
            updateStatus(`Block! Selected ${roll}. ${resultMessage}`);
            attacker.hasActed = true;
            // If this was a blitz action, mark it as used
            if (gameState.actionMode === 'blitz') {
                gameState.blitzUsed = true;
            }
            gameState.actionMode = null;
            updateActionButtons();
            clearValidMoves();
            endTurn(true, `Player ${attacker.number} was knocked down`); // Automatic turnover
            return; // Exit early since turn ended
        case 2:
            // Both down - knocked down and turn ends immediately
            knockDownPlayer(attacker);
            knockDownPlayer(target);
            resultMessage = `Both Down! Both players are knocked down! Turn ends immediately.`;
            updateStatus(`Block! Selected ${roll}. ${resultMessage}`);
            attacker.hasActed = true;
            // If this was a blitz action, mark it as used
            if (gameState.actionMode === 'blitz') {
                gameState.blitzUsed = true;
            }
            gameState.actionMode = null;
            updateActionButtons();
            clearValidMoves();
            endTurn(true, 'Both players knocked down'); // Automatic turnover
            return; // Exit early since turn ended
        case 3:
        case 4:
            // Pushed - attacker chooses push square
            const defenderOldRow = target.row;
            const defenderOldCol = target.col;
            showPushSelection(target, attacker, defenderOldRow, defenderOldCol, false);
            return; // Exit early, push will be handled after selection
        case 5:
        case 6:
            // Defender pushed back, then knocked down - attacker chooses push square
            const defenderOldRow56 = target.row;
            const defenderOldCol56 = target.col;
            showPushSelection(target, attacker, defenderOldRow56, defenderOldCol56, true);
            return; // Exit early, push will be handled after selection
    }

    updateStatus(`Block! Selected ${roll}. ${resultMessage}`);

    // Only mark as acted and clear action mode if there's no pending follow-up
    if (!gameState.pendingFollowUp) {
        // If this was a blitz action, allow continued movement
        if (gameState.actionMode === 'blitz') {
            gameState.blitzUsed = true; // Mark blitz as used
            // Don't mark as acted yet - allow continued movement
            // Switch back to move mode to allow remaining movement
            gameState.actionMode = 'move';
            gameState.movementPath = []; // Clear any previous path
            clearValidMoves();
            showValidMoves();
            updateActionButtons();
            updateStatus(`Block complete! You can continue moving with remaining movement (${attacker.remainingMovement}). Click adjacent squares to build your movement path.`);
        } else {
            // Normal block - mark as acted and complete
            attacker.hasActed = true;
            gameState.actionMode = null;
            hideBlockCancelButton();
            updateActionButtons();
            clearValidMoves();
        }
    }
}

// Get the result name for a block die roll
function getBlockResultName(roll) {
    switch(roll) {
        case 1:
            return 'Attacker down';
        case 2:
            return 'Both down';
        case 3:
        case 4:
            return 'Push';
        case 5:
            return 'Defender stumbles';
        case 6:
            return 'Defender down';
        default:
            return `Roll ${roll}`;
    }
}

// Show block dice selection buttons
function showBlockDiceButtons(dice, defenderPicks = false) {
    const blockDiceButtons = document.getElementById('block-dice-buttons');
    const diceLabel = blockDiceButtons.querySelector('.dice-label');
    const die1Btn = document.getElementById('btn-die-1');
    const die2Btn = document.getElementById('btn-die-2');
    const die3Btn = document.getElementById('btn-die-3');
    const die1Value = document.getElementById('die-1-value');
    const die2Value = document.getElementById('die-2-value');
    const die3Value = document.getElementById('die-3-value');

    // Update label to show who is picking
    if (defenderPicks) {
        diceLabel.textContent = 'Defender chooses result:';
    } else {
        diceLabel.textContent = 'Attacker chooses result:';
    }

    // Determine which team should be able to pick
    // If defender picks, it's the defender's team; otherwise it's the attacker's team
    // The picking team can always pick (even if it's not their turn, they get to choose the block result)
    const pickingTeam = defenderPicks ?
        (gameState.pendingBlockRolls ? gameState.pendingBlockRolls.target.team : null) :
        (gameState.pendingBlockRolls ? gameState.pendingBlockRolls.attacker.team : null);

    // Allow picking if it's the picking team (they can pick even if it's not their turn)
    // For now, we'll allow any team to pick - in a real game you'd need to coordinate between players
    // But for this implementation, we'll enable buttons for the picking team
    const canPick = pickingTeam !== null;

    // Hide all buttons first
    die1Btn.style.display = 'none';
    die2Btn.style.display = 'none';
    die3Btn.style.display = 'none';

    // Show and set values for the appropriate number of dice
    // Enable buttons for the picking team (they can pick even if it's not their turn)
    if (dice.length >= 1) {
        die1Value.textContent = getBlockResultName(dice[0]);
        die1Btn.style.display = 'inline-block';
        die1Btn.disabled = !canPick;
    }
    if (dice.length >= 2) {
        die2Value.textContent = getBlockResultName(dice[1]);
        die2Btn.style.display = 'inline-block';
        die2Btn.disabled = !canPick;
    }
    if (dice.length >= 3) {
        die3Value.textContent = getBlockResultName(dice[2]);
        die3Btn.style.display = 'inline-block';
        die3Btn.disabled = !canPick;
    }

    blockDiceButtons.style.display = 'flex';

    // Hide the block cancel button when showing dice buttons
    hideBlockCancelButton();
}

// Hide block dice selection buttons
function hideBlockDiceButtons() {
    const blockDiceButtons = document.getElementById('block-dice-buttons');
    blockDiceButtons.style.display = 'none';
}

// Attempt pass
function attemptPass(row, col) {
    const player = gameState.selectedPlayer;
    if (!player) return;

    // Check if player has the ball
    if (!player.hasBall) {
        updateStatus('Player must have the ball to pass.');
        return;
    }

    // Check if pass has already been used this turn
    if (gameState.passUsed) {
        updateStatus('Pass action has already been used this turn.');
        return;
    }

    const targetCell = gameState.board[row][col];

    if (!targetCell.player || targetCell.player.team !== player.team) {
        updateStatus('No teammate to pass to at that location.');
        return;
    }

    const targetPlayer = targetCell.player;

    // Cannot pass to knocked down player
    if (targetPlayer.knockedDown) {
        updateStatus('Cannot pass to a knocked down player.');
        return;
    }

    // Cannot pass to self
    if (targetPlayer === player) {
        updateStatus('Cannot pass to yourself.');
        return;
    }

    // Get current position (starting position or end of current path)
    let currentRow = player.row;
    let currentCol = player.col;
    if (gameState.movementPath.length > 0) {
        const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
        currentRow = lastStep.row;
        currentCol = lastStep.col;
    }

    // Calculate distance (Manhattan distance)
    const rowDiff = Math.abs(targetPlayer.row - currentRow);
    const colDiff = Math.abs(targetPlayer.col - currentCol);
    const distance = rowDiff + colDiff;

    // Check maximum pass distance (13 squares)
    if (distance > 13) {
        updateStatus(`Cannot pass! Maximum pass distance is 13 squares. Target is ${distance} squares away.`);
        return;
    }

    // If there's a movement path, execute it first, then pass
    if (gameState.movementPath.length > 0) {
        // Store the pass target and execute movement first
        gameState.passTarget = { row, col };
        executeMovement();
        return;
    }

    // Cannot pass if knocked down (unless they just stood up)
    if (player.knockedDown && !gameState.stoodUpThisMove) {
        updateStatus('Cannot pass while knocked down. You must stand up first by declaring a move action.');
        return;
    }

    // Mark pass as used
    gameState.passUsed = true;

    // Roll for throw (d6 against agility)
    const throwRoll = Math.floor(Math.random() * 6) + 1;
    const throwTarget = player.agility;

    if (throwRoll >= throwTarget) {
        // Throw successful - now attempt catch
        updateStatus(`Pass throw: Rolled ${throwRoll} (needed ${throwTarget}+). Success! Ball is thrown ${distance} squares.`);

        // Calculate catch modifier based on distance
        // Negative modifier means harder to catch (target number increases)
        // We add to target, but display as negative modifier to roll
        let catchModifier = 0;
        let modifierText = '';
        if (distance >= 10) {
            catchModifier = 3; // +3 to target (harder) = -3 modifier to roll
            modifierText = ' (10+ squares = -3 modifier)';
        } else if (distance >= 7) {
            catchModifier = 2; // +2 to target (harder) = -2 modifier to roll
            modifierText = ' (7-9 squares = -2 modifier)';
        } else if (distance >= 4) {
            catchModifier = 1; // +1 to target (harder) = -1 modifier to roll
            modifierText = ' (4-6 squares = -1 modifier)';
        } else {
            modifierText = ' (0-3 squares = no modifier)';
        }

        // Roll for catch (d6 against agility with distance modifier)
        // Modifier makes it harder (increases target number)
        const catchRoll = Math.floor(Math.random() * 6) + 1;
        const catchTarget = targetPlayer.agility + catchModifier;

        if (catchRoll >= catchTarget) {
            // Catch successful
            player.hasBall = false;
            gameState.ballHolder = null;
            targetPlayer.hasBall = true;
            gameState.ballHolder = targetPlayer;

            // Update ball visual - remove from thrower
            const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
            if (playerElement) {
                playerElement.classList.remove('has-ball');
                // Remove ball icon if it exists
                const ball = playerElement.querySelector('.ball');
                if (ball) {
                    ball.remove();
                }
            }

            // Update ball visual - add to catcher
            const targetElement = document.querySelector(`[data-player-id="${targetPlayer.id}"]`);
            if (targetElement) {
                targetElement.classList.add('has-ball');
                // Add ball icon if it doesn't exist
                if (!targetElement.querySelector('.ball')) {
                    const ball = document.createElement('div');
                    ball.className = 'ball';
                    ball.textContent = '🏈';
                    targetElement.appendChild(ball);
                }
            }

            // Remove ball from ground if it exists
            if (gameState.ballPosition) {
                const ballCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
                const ballOnGround = ballCell.cell.querySelector('.ball-on-ground');
                if (ballOnGround) {
                    ballOnGround.remove();
                }
                gameState.ballPosition = null;
            }

            updateStatus(`Catch: Rolled ${catchRoll} (needed ${targetPlayer.agility}+${modifierText}). Success! Player ${targetPlayer.number} catches the ball!`);

            // Check for touchdown if catcher is in opposition endzone
            checkTouchdown(targetPlayer);
        } else {
            // Catch failed - fumble, scatter 1 square, turnover
            updateStatus(`Catch: Rolled ${catchRoll} (needed ${targetPlayer.agility}+${modifierText}). Failed! Ball fumbled.`);

            // Drop ball at target player's position first
            player.hasBall = false;
            gameState.ballHolder = null;

            // Update ball visual
            const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
            if (playerElement) {
                playerElement.classList.remove('has-ball');
            }

            // Place ball at target player's position and scatter 1 square
            gameState.ballPosition = { row: targetPlayer.row, col: targetPlayer.col };
            scatterBallDirection(targetPlayer.row, targetPlayer.col, 1, player.team, false);

            // Turnover
            player.hasActed = true;
            gameState.actionMode = null;
            updateActionButtons();
            clearValidMoves();
            endTurn(true, `Pass catch failed`);
            return;
        }
    } else {
        // Throw failed - fumble, scatter 1 square, turnover
        updateStatus(`Pass throw: Rolled ${throwRoll} (needed ${throwTarget}+). Failed! Ball fumbled.`);

        // Drop ball at player's position first
        player.hasBall = false;
        gameState.ballHolder = null;

        // Update ball visual
        const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
        if (playerElement) {
            playerElement.classList.remove('has-ball');
        }

        // Place ball at player's position and scatter 1 square
        gameState.ballPosition = { row: player.row, col: player.col };
        scatterBallDirection(player.row, player.col, 1, player.team, false);

        // Turnover
        player.hasActed = true;
        gameState.actionMode = null;
        updateActionButtons();
        clearValidMoves();
        endTurn(true, `Pass throw failed`);
        return;
    }

    // Pass completed successfully - player cannot do anything else
    player.hasActed = true;
    gameState.actionMode = null;
    updateActionButtons();
    clearValidMoves();
    clearSelectedPlayer();
}

// Push player back one space away from attacker
// targetSquare: optional {row, col} - if provided, push to this specific square
function pushPlayerBack(defender, attacker, targetSquare = null) {
    let newRow, newCol;

    if (targetSquare) {
        // Use provided target square
        newRow = targetSquare.row;
        newCol = targetSquare.col;
    } else {
        // Calculate direction from attacker to defender (legacy behavior)
        const rowDiff = defender.row - attacker.row;
        const colDiff = defender.col - attacker.col;

        // Determine push direction (away from attacker)
        newRow = defender.row;
        newCol = defender.col;

        if (Math.abs(rowDiff) > Math.abs(colDiff)) {
            // Push vertically
            newRow = defender.row + (rowDiff > 0 ? 1 : -1);
        } else if (colDiff !== 0) {
            // Push horizontally
            newCol = defender.col + (colDiff > 0 ? 1 : -1);
        } else {
            // Same position, push to the right (towards Team 2's endzone)
            newCol = defender.col + 1;
        }
    }

    // Check if push position is valid (within bounds and empty)
    if (newRow >= 0 && newRow < gameState.boardHeight &&
        newCol >= 0 && newCol < gameState.boardWidth &&
        !gameState.board[newRow][newCol].player) {
        // Move defender to new position (without touchdown check)
        const oldCell = gameState.board[defender.row][defender.col];
        const newCell = gameState.board[newRow][newCol];

        // Update board state
        oldCell.player = null;
        newCell.player = defender;

        // Move visual element (ball moves with player if they have it)
        const playerElement = document.querySelector(`[data-player-id="${defender.id}"]`);
        if (playerElement && oldCell.cell.contains(playerElement)) {
            oldCell.cell.removeChild(playerElement);
            newCell.cell.appendChild(playerElement);
        } else if (playerElement) {
            // Element exists but not in old cell (might have been moved already), just append to new cell
            newCell.cell.appendChild(playerElement);
        }

        // Update player position
        defender.row = newRow;
        defender.col = newCol;

        // Note: Ball stays with player during push - it will only scatter if they're knocked down later

        return { success: true };
    } else {
        // Can't push back, defender falls down instead
        // Ball will scatter from current position when knocked down
        knockDownPlayer(defender);
        return { success: false };
    }
}

// Calculate ALL possible push squares (including occupied ones) - for chain pushing
function calculateAllPushSquares(defender, attacker) {
    // Calculate direction from attacker to defender
    const rowDiff = defender.row - attacker.row;
    const colDiff = defender.col - attacker.col;

    // The 3 push squares are the 3 squares directly behind the defender
    // (away from attacker), forming a line perpendicular to the attacker-defender line
    const pushSquares = [];

    // Check if block is diagonal
    const isDiagonal = rowDiff !== 0 && colDiff !== 0;

    if (isDiagonal) {
        // For diagonal blocks: the 3 push squares are the 3 adjacent squares behind the defender
        const directlyBehind = {
            row: defender.row + (rowDiff > 0 ? 1 : -1),
            col: defender.col + (colDiff > 0 ? 1 : -1)
        };
        const rightSquare = {
            row: defender.row,
            col: defender.col + (colDiff > 0 ? 1 : -1)
        };
        const belowSquare = {
            row: defender.row + (rowDiff > 0 ? 1 : -1),
            col: defender.col
        };
        pushSquares.push(directlyBehind);
        pushSquares.push(rightSquare);
        pushSquares.push(belowSquare);
    } else {
        // For non-diagonal blocks (horizontal or vertical)
        let primaryRowOffset = 0;
        let primaryColOffset = 0;

        if (rowDiff !== 0) {
            // Vertical block: push squares are horizontal line
            primaryRowOffset = rowDiff > 0 ? 1 : -1;
            pushSquares.push({
                row: defender.row + primaryRowOffset,
                col: defender.col
            });
            pushSquares.push({
                row: defender.row + primaryRowOffset,
                col: defender.col - 1
            });
            pushSquares.push({
                row: defender.row + primaryRowOffset,
                col: defender.col + 1
            });
        } else if (colDiff !== 0) {
            // Horizontal block: push squares are vertical line
            primaryColOffset = colDiff > 0 ? 1 : -1;
            pushSquares.push({
                row: defender.row,
                col: defender.col + primaryColOffset
            });
            pushSquares.push({
                row: defender.row - 1,
                col: defender.col + primaryColOffset
            });
            pushSquares.push({
                row: defender.row + 1,
                col: defender.col + primaryColOffset
            });
        } else {
            // Same position, default to right
            pushSquares.push({
                row: defender.row,
                col: defender.col + 1
            });
            pushSquares.push({
                row: defender.row - 1,
                col: defender.col + 1
            });
            pushSquares.push({
                row: defender.row + 1,
                col: defender.col + 1
            });
        }
    }

    // Filter to only squares within bounds (but include occupied squares)
    return pushSquares.filter(square =>
        square.row >= 0 && square.row < gameState.boardHeight &&
        square.col >= 0 && square.col < gameState.boardWidth
    );
}

// Calculate the 3 possible push squares (backwards from defender relative to attacker)
// Returns only empty squares (for normal push selection)
function calculatePushSquares(defender, attacker) {
    // Get all push squares (including occupied)
    const allPushSquares = calculateAllPushSquares(defender, attacker);

    // Filter to only empty squares
    return allPushSquares.filter(square =>
        !gameState.board[square.row][square.col].player
    );
}

// Check if a player is at the edge of the board
function isPlayerAtEdge(player) {
    return player.row === 0 ||
           player.row === gameState.boardHeight - 1 ||
           player.col === 0 ||
           player.col === gameState.boardWidth - 1;
}

// Show push selection squares and store push state
function showPushSelection(target, attacker, defenderOldRow, defenderOldCol, shouldKnockDown) {
    const emptyPushSquares = calculatePushSquares(target, attacker);
    const allPushSquares = calculateAllPushSquares(target, attacker);

    // Check if all push squares are occupied (chain pushing scenario)
    const allOccupied = emptyPushSquares.length === 0 && allPushSquares.length > 0;

    if (allOccupied) {
        // All push squares are occupied - chain pushing
        // Show all push squares (including occupied ones) for selection
        gameState.pendingPushSelection = {
            target: target,
            attacker: attacker,
            defenderOldRow: defenderOldRow,
            defenderOldCol: defenderOldCol,
            shouldKnockDown: shouldKnockDown,
            pushSquares: allPushSquares,
            isChainPush: true
        };

        // Highlight all push squares (including occupied ones)
        allPushSquares.forEach(square => {
            const cell = gameState.board[square.row][square.col].cell;
            cell.classList.add('valid-push');
            // Add special class for occupied squares in chain push
            if (gameState.board[square.row][square.col].player) {
                cell.classList.add('chain-push-target');
            }
        });

        updateStatus(`Block! All push squares are occupied. Choose a square to push ${target.id} to (chain pushing - the player in that square will be pushed).`);
        return;
    }

    if (emptyPushSquares.length === 0) {
        // No valid push squares
        // If player is at the edge of the board, remove them (pushed off)
        if (isPlayerAtEdge(target)) {
            // Player is pushed off the board - remove them
            removePlayerFromBoard(target, { row: defenderOldRow, col: defenderOldCol });
            updateStatus(`Block! ${target.id} is pushed off the board and removed from play!`);

            // Offer follow-up option (attacker can move to defender's old position)
            gameState.pendingFollowUp = {
                attacker: attacker,
                defenderOldRow: defenderOldRow,
                defenderOldCol: defenderOldCol
            };
            showFollowUpButtons();

            // Don't complete block action yet - wait for follow-up decision
            return;
        } else {
            // Not at edge, defender falls down instead
            knockDownPlayer(target, { row: defenderOldRow, col: defenderOldCol });
            updateStatus(`Block! ${target.id} could not be pushed and is knocked down!`);

            // Complete block action
            attacker.hasActed = true;
            // If this was a blitz action, mark it as used
            if (gameState.actionMode === 'blitz') {
                gameState.blitzUsed = true;
            }
            gameState.actionMode = null;
            updateActionButtons();
            clearValidMoves();
            clearSelectedPlayer();
            return;
        }
    }

    // Store push selection state
    gameState.pendingPushSelection = {
        target: target,
        attacker: attacker,
        defenderOldRow: defenderOldRow,
        defenderOldCol: defenderOldCol,
        shouldKnockDown: shouldKnockDown,
        pushSquares: emptyPushSquares,
        isChainPush: false
    };

    // Highlight valid push squares
    emptyPushSquares.forEach(square => {
        const cell = gameState.board[square.row][square.col].cell;
        cell.classList.add('valid-push');
    });

    updateStatus(`Block! Choose a square to push ${target.id} to (${emptyPushSquares.length} option${emptyPushSquares.length > 1 ? 's' : ''} available).`);
}

// Handle push square selection (supports chain pushing)
function handlePushSquareSelection(row, col) {
    if (!gameState.pendingPushSelection) {
        return;
    }

    const { target, attacker, defenderOldRow, defenderOldCol, shouldKnockDown, pushSquares, isChainPush } = gameState.pendingPushSelection;

    // Check if selected square is a valid push square
    const isValidSquare = pushSquares.some(square => square.row === row && square.col === col);

    if (!isValidSquare) {
        updateStatus('Invalid push square. Please select one of the highlighted squares.');
        return;
    }

    // Check if selected square is occupied (chain pushing)
    const cellData = gameState.board[row][col];
    const occupiedPlayer = cellData.player;

    if (occupiedPlayer && occupiedPlayer !== target) {
        // Chain pushing: push the player in the selected square first
        // Store the original push state for after the chain
        const originalPushState = {
            target: target,
            attacker: attacker,
            defenderOldRow: defenderOldRow,
            defenderOldCol: defenderOldCol,
            shouldKnockDown: shouldKnockDown,
            targetSquare: { row, col }
        };

        // Clear current push selection UI
        clearPushSelection();

        // Recursively push the occupied player
        const chainPushSquares = calculatePushSquares(occupiedPlayer, target);
        const chainAllPushSquares = calculateAllPushSquares(occupiedPlayer, target);
        const chainAllOccupied = chainPushSquares.length === 0 && chainAllPushSquares.length > 0;

        if (chainAllOccupied) {
            // Continue chain - show push selection for the next player
            gameState.pendingPushSelection = {
                target: occupiedPlayer,
                attacker: target, // The previous defender becomes the attacker in the chain
                defenderOldRow: occupiedPlayer.row,
                defenderOldCol: occupiedPlayer.col,
                shouldKnockDown: false, // Chain pushes don't knock down until the final push
                pushSquares: chainAllPushSquares,
                isChainPush: true,
                chainState: originalPushState // Store original state to continue after chain
            };

            // Highlight chain push squares
            chainAllPushSquares.forEach(square => {
                const cell = gameState.board[square.row][square.col].cell;
                cell.classList.add('valid-push');
                if (gameState.board[square.row][square.col].player) {
                    cell.classList.add('chain-push-target');
                }
            });

            updateStatus(`Chain push! Choose a square to push ${occupiedPlayer.id} to (chain continues).`);
            return;
        } else if (chainPushSquares.length > 0) {
            // Chain can continue to empty squares - show selection
            gameState.pendingPushSelection = {
                target: occupiedPlayer,
                attacker: target,
                defenderOldRow: occupiedPlayer.row,
                defenderOldCol: occupiedPlayer.col,
                shouldKnockDown: false,
                pushSquares: chainPushSquares,
                isChainPush: false,
                chainState: originalPushState
            };

            chainPushSquares.forEach(square => {
                const cell = gameState.board[square.row][square.col].cell;
                cell.classList.add('valid-push');
            });

            updateStatus(`Chain push! Choose a square to push ${occupiedPlayer.id} to.`);
            return;
        } else {
            // Chain ends - occupied player falls down (at edge or no valid squares)
            if (isPlayerAtEdge(occupiedPlayer)) {
                removePlayerFromBoard(occupiedPlayer, { row: occupiedPlayer.row, col: occupiedPlayer.col });
                updateStatus(`Chain push! ${occupiedPlayer.id} is pushed off the board!`);
            } else {
                knockDownPlayer(occupiedPlayer);
                updateStatus(`Chain push! ${occupiedPlayer.id} could not be pushed and is knocked down!`);
            }

            // Now push the original target to the now-empty square
            const pushResult = pushPlayerBack(target, attacker, { row, col });
            if (pushResult.success) {
                if (shouldKnockDown) {
                    knockDownPlayer(target, { row: defenderOldRow, col: defenderOldCol });
                }
                // Complete the block action
                completeChainPushBlock(attacker, defenderOldRow, defenderOldCol, shouldKnockDown);
            } else {
                // Shouldn't happen, but handle it
                knockDownPlayer(target, { row: defenderOldRow, col: defenderOldCol });
                completeChainPushBlock(attacker, defenderOldRow, defenderOldCol, shouldKnockDown);
            }
            return;
        }
    }

    // Normal push (square is empty)
    // Check if this is part of a chain push
    const chainState = gameState.pendingPushSelection.chainState;

    if (chainState) {
        // This is resolving a chain push - push the chain player first, then the original target
        clearPushSelection();

        // Push the chain player to the selected empty square
        const chainPushResult = pushPlayerBack(target, attacker, { row, col });

        if (chainPushResult.success) {
            // Now push the original target to the square that was just cleared
            const originalTargetSquare = chainState.targetSquare;
            const originalPushResult = pushPlayerBack(chainState.target, chainState.attacker, originalTargetSquare);

            if (originalPushResult.success) {
                if (chainState.shouldKnockDown) {
                    knockDownPlayer(chainState.target, { row: chainState.defenderOldRow, col: chainState.defenderOldCol });
                }
                updateStatus(`Chain push complete! ${target.id} pushed to (${row}, ${col}), ${chainState.target.id} pushed to (${originalTargetSquare.row}, ${originalTargetSquare.col})${chainState.shouldKnockDown ? ' and knocked down' : ''}.`);
                completeChainPushBlock(chainState.attacker, chainState.defenderOldRow, chainState.defenderOldCol, chainState.shouldKnockDown);
            } else {
                // Original push failed - shouldn't happen
                knockDownPlayer(chainState.target, { row: chainState.defenderOldRow, col: chainState.defenderOldCol });
                completeChainPushBlock(chainState.attacker, chainState.defenderOldRow, chainState.defenderOldCol, chainState.shouldKnockDown);
            }
        } else {
            // Chain push failed - shouldn't happen
            knockDownPlayer(target);
            knockDownPlayer(chainState.target, { row: chainState.defenderOldRow, col: chainState.defenderOldCol });
            completeChainPushBlock(chainState.attacker, chainState.defenderOldRow, chainState.defenderOldCol, chainState.shouldKnockDown);
        }
        return;
    }

    // Normal push (not part of a chain)
    // Clear push selection UI
    clearPushSelection();

    // Push defender to selected square
    const pushResult = pushPlayerBack(target, attacker, { row, col });

    let resultMessage = '';

    if (pushResult.success) {
        if (shouldKnockDown) {
            // Knock down defender after push
            knockDownPlayer(target, { row: defenderOldRow, col: defenderOldCol });
            resultMessage = `Defender Down! ${target.id} is pushed back and knocked down!`;

            // Offer follow-up option
            gameState.pendingFollowUp = {
                attacker: attacker,
                defenderOldRow: defenderOldRow,
                defenderOldCol: defenderOldCol
            };
            showFollowUpButtons();
        } else {
            // Just pushed, offer follow-up option
            resultMessage = `Pushed! ${target.id} is pushed back!`;
            gameState.pendingFollowUp = {
                attacker: attacker,
                defenderOldRow: defenderOldRow,
                defenderOldCol: defenderOldCol
            };
            showFollowUpButtons();
        }
    } else {
        // Push failed (shouldn't happen if we validated, but handle it)
        resultMessage = `Pushed! ${target.id} could not be pushed and is knocked down!`;
    }

    updateStatus(`Block! ${resultMessage}`);

    // Clear push selection state
    gameState.pendingPushSelection = null;

    // Only mark as acted and clear action mode if there's no pending follow-up
    if (!gameState.pendingFollowUp) {
        // If this was a blitz action, allow continued movement
        if (gameState.actionMode === 'blitz') {
            gameState.blitzUsed = true; // Mark blitz as used
            // Don't mark as acted yet - allow continued movement
            // Switch back to move mode to allow remaining movement
            gameState.actionMode = 'move';
            gameState.movementPath = []; // Clear any previous path
            clearValidMoves();
            showValidMoves();
            updateActionButtons();
            updateStatus(`Block complete! You can continue moving with remaining movement (${attacker.remainingMovement}). Click adjacent squares to build your movement path.`);
        } else {
            // Normal block - mark as acted and complete
            attacker.hasActed = true;
            gameState.actionMode = null;
            updateActionButtons();
            clearValidMoves();
            clearSelectedPlayer();
        }
    }
}

// Complete block action after chain push resolves
function completeChainPushBlock(attacker, defenderOldRow, defenderOldCol, shouldKnockDown) {
    // Clear push selection state
    gameState.pendingPushSelection = null;

    if (shouldKnockDown) {
        // Offer follow-up option
        gameState.pendingFollowUp = {
            attacker: attacker,
            defenderOldRow: defenderOldRow,
            defenderOldCol: defenderOldCol
        };
        showFollowUpButtons();
    } else {
        // Just pushed, offer follow-up option
        gameState.pendingFollowUp = {
            attacker: attacker,
            defenderOldRow: defenderOldRow,
            defenderOldCol: defenderOldCol
        };
        showFollowUpButtons();
    }

    // Only mark as acted and clear action mode if there's no pending follow-up
    if (!gameState.pendingFollowUp) {
        // If this was a blitz action, allow continued movement
        if (gameState.actionMode === 'blitz') {
            gameState.blitzUsed = true;
            gameState.actionMode = 'move';
            gameState.movementPath = [];
            clearValidMoves();
            showValidMoves();
            updateActionButtons();
            updateStatus(`Block complete! You can continue moving with remaining movement (${attacker.remainingMovement}). Click adjacent squares to build your movement path.`);
        } else {
            attacker.hasActed = true;
            gameState.actionMode = null;
            hideBlockCancelButton();
            updateActionButtons();
            clearValidMoves();
            clearSelectedPlayer();
        }
    }
}

// Clear push selection UI
function clearPushSelection() {
    document.querySelectorAll('.valid-push').forEach(cell => {
        cell.classList.remove('valid-push');
    });
    document.querySelectorAll('.chain-push-target').forEach(cell => {
        cell.classList.remove('chain-push-target');
    });
}

// Clear selected player highlighting
function clearSelectedPlayer() {
    document.querySelectorAll('.cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    document.querySelectorAll('.player.selected').forEach(p => {
        p.classList.remove('selected');
    });
    gameState.selectedPlayer = null;
}

// Knock down a player (they fall over but remain on the board)
// scatterFromPosition: optional {row, col} - if provided, ball scatters from this position instead of player's current position
function knockDownPlayer(player, scatterFromPosition = null) {
    player.knockedDown = true;

    // If player has the ball, drop it (mark that ball-holder was knocked down)
    if (player.hasBall) {
        dropBall(player, scatterFromPosition, true);
    }

    // Check if ball is on the ground in the player's square - if so, scatter it
    if (gameState.ballPosition &&
        gameState.ballPosition.row === player.row &&
        gameState.ballPosition.col === player.col) {
        // Ball is in the square where player was knocked down - scatter it
        const ballRow = player.row;
        const ballCol = player.col;
        scatterBall(ballRow, ballCol, null, false);
        updateStatus(`Player ${player.number} knocked down into the ball! Ball scatters.`);
    }

    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    if (playerElement) {
        playerElement.classList.add('knocked-down');
    }
}

// Drop the ball from a player and scatter it
// scatterFromPosition: optional {row, col} - if provided, ball scatters from this position instead of player's current position
// ballHolderKnockedDown: if true, indicates the ball-holder was knocked down (turn should end regardless of who catches it)
function dropBall(player, scatterFromPosition = null, ballHolderKnockedDown = false) {
    if (player.hasBall) {
        // Use provided scatter position (original position before push) or player's current position
        const scatterRow = scatterFromPosition ? scatterFromPosition.row : player.row;
        const scatterCol = scatterFromPosition ? scatterFromPosition.col : player.col;

        player.hasBall = false;
        gameState.ballHolder = null;

        // Find player element - try multiple times if needed (in case element was just moved)
        let playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
        if (!playerElement && player.row >= 0 && player.col >= 0 && player.row < gameState.boardHeight && player.col < gameState.boardWidth) {
            // If not found, try to find it in the current cell
            const cell = gameState.board[player.row][player.col];
            if (cell && cell.cell) {
                playerElement = cell.cell.querySelector(`[data-player-id="${player.id}"]`);
            }
        }

        if (playerElement) {
            playerElement.classList.remove('has-ball');
            const ball = playerElement.querySelector('.ball');
            if (ball) {
                ball.remove();
            }
        }
        // Scatter the ball using D9 from the specified position (original position if pushed, otherwise current position)
        // Pass the player's team and whether they were knocked down
        scatterBall(scatterRow, scatterCol, player.team, ballHolderKnockedDown);
    }
}

// Check if a pickup roll is successful
// Roll 1 is always failure, roll 6 is always success
// Otherwise, success if roll >= targetNumber
// targetNumber = baseTarget + tackleZoneModifier
// Each tackle zone adds +1 to the target number (making it harder)
function isPickupSuccessful(roll, agility, tackleZoneModifier = 0) {
    if (roll === 1) {
        return false; // Roll of 1 is always failure
    }
    if (roll === 6) {
        return true; // Roll of 6 is always success
    }
    // Calculate base target number: agility <= 2 uses 7 - agility, else 6 - agility
    const baseTarget = agility <= 2 ? 7 - agility : 6 - agility;
    // Apply tackle zone modifier (each tackle zone adds +1 to target)
    const targetNumber = baseTarget + tackleZoneModifier;
    return roll >= targetNumber;
}

// Get the target number for pickup display
function getPickupTargetNumber(agility, tackleZoneModifier = 0) {
    const baseTarget = agility <= 2 ? 7 - agility : 6 - agility;
    return baseTarget + tackleZoneModifier;
}

// Attempt to pick up the ball when it scatters onto a player's square
// D6 roll against player's agility
// originalTeam: the team that originally attempted the pickup (for turn ending logic)
// ballHolderKnockedDown: if true, the ball-holder was knocked down (turn should end regardless of who catches it)
function attemptBallPickupOnScatter(player, ballRow, ballCol, scatterRoll = null, originalTeam = null, ballHolderKnockedDown = false) {
    if (player.hasBall || !gameState.ballPosition) {
        return; // Already has ball or no ball to pick up
    }

    // Check if ball is at player's position
    if (gameState.ballPosition.row !== ballRow ||
        gameState.ballPosition.col !== ballCol) {
        return; // Ball not at expected position
    }

    // If no original team specified, use the current player's team (first attempt)
    if (originalTeam === null) {
        originalTeam = player.team;
    }

    // Roll D6 for pickup attempt
    const roll = rollDice();
    const agility = player.agility;
    const targetNumber = getPickupTargetNumber(agility);
    const success = isPickupSuccessful(roll, agility);

    if (success) {
        // Successful pickup
        giveBallToPlayer(player);
        const scatterText = scatterRoll ? ` Rolled ${scatterRoll} on D9 scatter,` : '';
        updateStatus(`Ball scattered to (${ballRow}, ${ballCol})!${scatterText} Player ${player.number} attempts pickup: Rolled ${roll} (needed ${targetNumber}+, 1 always fails, 6 always succeeds). Success! Player ${player.number} has the ball!`);

        // End turn if: opposing team caught it, OR ball-holder was knocked down (even if same team caught it)
        if (player.team !== originalTeam || ballHolderKnockedDown) {
            if (ballHolderKnockedDown) {
                updateStatus(`Ball-holder was knocked down. Turn ends.`);
            } else {
                updateStatus(`Opposing team caught the ball! Turn ends.`);
            }
            endTurn(true, 'Opposing team caught the ball'); // Automatic turnover
        }
        // If same team caught it and ball-holder was not knocked down, turn continues (no endTurn call)
    } else {
        // Failed pickup - ball scatters again
        const scatterText = scatterRoll ? ` Rolled ${scatterRoll} on D9 scatter,` : '';
        const modifierText = tackleZones > 0 ? ` (${tackleZones} tackle zone${tackleZones > 1 ? 's' : ''} = +${tackleZones} modifier)` : '';
        updateStatus(`Ball scattered to (${ballRow}, ${ballCol})!${scatterText} Player ${player.number} attempts pickup: Rolled ${roll} (needed ${targetNumber}+${modifierText}, 1 always fails, 6 always succeeds). Failed! Ball scatters again...`);

        // If ball-holder was knocked down, any failed catch causes a turnover
        if (ballHolderKnockedDown) {
            updateStatus(`Ball-holder was knocked down and ball was dropped. Turn ends.`);
            endTurn(true, 'Ball-holder knocked down, ball dropped'); // Automatic turnover
            return;
        }

        // Scatter the ball again from current position, passing along original team and ballHolderKnockedDown flag
        scatterBall(ballRow, ballCol, originalTeam, ballHolderKnockedDown);
    }
}

// Attempt to pick up the ball (during movement)
function attemptBallPickup(player) {
    if (player.hasBall || !gameState.ballPosition) {
        return; // Already has ball or no ball to pick up
    }

    // Check if ball is at player's position and square is unoccupied (except by player)
    if (gameState.ballPosition.row !== player.row ||
        gameState.ballPosition.col !== player.col) {
        return; // Ball not at player's position
    }

    const cell = gameState.board[player.row][player.col];
    if (cell.player && cell.player !== player) {
        return; // Square is occupied by another player
    }

    // Roll D6 for pickup attempt
    const roll = rollDice();
    const agility = player.agility;
    const targetNumber = getPickupTargetNumber(agility);
    const success = isPickupSuccessful(roll, agility);

    if (success) {
        // Successful pickup
        giveBallToPlayer(player);
        updateStatus(`Ball pickup successful! Rolled ${roll} (needed ${targetNumber}+, 1 always fails, 6 always succeeds). Player ${player.number} has the ball!`);
    } else {
        // Failed pickup - ball scatters to random adjacent square and turn ends
        updateStatus(`Ball pickup failed! Rolled ${roll} (needed ${targetNumber}+, 1 always fails, 6 always succeeds). Ball scatters!`);
        scatterBallToRandomAdjacent(player.row, player.col);
        endTurn(true, `Ball pickup failed`); // Automatic turnover
    }
}

// Scatter ball to a random adjacent square (used for failed pickup)
function scatterBallToRandomAdjacent(originRow, originCol) {
    // Get all adjacent squares (including diagonals)
    const adjacentSquares = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue; // Skip same square

            const newRow = originRow + rowOffset;
            const newCol = originCol + colOffset;

            // Check if within bounds
            if (newRow >= 0 && newRow < gameState.boardHeight &&
                newCol >= 0 && newCol < gameState.boardWidth) {
                adjacentSquares.push({ row: newRow, col: newCol });
            }
        }
    }

    if (adjacentSquares.length === 0) {
        // No valid adjacent squares, ball stays in place
        return;
    }

    // Pick a random adjacent square
    const randomIndex = Math.floor(Math.random() * adjacentSquares.length);
    const scatterSquare = adjacentSquares[randomIndex];

    // Remove ball from previous ground position if it exists
    if (gameState.ballPosition) {
        const prevBallCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
        const prevBallOnGround = prevBallCell.cell.querySelector('.ball-on-ground');
        if (prevBallOnGround) {
            prevBallOnGround.remove();
        }
    }

    // Place ball on the ground at scatter position
    gameState.ballPosition = { row: scatterSquare.row, col: scatterSquare.col };
    const ballCell = gameState.board[scatterSquare.row][scatterSquare.col];

    // Add ball visual to the cell
    const ballOnGround = document.createElement('div');
    ballOnGround.className = 'ball-on-ground';
    ballOnGround.textContent = '🏈';
    ballCell.cell.appendChild(ballOnGround);

    // Check if a player is on that square - if so, they attempt to pick it up
    if (ballCell.player && !ballCell.player.knockedDown) {
        attemptBallPickupOnScatter(ballCell.player, scatterSquare.row, scatterSquare.col);
    } else {
        updateStatus(`Ball scattered to adjacent square (${scatterSquare.row}, ${scatterSquare.col}).`);
    }
}

// Place ball on the ground at a specific position
function placeBallOnGround(row, col) {
    // Remove ball from previous ground position if it exists
    if (gameState.ballPosition) {
        const prevBallCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
        const prevBallOnGround = prevBallCell.cell.querySelector('.ball-on-ground');
        if (prevBallOnGround) {
            prevBallOnGround.remove();
        }
    }

    // Place ball on the ground at specified position
    gameState.ballPosition = { row, col };
    const ballCell = gameState.board[row][col];

    // Add ball visual to the cell
    const ballOnGround = document.createElement('div');
    ballOnGround.className = 'ball-on-ground';
    ballOnGround.textContent = '🏈';
    ballCell.cell.appendChild(ballOnGround);

    // Check if a player is on that square - if so, they pick it up automatically
    if (ballCell.player && !ballCell.player.knockedDown) {
        giveBallToPlayer(ballCell.player);
    }
}

// Place ball adjacent to Player 2 of the current team
function placeBallAdjacentToCurrentTeamPlayer2() {
    const currentTeamPlayer2 = gameState.players.find(p => p.team === gameState.currentTeam && p.number === 2);
    if (currentTeamPlayer2) {
        // Place ball to the left of Player 2 (or another adjacent square if that's occupied)
        const ballRow = currentTeamPlayer2.row;
        const ballCol = currentTeamPlayer2.col - 1; // Left of player

        // Check if that square is valid and unoccupied
        if (ballCol >= 0 && ballCol < gameState.boardWidth &&
            !gameState.board[ballRow][ballCol].player) {
            placeBallOnGround(ballRow, ballCol);
        } else {
            // Try other adjacent squares if left is occupied
            const adjacentOptions = [
                { row: ballRow - 1, col: currentTeamPlayer2.col }, // Top
                { row: ballRow + 1, col: currentTeamPlayer2.col }, // Bottom
                { row: ballRow, col: currentTeamPlayer2.col + 1 }, // Right
            ];

            for (const option of adjacentOptions) {
                if (option.row >= 0 && option.row < gameState.boardHeight &&
                    option.col >= 0 && option.col < gameState.boardWidth &&
                    !gameState.board[option.row][option.col].player) {
                    placeBallOnGround(option.row, option.col);
                    break;
                }
            }
        }
    }
}

// Scatter the ball using a D9 - lands in same square or any adjacent square
// originalTeam: optional - the team that originally attempted pickup (for turn ending logic)
// ballHolderKnockedDown: optional - if true, the ball-holder was knocked down (turn should end regardless of who catches it)
function scatterBall(originRow, originCol, originalTeam = null, ballHolderKnockedDown = false) {
    // Roll D9 to determine scatter direction
    const roll = rollD9();

    // D9 scatter directions:
    // 1 = same square
    // 2-9 = 8 adjacent squares (including diagonals)
    // Order: top-left, top, top-right, left, right, bottom-left, bottom, bottom-right
    const directions = [
        { row: 0, col: 0 },      // 1 - same square
        { row: -1, col: -1 },     // 2 - top-left
        { row: -1, col: 0 },      // 3 - top
        { row: -1, col: 1 },     // 4 - top-right
        { row: 0, col: -1 },     // 5 - left
        { row: 0, col: 1 },      // 6 - right
        { row: 1, col: -1 },     // 7 - bottom-left
        { row: 1, col: 0 },      // 8 - bottom
        { row: 1, col: 1 }       // 9 - bottom-right
    ];

    const direction = directions[roll - 1];
    const scatterRow = originRow + direction.row;
    const scatterCol = originCol + direction.col;

    // Check if scatter position is within bounds
    if (scatterRow >= 0 && scatterRow < gameState.boardHeight &&
        scatterCol >= 0 && scatterCol < gameState.boardWidth) {

        // Remove ball from previous ground position if it exists
        if (gameState.ballPosition) {
            const prevBallCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
            const prevBallOnGround = prevBallCell.cell.querySelector('.ball-on-ground');
            if (prevBallOnGround) {
                prevBallOnGround.remove();
            }
        }

        // Place ball on the ground at scatter position
        gameState.ballPosition = { row: scatterRow, col: scatterCol };
        const ballCell = gameState.board[scatterRow][scatterCol];

        // Add ball visual to the cell
        const ballOnGround = document.createElement('div');
        ballOnGround.className = 'ball-on-ground';
        ballOnGround.textContent = '🏈';
        ballCell.cell.appendChild(ballOnGround);

        // Check if a player is on that square
        if (ballCell.player) {
            if (ballCell.player.knockedDown) {
                // Ball landed on knocked down player - scatter again 1 square
                updateStatus(`Ball scattered! Rolled ${roll} on D9. Ball landed on knocked down player ${ballCell.player.id}. Ball scatters again 1 square.`);
                scatterBallDirection(scatterRow, scatterCol, 1, originalTeam, ballHolderKnockedDown);
                return;
            } else {
                // Standing player - they attempt to pick it up
                attemptBallPickupOnScatter(ballCell.player, scatterRow, scatterCol, roll, originalTeam, ballHolderKnockedDown);
            }
        } else {
            // Ball landed on unoccupied square
            updateStatus(`Ball scattered! Rolled ${roll} on D9. Ball is now at (${scatterRow}, ${scatterCol}).`);
            // End turn only if this was from a pickup attempt (not if ball-holder was knocked down)
            // If ball-holder was knocked down, turn only ends if a player fails to catch the ball
            // If ball lands on unoccupied square, it just sits there (no turnover)
            if (originalTeam !== null && !ballHolderKnockedDown) {
                updateStatus(`Ball landed on unoccupied square. Turn ends.`);
                endTurn(true, 'Ball landed on unoccupied square'); // Automatic turnover
            }
        }
    } else {
        // Scatter position is out of bounds - place ball in middle and scatter 5 squares
        updateStatus(`Ball scattered! Rolled ${roll} on D9, but scatter was out of bounds. Ball placed in middle and scatters 5 squares.`);

        // Place ball in the middle of the board
        const midRow = Math.floor(gameState.boardHeight / 2);
        const midCol = Math.floor(gameState.boardWidth / 2);

        // Remove ball from previous position if it exists
        if (gameState.ballPosition) {
            const prevBallCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
            const prevBallOnGround = prevBallCell.cell.querySelector('.ball-on-ground');
            if (prevBallOnGround) {
                prevBallOnGround.remove();
            }
        }

        // Place ball at middle position
        gameState.ballPosition = { row: midRow, col: midCol };
        const ballCell = gameState.board[midRow][midCol];

        // Add ball visual
        const ballOnGround = document.createElement('div');
        ballOnGround.className = 'ball-on-ground';
        ballOnGround.textContent = '🏈';
        ballCell.cell.appendChild(ballOnGround);

        // Scatter 5 squares in random direction
        scatterBallDirection(midRow, midCol, 5, originalTeam, ballHolderKnockedDown);
    }
}

// Stand up a player (costs half movement)
function standUpPlayer(player) {
    if (!player.knockedDown) {
        return false; // Already standing
    }

    const standUpCost = Math.ceil(player.movement / 2);

    // Check if player has enough movement to stand up
    if (player.remainingMovement < standUpCost) {
        updateStatus(`Not enough movement to stand up! Need ${standUpCost}, have ${player.remainingMovement}.`);
        return false;
    }

    player.knockedDown = false;
    player.remainingMovement -= standUpCost;

    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    if (playerElement) {
        playerElement.classList.remove('knocked-down');
    }

    updateStatus(`Player ${player.number} stands up! (Cost: ${standUpCost} movement, Remaining: ${player.remainingMovement})`);
    return true;
}

// Remove player (completely removed from board)
function removePlayer(player) {
    // If player has the ball, drop it
    if (player.hasBall) {
        dropBall(player);
    }

    const cell = gameState.board[player.row][player.col];
    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    if (playerElement) {
        playerElement.remove();
    }
    cell.player = null;

    // Remove from players array temporarily (could add to injury box)
    const index = gameState.players.indexOf(player);
    if (index > -1) {
        gameState.players.splice(index, 1);
    }
}

// Remove player from board (pushed off) - stores them for restoration after touchdown
function removePlayerFromBoard(player, scatterFromPosition = null) {
    // If player has the ball, drop it
    if (player.hasBall) {
        dropBall(player, scatterFromPosition);
    }

    // Remove visual element
    const cell = gameState.board[player.row][player.col];
    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    if (playerElement) {
        playerElement.remove();
    }
    cell.player = null;

    // Clear tackle zones around this player (they're no longer on the board)
    clearTackleZones();
    // Re-show tackle zones if we're in move mode (to update for remaining players)
    if (gameState.actionMode === 'move' && gameState.selectedPlayer) {
        showTackleZones();
    }

    // Store player for restoration after touchdown (don't remove from players array)
    // Mark them as removed
    player.removedFromBoard = true;
    player.removedRow = player.row;
    player.removedCol = player.col;
    player.placed = false; // Mark as not placed so they go to the box

    // Add to removed players list if not already there
    if (!gameState.removedPlayers.includes(player)) {
        gameState.removedPlayers.push(player);
    }

    // Update player boxes to show removed player
    updatePlayerBoxes();
}

// Check for touchdown
function checkTouchdown(player) {
    // Only score if player has the ball
    if (!player.hasBall) {
        return;
    }

    let scored = false;
    if (player.team === 1 && player.col === gameState.boardWidth - 1) {
        // Team 1 scored (reached Team 2's endzone - right side, col 19)
        gameState.scores.team1++;
        updateStatus(`TOUCHDOWN! Team 1 scores!`);
        scored = true;
    } else if (player.team === 2 && player.col === 0) {
        // Team 2 scored (reached Team 1's endzone - left side, col 0)
        gameState.scores.team2++;
        updateStatus(`TOUCHDOWN! Team 2 scores!`);
        scored = true;
    }

    if (scored) {
        updateUI();

        // Show touchdown celebration overlay
        showTouchdownOverlay(player.team);

        // Mark player as having acted and clear action mode
        player.hasActed = true;
        gameState.actionMode = null;
        clearValidMoves();
        updateActionButtons();

        // Clear selected highlighting
        document.querySelectorAll('.cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        document.querySelectorAll('.player.selected').forEach(p => {
            p.classList.remove('selected');
        });
        gameState.selectedPlayer = null;

        // The team that scored becomes the defending team, the other becomes attacking
        // After endTurn(), currentTeam will be the team that didn't score
        const scoringTeam = player.team;
        const otherTeam = scoringTeam === 1 ? 2 : 1;

        // End the turn (this switches teams)
        endTurn();

        // Set attacking/defending teams: scoring team becomes defending, other becomes attacking
        gameState.defendingTeam = scoringTeam;
        gameState.attackingTeam = otherTeam;

        // Reset players and start setup phase
        resetAfterTouchdown();
    }
}

// Show touchdown celebration overlay
function showTouchdownOverlay(team) {
    const overlay = document.getElementById('touchdown-overlay');
    const teamName = document.getElementById('touchdown-team-name');

    teamName.textContent = `Team ${team} Scores!`;
    teamName.style.color = team === 1 ? '#4a9eff' : '#ff6b6b';

    overlay.classList.add('show');
}

// Hide touchdown celebration overlay
function hideTouchdownOverlay() {
    const overlay = document.getElementById('touchdown-overlay');
    overlay.classList.remove('show');
}

// Show help overlay
function showHelpOverlay() {
    const overlay = document.getElementById('help-overlay');
    if (overlay) {
        overlay.classList.add('show');
    } else {
        console.error('Help overlay element not found!');
    }
}

// Hide help overlay
function hideHelpOverlay() {
    const overlay = document.getElementById('help-overlay');
    overlay.classList.remove('show');
}

// Reset after touchdown
function resetAfterTouchdown() {
    setTimeout(() => {
        // Hide touchdown overlay
        hideTouchdownOverlay();

        // Remove all players and ball from the board
        removeAllPlayersAndBall();

        // Start setup phase (teams will place their players)
        if (SKIP_SETUP) {
            // TEMPORARY: Skip setup, place players directly
            placePlayersDefault();
            gameState.setupPhase = false;
            startKickoff();
        } else {
            createPlayersForSetup();
            startSetupPhase();
        }
    }, 1000);
}

// Remove all players and ball from the board
function removeAllPlayersAndBall() {
    // Remove all existing player elements from the board
    gameState.players.forEach(player => {
        const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
        if (playerElement) {
            playerElement.remove();
        }
        // Clear player reference from board cells
        if (player.row >= 0 && player.row < gameState.boardHeight &&
            player.col >= 0 && player.col < gameState.boardWidth) {
            gameState.board[player.row][player.col].player = null;
        }
    });

    // Remove ball visual from board
    if (gameState.ballPosition) {
        const ballCell = gameState.board[gameState.ballPosition.row][gameState.ballPosition.col];
        const ballOnGround = ballCell.cell.querySelector('.ball-on-ground');
        if (ballOnGround) {
            ballOnGround.remove();
        }
    }

    // Remove ball from player if held
    if (gameState.ballHolder) {
        const ballHolderElement = document.querySelector(`[data-player-id="${gameState.ballHolder.id}"]`);
        if (ballHolderElement) {
            const ball = ballHolderElement.querySelector('.ball');
            if (ball) {
                ball.remove();
            }
            ballHolderElement.classList.remove('has-ball');
        }
        gameState.ballHolder.hasBall = false;
    }

    // Clear removed players list
    gameState.removedPlayers = [];

    // Clear ball state
    gameState.ballHolder = null;
    gameState.ballPosition = null;
}

// Calculate and show maximum reachable area using BFS
function showReachableArea(startRow, startCol, maxDistance) {
    // Clear previous reachable area
    document.querySelectorAll('.reachable-area').forEach(cell => {
        cell.classList.remove('reachable-area');
    });

    if (maxDistance <= 0) return;

    // BFS to find all reachable squares
    const visited = new Set();
    const queue = [{ row: startRow, col: startCol, distance: 0 }];
    const reachable = new Set();

    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row (diagonal left, up, diagonal right)
        [0, -1],           [0, 1],   // Middle row (left, right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row (diagonal left, down, diagonal right)
    ];

    while (queue.length > 0) {
        const { row, col, distance } = queue.shift();
        const key = `${row},${col}`;

        if (visited.has(key)) continue;
        visited.add(key);

        // Check if square is valid and reachable
        if (row >= 0 && row < gameState.boardHeight &&
            col >= 0 && col < gameState.boardWidth) {
            const cellData = gameState.board[row][col];

            // Can't move through occupied squares (except starting position)
            if (distance > 0 && cellData.player) {
                continue;
            }

            // Check if not already in path
            const isInPath = gameState.movementPath.some(step => step.row === row && step.col === col);
            if (!isInPath && !cellData.player) {
                reachable.add(key);
            }

            // Add neighbors if we have movement left
            if (distance < maxDistance) {
                directions.forEach(([rowOffset, colOffset]) => {
                    const newRow = row + rowOffset;
                    const newCol = col + colOffset;
                    const newKey = `${newRow},${newCol}`;

                    if (!visited.has(newKey) &&
                        newRow >= 0 && newRow < gameState.boardHeight &&
                        newCol >= 0 && newCol < gameState.boardWidth) {
                        const newCellData = gameState.board[newRow][newCol];
                        // Can explore through empty squares (not occupied and not in path)
                        const isNewInPath = gameState.movementPath.some(step => step.row === newRow && step.col === newCol);
                        if (!newCellData.player && !isNewInPath) {
                            queue.push({ row: newRow, col: newCol, distance: distance + 1 });
                        }
                    }
                });
            }
        }
    }

    // Highlight all reachable squares (excluding the starting position and path squares)
    reachable.forEach(key => {
        const [row, col] = key.split(',').map(Number);
        const cellData = gameState.board[row][col];
        if (cellData && !cellData.player) {
            // Don't highlight if it's the starting position or already in path
            const isInPath = gameState.movementPath.some(step => step.row === row && step.col === col);
            if (!isInPath && !(row === startRow && col === startCol)) {
                cellData.cell.classList.add('reachable-area');
            }
        }
    });
}

// Calculate path to a destination using BFS
function calculatePathToDestination(destRow, destCol) {
    const player = gameState.selectedPlayer;
    if (!player) return null;

    // Get starting position (current position or end of current path)
    let startRow = player.row;
    let startCol = player.col;
    if (gameState.movementPath.length > 0) {
        const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
        startRow = lastStep.row;
        startCol = lastStep.col;
    }

    // If destination is the starting position, return empty path
    if (destRow === startRow && destCol === startCol) {
        return [];
    }

    // Check remaining movement (allow up to 2 GFI squares)
    const remainingMovement = player.remainingMovement - gameState.movementPath.length;
    const gfiSquaresInPath = Math.max(0, gameState.movementPath.length - player.remainingMovement);
    const maxPathLength = remainingMovement + Math.max(0, 2 - gfiSquaresInPath); // Allow up to 2 GFI squares

    if (maxPathLength <= 0) {
        return null;
    }

    // BFS to find shortest path, preferring straight-line movement
    const visited = new Set();
    const queue = [{ row: startRow, col: startCol, path: [] }];
    // Prioritize straight moves (horizontal/vertical) over diagonal moves
    const directions = [
        [-1, 0],  // Up
        [1, 0],   // Down
        [0, -1],  // Left
        [0, 1],   // Right
        [-1, -1], // Up-Left (diagonal)
        [-1, 1],  // Up-Right (diagonal)
        [1, -1],  // Down-Left (diagonal)
        [1, 1]    // Down-Right (diagonal)
    ];

    // Calculate preferred direction (straight-line towards destination)
    const rowDiff = destRow - startRow;
    const colDiff = destCol - startCol;
    const preferredRowDir = rowDiff === 0 ? 0 : (rowDiff > 0 ? 1 : -1);
    const preferredColDir = colDiff === 0 ? 0 : (colDiff > 0 ? 1 : -1);

    // Reorder directions to prioritize the preferred straight-line direction
    const reorderedDirections = [];

    // First, add the preferred straight-line direction if it exists
    if (preferredRowDir !== 0) {
        reorderedDirections.push([preferredRowDir, 0]);
    }
    if (preferredColDir !== 0) {
        reorderedDirections.push([0, preferredColDir]);
    }

    // Then add other straight directions
    directions.forEach(([rowOffset, colOffset]) => {
        const isStraight = (rowOffset === 0 || colOffset === 0);
        const isPreferred = (rowOffset === preferredRowDir && colOffset === preferredColDir) ||
                           (rowOffset === preferredRowDir && colOffset === 0) ||
                           (rowOffset === 0 && colOffset === preferredColDir);

        if (isStraight && !isPreferred) {
            reorderedDirections.push([rowOffset, colOffset]);
        }
    });

    // Finally, add diagonal directions
    directions.forEach(([rowOffset, colOffset]) => {
        const isStraight = (rowOffset === 0 || colOffset === 0);
        if (!isStraight) {
            reorderedDirections.push([rowOffset, colOffset]);
        }
    });

    while (queue.length > 0) {
        const { row, col, path } = queue.shift();
        const key = `${row},${col}`;

        if (visited.has(key)) continue;
        visited.add(key);

        // Check if we reached the destination
        if (row === destRow && col === destCol) {
            return path;
        }

        // Check if path length exceeds maximum allowed (remaining movement + GFI)
        if (path.length >= maxPathLength) {
            continue;
        }

        // Explore neighbors using reordered directions (straight moves first)
        reorderedDirections.forEach(([rowOffset, colOffset]) => {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            const newKey = `${newRow},${newCol}`;

            if (!visited.has(newKey) &&
                newRow >= 0 && newRow < gameState.boardHeight &&
                newCol >= 0 && newCol < gameState.boardWidth) {
                const newCellData = gameState.board[newRow][newCol];

                // Can move through empty squares (not occupied and not already in path)
                const isInPath = gameState.movementPath.some(step => step.row === newRow && step.col === newCol);
                if (!newCellData.player && !isInPath) {
                    queue.push({ row: newRow, col: newCol, path: [...path, { row: newRow, col: newCol }] });
                }
            }
        });
    }

    // No path found
    return null;
}

// Show valid moves
function showValidMoves() {
    if (!gameState.selectedPlayer) return;

    const player = gameState.selectedPlayer;

    // Clear previous valid moves
    clearValidMoves();

    // If in move, blitz, or pass mode, show only adjacent squares to the current path end
    if (gameState.actionMode === 'move' || gameState.actionMode === 'blitz' || gameState.actionMode === 'pass') {
        let currentRow = player.row;
        let currentCol = player.col;

        // If there's a path, show squares adjacent to the last step
        if (gameState.movementPath.length > 0) {
            const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
            currentRow = lastStep.row;
            currentCol = lastStep.col;
        }

        // Calculate remaining movement
        const remainingMovement = player.remainingMovement - gameState.movementPath.length;

        // Calculate GFI squares used in current path
        const gfiSquaresInPath = Math.max(0, gameState.movementPath.length - player.remainingMovement);
        const canUseGFI = gfiSquaresInPath < 2; // Can use GFI if less than 2 already used

        // Show tackle zones around defending players
        showTackleZones();

        // Show maximum reachable area (only normal movement, not GFI squares)
        // GFI squares will be shown separately with yellow borders
        if (remainingMovement > 0) {
            showReachableArea(currentRow, currentCol, remainingMovement);
        }

        // Show GFI squares (yellow dotted) if GFI is available
        // Allow GFI squares in movement demo, but skip in other demos
        if (canUseGFI && (!gameState.demoMode || gameState.demoType === 'movement')) {
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],  // Top row (diagonal left, up, diagonal right)
                [0, -1],           [0, 1],   // Middle row (left, right)
                [1, -1],  [1, 0],  [1, 1]    // Bottom row (diagonal left, down, diagonal right)
            ];

            // If remainingMovement is 0, GFI squares are just adjacent squares
            if (remainingMovement === 0) {
                directions.forEach(([rowOffset, colOffset]) => {
                    const newRow = currentRow + rowOffset;
                    const newCol = currentCol + colOffset;

                    // Check if within bounds
                    if (newRow >= 0 && newRow < gameState.boardHeight &&
                        newCol >= 0 && newCol < gameState.boardWidth) {
                        const cellData = gameState.board[newRow][newCol];

                        // Check if empty and not already in path
                        if (!cellData.player &&
                            !gameState.movementPath.some(step => step.row === newRow && step.col === newCol)) {
                            // This is a GFI square (adjacent when movement is exhausted)
                            // Remove reachable-area class if present (to avoid green styling)
                            cellData.cell.classList.remove('reachable-area');
                            cellData.cell.classList.add('gfi-available');
                        }
                    }
                });
            } else {
                // If there's remaining movement, find squares that would be GFI squares
                // Use BFS to find all squares at distance = remainingMovement + 1 and remainingMovement + 2
                const visited = new Set();
                const queue = [{ row: currentRow, col: currentCol, distance: 0 }];
                const gfiSquares = [];

                while (queue.length > 0) {
                    const { row, col, distance } = queue.shift();
                    const key = `${row},${col}`;

                    if (visited.has(key)) continue;
                    visited.add(key);

                    // Check if square is valid
                    if (row >= 0 && row < gameState.boardHeight &&
                        col >= 0 && col < gameState.boardWidth) {
                        const cellData = gameState.board[row][col];

                        // Can't move through occupied squares (except starting position)
                        if (distance > 0 && cellData.player) {
                            continue;
                        }

                        // Check if not already in path
                        const isInPath = gameState.movementPath.some(step => step.row === row && step.col === col);
                        if (!isInPath && !cellData.player) {
                            // Mark as GFI square if it's exactly at GFI distance
                            // First GFI square is at distance = remainingMovement + 1
                            // Second GFI square is at distance = remainingMovement + 2
                            if (distance === remainingMovement + 1) {
                                // First GFI square - always show if available
                                gfiSquares.push({ row, col });
                            } else if (distance === remainingMovement + 2 && gfiSquaresInPath < 2) {
                                // Second GFI square - show if we haven't used 2 GFI squares yet
                                gfiSquares.push({ row, col });
                            }
                        }

                        // Continue exploring if we haven't reached max GFI distance
                        // Allow exploring up to remainingMovement + 2 (for second GFI square)
                        const maxDistance = remainingMovement + 2;
                        if (distance < maxDistance) {
                            directions.forEach(([rowOffset, colOffset]) => {
                                const newRow = row + rowOffset;
                                const newCol = col + colOffset;
                                const newKey = `${newRow},${newCol}`;

                                if (!visited.has(newKey) &&
                                    newRow >= 0 && newRow < gameState.boardHeight &&
                                    newCol >= 0 && newCol < gameState.boardWidth) {
                                    const newCellData = gameState.board[newRow][newCol];
                                    const isNewInPath = gameState.movementPath.some(step => step.row === newRow && step.col === newCol);
                                    if (!newCellData.player && !isNewInPath) {
                                        queue.push({ row: newRow, col: newCol, distance: distance + 1 });
                                    }
                                }
                            });
                        }
                    }
                }

                // Mark all GFI squares with yellow dotted border
                gfiSquares.forEach(({ row, col }) => {
                    const cellData = gameState.board[row][col];
                    if (cellData && !cellData.player) {
                        // Remove reachable-area class if present (to avoid green styling)
                        cellData.cell.classList.remove('reachable-area');
                        cellData.cell.classList.add('gfi-available');
                    }
                });
            }
        }
    } else {
        // Original behavior for other modes
        let maxDistance = player.remainingMovement;
        if (player.knockedDown) {
            const standUpCost = Math.ceil(player.movement / 2);
            maxDistance = Math.max(0, player.remainingMovement - standUpCost);
        }

        for (let row = 0; row < gameState.boardHeight; row++) {
            for (let col = 0; col < gameState.boardWidth; col++) {
                const distance = Math.abs(row - player.row) + Math.abs(col - player.col);
                if (distance > 0 && distance <= maxDistance && !gameState.board[row][col].player) {
                    gameState.board[row][col].cell.classList.add('valid-move');
                }
            }
        }
    }

    // Show block dice indicators for adjacent opponent players (when player is activated)
    // This allows players to see block dice when hovering over opponents, even in move mode
    if (gameState.selectedPlayer && (gameState.actionMode === 'move' || gameState.actionMode === 'blitz')) {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],  // Top row
            [0, -1],           [0, 1],   // Middle row (left and right)
            [1, -1],  [1, 0],  [1, 1]    // Bottom row
        ];

        // Get current position (starting position or end of current path)
        let currentRow = player.row;
        let currentCol = player.col;
        if (gameState.movementPath.length > 0) {
            const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
            currentRow = lastStep.row;
            currentCol = lastStep.col;
        }

        directions.forEach(([rowOffset, colOffset]) => {
            const newRow = currentRow + rowOffset;
            const newCol = currentCol + colOffset;

            // Check if within bounds
            if (newRow >= 0 && newRow < gameState.boardHeight &&
                newCol >= 0 && newCol < gameState.boardWidth) {
                const cellData = gameState.board[newRow][newCol];

                // Check if there's an opponent player who is not knocked down
                if (cellData.player && cellData.player.team !== player.team && !cellData.player.knockedDown) {
                    const defender = cellData.player;

                    // Calculate block dice
                    const blockInfo = calculateBlockDice(player, defender);

                    // Create or update dice indicator
                    let diceIndicator = cellData.cell.querySelector('.block-dice-indicator');
                    if (!diceIndicator) {
                        diceIndicator = document.createElement('div');
                        diceIndicator.className = 'block-dice-indicator';
                        cellData.cell.appendChild(diceIndicator);
                    }

                    // Update dice indicator text and styling
                    const diceWord = blockInfo.numDice === 1 ? 'die' : 'dice';
                    diceIndicator.textContent = `${blockInfo.numDice} ${diceWord}`;

                    // Style based on advantage:
                    // Red: defender picks (bad for attacker)
                    // Grey: 1 die (neutral)
                    // Green: attacker picks (good for attacker)
                    diceIndicator.classList.remove('dice-good', 'dice-bad', 'dice-neutral');
                    if (blockInfo.defenderPicks) {
                        diceIndicator.classList.add('dice-bad'); // Red - bad for attacker
                    } else if (blockInfo.numDice === 1) {
                        diceIndicator.classList.add('dice-neutral'); // Grey - neutral
                    } else {
                        diceIndicator.classList.add('dice-good'); // Green - good for attacker
                    }
                }
            }
        });
    }
}

// Show valid block targets (adjacent opponent players)
// Show valid pass targets (teammates within 13 squares)
function showValidPassTargets() {
    if (!gameState.selectedPlayer) return;

    const player = gameState.selectedPlayer;

    // Get current position (starting position or end of current path)
    let currentRow = player.row;
    let currentCol = player.col;
    if (gameState.movementPath.length > 0) {
        const lastStep = gameState.movementPath[gameState.movementPath.length - 1];
        currentRow = lastStep.row;
        currentCol = lastStep.col;
    }

    // Highlight teammates within 13 squares
    gameState.players.forEach(teammate => {
        if (teammate.team === player.team &&
            teammate !== player &&
            !teammate.knockedDown &&
            teammate.row >= 0 && teammate.row < gameState.boardHeight &&
            teammate.col >= 0 && teammate.col < gameState.boardWidth) {

            // Calculate distance (Manhattan distance)
            const rowDiff = Math.abs(teammate.row - currentRow);
            const colDiff = Math.abs(teammate.col - currentCol);
            const distance = rowDiff + colDiff;

            // Only show teammates within 13 squares
            if (distance <= 13) {
                const cellData = gameState.board[teammate.row][teammate.col];
                if (cellData && cellData.cell) {
                    cellData.cell.classList.add('valid-move', 'pass-target');
                }
            }
        }
    });
}

function showValidBlocks() {
    if (!gameState.selectedPlayer) return;

    const player = gameState.selectedPlayer;

    // Check all 8 adjacent squares (including diagonals)
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    directions.forEach(([rowOffset, colOffset]) => {
        const newRow = player.row + rowOffset;
        const newCol = player.col + colOffset;

        // Check if within bounds
        if (newRow >= 0 && newRow < gameState.boardHeight &&
            newCol >= 0 && newCol < gameState.boardWidth) {
            const cellData = gameState.board[newRow][newCol];

            // Highlight if there's an opponent player who is not knocked down
            if (cellData.player && cellData.player.team !== player.team && !cellData.player.knockedDown) {
                const defender = cellData.player;

                // Calculate block dice
                const blockInfo = calculateBlockDice(player, defender);

                // Don't add valid-move class - we only want to show the dice indicator, not green background

                // Add class based on dice advantage
                // If defender picks (defender has more dice advantage), it's bad for attacker
                if (blockInfo.defenderPicks) {
                    cellData.cell.classList.add('block-bad'); // Bad for attacker
                } else if (blockInfo.numDice > 1 && !blockInfo.defenderPicks) {
                    cellData.cell.classList.add('block-good'); // Good for attacker
                }

                // Create or update dice indicator
                let diceIndicator = cellData.cell.querySelector('.block-dice-indicator');
                if (!diceIndicator) {
                    diceIndicator = document.createElement('div');
                    diceIndicator.className = 'block-dice-indicator';
                    cellData.cell.appendChild(diceIndicator);
                }

                // Update dice indicator text and styling
                const diceWord = blockInfo.numDice === 1 ? 'die' : 'dice';
                diceIndicator.textContent = `${blockInfo.numDice} ${diceWord}`;

                // Style based on advantage:
                // Red: defender picks (bad for attacker)
                // Grey: 1 die (neutral)
                // Green: attacker picks (good for attacker)
                diceIndicator.classList.remove('dice-good', 'dice-bad', 'dice-neutral');
                if (blockInfo.defenderPicks) {
                    diceIndicator.classList.add('dice-bad'); // Red - bad for attacker
                } else if (blockInfo.numDice === 1) {
                    diceIndicator.classList.add('dice-neutral'); // Grey - neutral
                } else {
                    diceIndicator.classList.add('dice-good'); // Green - good for attacker
                }
            }
        }
    });
}

// Show tackle zones (adjacent squares around defending players)
function showTackleZones() {
    if (!gameState.selectedPlayer || gameState.actionMode !== 'move') return;

    const currentTeam = gameState.selectedPlayer.team;

    // Find all defending players (opponents who are not knocked down)
    const defendingPlayers = gameState.players.filter(p =>
        p.team !== currentTeam && !p.knockedDown
    );

    // Directions for 8 adjacent squares (including diagonals)
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],  // Top row
        [0, -1],           [0, 1],   // Middle row (left and right)
        [1, -1],  [1, 0],  [1, 1]    // Bottom row
    ];

    // Highlight adjacent squares around each defending player
    defendingPlayers.forEach(defender => {
        directions.forEach(([rowOffset, colOffset]) => {
            const tackleRow = defender.row + rowOffset;
            const tackleCol = defender.col + colOffset;

            // Check if within bounds
            if (tackleRow >= 0 && tackleRow < gameState.boardHeight &&
                tackleCol >= 0 && tackleCol < gameState.boardWidth) {
                const cellData = gameState.board[tackleRow][tackleCol];

                // Only highlight if square is empty (not occupied by a player)
                // and not already in the movement path
                const isInPath = gameState.movementPath.some(step =>
                    step.row === tackleRow && step.col === tackleCol
                );

                if (!cellData.player && !isInPath) {
                    cellData.cell.classList.add('tackle-zone');
                }
            }
        });
    });
}

// Clear tackle zones
function clearTackleZones() {
    document.querySelectorAll('.tackle-zone').forEach(cell => {
        cell.classList.remove('tackle-zone');
    });
}

// Clear valid moves
function clearValidMoves() {
    document.querySelectorAll('.valid-move').forEach(cell => {
        cell.classList.remove('valid-move', 'block-good', 'block-bad', 'gfi-available', 'pass-target');
    });
    // Also clear gfi-available from cells that don't have valid-move
    document.querySelectorAll('.gfi-available').forEach(cell => {
        cell.classList.remove('gfi-available');
    });
    // Remove dice indicators
    document.querySelectorAll('.block-dice-indicator').forEach(indicator => {
        indicator.remove();
    });
    document.querySelectorAll('.reachable-area').forEach(cell => {
        cell.classList.remove('reachable-area');
    });
    clearTackleZones();
    clearMovementPathDisplay();
    clearPushSelection();
}

// Roll dice
function rollDice() {
    const roll = Math.floor(Math.random() * 6) + 1;
    // Update dice result for current team
    const diceResult = document.getElementById(`dice-result-team${gameState.currentTeam}`);
    if (diceResult) {
        diceResult.textContent = roll;
        diceResult.style.animation = 'none';
        setTimeout(() => {
            diceResult.style.animation = 'roll 0.5s';
        }, 10);
    }
    return roll;
}

// Roll a 9-sided die (D9)
function rollD9() {
    return Math.floor(Math.random() * 9) + 1;
}

// Show turnover overlay
function showTurnoverOverlay(reason = '') {
    const overlay = document.getElementById('turnover-overlay');
    const reasonElement = document.getElementById('turnover-reason');
    if (reasonElement) {
        reasonElement.textContent = reason;
    }
    overlay.classList.add('show');
}

// Hide turnover overlay
function hideTurnoverOverlay() {
    const overlay = document.getElementById('turnover-overlay');
    const reasonElement = document.getElementById('turnover-reason');
    if (reasonElement) {
        reasonElement.textContent = '';
    }
    overlay.classList.remove('show');
}

// End turn
// isAutomatic: if true, shows turnover overlay before ending turn
// reason: optional string describing why the turnover happened
function endTurn(isAutomatic = false, reason = '') {
    // Prevent multiple simultaneous turn ends
    if (gameState.turnEnding) {
        return;
    }

    // Mark that turn is ending
    gameState.turnEnding = true;

    // If automatic turnover, show overlay first
    if (isAutomatic) {
        showTurnoverOverlay(reason);
        // Hide overlay after 1 second and continue with turn end
        setTimeout(() => {
            hideTurnoverOverlay();
            endTurnInternal();
        }, 1000);
        return;
    }

    // User-initiated turn end, proceed normally
    endTurnInternal();
}

// Internal function that actually ends the turn
function endTurnInternal() {
    // Stop the turn timer
    stopTurnTimer();

    // Clear any selected cell and player
    if (gameState.selectedPlayer) {
        const selectedCell = gameState.board[gameState.selectedPlayer.row][gameState.selectedPlayer.col].cell;
        selectedCell.classList.remove('selected');
        document.querySelector(`[data-player-id="${gameState.selectedPlayer.id}"]`)?.classList.remove('selected');
    }

    // Also clear any remaining selected cells (safety check)
    document.querySelectorAll('.cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    document.querySelectorAll('.player.selected').forEach(player => {
        player.classList.remove('selected');
    });

    // Reset all players for current team
    gameState.players.forEach(player => {
        if (player.team === gameState.currentTeam) {
            player.hasActed = false;
            player.hasMoved = false;
            player.remainingMovement = player.movement; // Reset movement for next turn
            // Note: knockedDown state persists across turns
        }
    });

    // Switch teams
    gameState.currentTeam = gameState.currentTeam === 1 ? 2 : 1;
    gameState.turnNumber++;
    gameState.totalTurns++;
    // Only increment turnsInHalf when we switch back to Team 1 (so each turn number appears twice)
    if (gameState.currentTeam === 1) {
        gameState.turnsInHalf++;
    }
    gameState.selectedPlayer = null;
    gameState.blitzUsed = false; // Reset blitz for new turn
    gameState.passUsed = false; // Reset pass for new turn

    // Check if we've reached half-time (8 turns per team = 16 total turns)
    // After 16 total turns of first half, we switch to second half
    if (gameState.currentHalf === 1 && gameState.totalTurns >= gameState.turnsPerHalf * 2) {
        gameState.turnEnding = false; // Clear flag before returning
        handleHalftime();
        return; // Don't continue with normal turn end logic
    }

    // Check if we've reached end of second half (8 turns per team = 16 total turns in second half)
    // After 16 total turns of second half, game ends
    if (gameState.currentHalf === 2 && gameState.totalTurns >= gameState.turnsPerHalf * 2) {
        gameState.turnEnding = false; // Clear flag before returning
        handleGameOver();
        return; // Don't continue with normal turn end logic
    }
    gameState.actionMode = null;
    gameState.pendingFollowUp = null;
    gameState.pendingBlockRolls = null;
    gameState.pendingPushSelection = null;

    // Clear dice results
    const dice1 = document.getElementById('dice-result-team1');
    const dice2 = document.getElementById('dice-result-team2');
    if (dice1) dice1.textContent = '';
    if (dice2) dice2.textContent = '';

    // Clear movement state
    gameState.movementPath = [];
    gameState.stoodUpThisMove = null;
    clearMovementPathDisplay();
    hideMovementButtons();
    hideFollowUpButtons();
    hideBlockDiceButtons();
    clearValidMoves();
    updateUI();
    updateActionButtons();
    updateStatus(`Half ${gameState.currentHalf} - Turn ${gameState.turnsInHalf} - Team ${gameState.currentTeam}'s turn`);

    // Start the turn timer (2 minutes) - only if not in setup phase
    if (!gameState.setupPhase) {
        startTurnTimer();
    }

    // Clear the turn ending flag
    gameState.turnEnding = false;
}

// Start the turn timer (2 minutes = 120 seconds)
function startTurnTimer() {
    // Clear any existing timer
    stopTurnTimer();

    // Reset timer to 2 minutes
    gameState.turnTimeRemaining = 120;
    gameState.turnTimerActive = true;

    // Update display immediately
    updateTurnTimerDisplay();

    // Start the timer interval (update every second)
    gameState.turnTimer = setInterval(() => {
        if (gameState.turnTimeRemaining > 0) {
            gameState.turnTimeRemaining--;
            updateTurnTimerDisplay();
        } else {
            // Time's up - end the turn automatically
            stopTurnTimer();
            updateStatus(`Time's up! Turn ends automatically.`);
            endTurn(true, 'Time\'s up'); // Automatic turnover
        }
    }, 1000);
}

// Stop the turn timer
function stopTurnTimer() {
    if (gameState.turnTimer) {
        clearInterval(gameState.turnTimer);
        gameState.turnTimer = null;
    }
    gameState.turnTimerActive = false;
    // Update display to hide timers
    updateTurnTimerDisplay();
}

// Update the turn timer display
function updateTurnTimerDisplay() {
    const timerElement1 = document.getElementById('turn-timer-1');
    const timerElement2 = document.getElementById('turn-timer-2');

    const minutes = Math.floor(gameState.turnTimeRemaining / 60);
    const seconds = gameState.turnTimeRemaining % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Show timer for current team, hide for other team
    if (gameState.turnTimerActive) {
        if (gameState.currentTeam === 1) {
            if (timerElement1) {
                timerElement1.textContent = formattedTime;
                timerElement1.style.display = 'block';
                // Change color when time is running low (last 30 seconds)
                if (gameState.turnTimeRemaining <= 30) {
                    timerElement1.style.color = '#ff4444'; // Red
                } else if (gameState.turnTimeRemaining <= 60) {
                    timerElement1.style.color = '#ffaa00'; // Orange
                } else {
                    timerElement1.style.color = '#ffffff'; // White
                }
            }
            if (timerElement2) {
                timerElement2.style.display = 'none';
            }
        } else {
            if (timerElement2) {
                timerElement2.textContent = formattedTime;
                timerElement2.style.display = 'block';
                // Change color when time is running low (last 30 seconds)
                if (gameState.turnTimeRemaining <= 30) {
                    timerElement2.style.color = '#ff4444'; // Red
                } else if (gameState.turnTimeRemaining <= 60) {
                    timerElement2.style.color = '#ffaa00'; // Orange
                } else {
                    timerElement2.style.color = '#ffffff'; // White
                }
            }
            if (timerElement1) {
                timerElement1.style.display = 'none';
            }
        }
    } else {
        // Hide both timers when timer is not active
        if (timerElement1) timerElement1.style.display = 'none';
        if (timerElement2) timerElement2.style.display = 'none';
    }
}

// Update UI
function updateUI() {
    document.getElementById('score-team1').textContent = gameState.scores.team1;
    document.getElementById('score-team2').textContent = gameState.scores.team2;

    // Update turn info (Half and Turn number) for both teams
    const turnInfoText = `Half ${gameState.currentHalf} - Turn ${gameState.turnsInHalf}`;
    const turnInfo1 = document.getElementById('turn-info-1');
    const turnInfo2 = document.getElementById('turn-info-2');
    if (turnInfo1) turnInfo1.textContent = turnInfoText;
    if (turnInfo2) turnInfo2.textContent = turnInfoText;

    document.getElementById('turn-indicator-1').textContent =
        gameState.currentTeam === 1 ? 'Your Turn' : '';
    document.getElementById('turn-indicator-2').textContent =
        gameState.currentTeam === 2 ? 'Your Turn' : '';

    // Update team control buttons
    updateTeamControls();

    // Update player visual states
    gameState.players.forEach(player => {
        const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
        if (playerElement) {
            // Turn grey if player has acted or moved
            if (player.hasActed || player.hasMoved) {
                playerElement.classList.add('has-acted');
            } else {
                playerElement.classList.remove('has-acted');
            }
            if (player.knockedDown) {
                playerElement.classList.add('knocked-down');
            } else {
                playerElement.classList.remove('knocked-down');
            }
            // Update ball visual
            if (player.hasBall) {
                playerElement.classList.add('has-ball');
                // Ensure ball visual exists
                if (!playerElement.querySelector('.ball')) {
                    const ball = document.createElement('div');
                    ball.className = 'ball';
                    ball.textContent = '🏈';
                    playerElement.appendChild(ball);
                }
            } else {
                playerElement.classList.remove('has-ball');
                const ball = playerElement.querySelector('.ball');
                if (ball) {
                    ball.remove();
                }
            }
        }
    });
}

// Update team control buttons (end turn)
function updateTeamControls() {
    const team1EndBtn = document.getElementById('end-turn-team1');
    const team2EndBtn = document.getElementById('end-turn-team2');

    // Disable all end turn buttons during setup phase
    if (gameState.setupPhase) {
        if (team1EndBtn) {
            team1EndBtn.disabled = true;
        }
        if (team2EndBtn) {
            team2EndBtn.disabled = true;
        }
        return;
    }

    // Enable buttons for current team, disable for other team
    if (team1EndBtn) {
        team1EndBtn.disabled = gameState.currentTeam !== 1;
    }
    if (team2EndBtn) {
        team2EndBtn.disabled = gameState.currentTeam !== 2;
    }
}

// Update action buttons
function updateActionButtons() {
    const blockBtn = document.getElementById('btn-block');
    const blitzBtn = document.getElementById('btn-blitz');
    const passBtn = document.getElementById('btn-pass');

    // Disable all action buttons during setup phase
    if (gameState.setupPhase) {
        blockBtn.disabled = true;
        blitzBtn.disabled = true;
        passBtn.disabled = true;
        blockBtn.classList.remove('active');
        blitzBtn.classList.remove('active');
        passBtn.classList.remove('active');
        return;
    }

    if (gameState.actionMode) {
        blockBtn.classList.toggle('active', gameState.actionMode === 'block');
        blitzBtn.classList.toggle('active', gameState.actionMode === 'blitz');
        passBtn.classList.toggle('active', gameState.actionMode === 'pass');
    } else {
        blockBtn.classList.remove('active');
        blitzBtn.classList.remove('active');
        passBtn.classList.remove('active');
    }

    if (!gameState.selectedPlayer) {
        blockBtn.disabled = true;
        blitzBtn.disabled = true;
        passBtn.disabled = true;
    } else {
        const player = gameState.selectedPlayer;
        // Enable buttons when player is selected
        blockBtn.disabled = false;
        // Enable blitz only if it hasn't been used this turn (once per team per turn)
        blitzBtn.disabled = gameState.blitzUsed;
        // Enable pass only if player has ball and pass hasn't been used this turn
        passBtn.disabled = !player.hasBall || gameState.passUsed;
    }
}

// Update status message (maintains history of last 5 messages)
function updateStatus(message) {
    // Add new message to history
    gameState.statusHistory.push(message);

    // Keep only last 5 messages
    if (gameState.statusHistory.length > 5) {
        gameState.statusHistory.shift();
    }

    // Update display with all messages
    const statusElement = document.getElementById('status');
    statusElement.innerHTML = gameState.statusHistory.map(msg =>
        `<div class="status-message">${msg}</div>`
    ).join('');
}

// Show follow-up buttons
function showFollowUpButtons() {
    const followUpButtons = document.getElementById('follow-up-buttons');
    followUpButtons.style.display = 'flex';
}

// Hide follow-up buttons
function hideFollowUpButtons() {
    const followUpButtons = document.getElementById('follow-up-buttons');
    followUpButtons.style.display = 'none';
}

// Handle follow-up action
function handleFollowUp() {
    if (!gameState.pendingFollowUp) return;

    const { attacker, defenderOldRow, defenderOldCol } = gameState.pendingFollowUp;

    // Check if the square is still empty (defender has moved)
    if (!gameState.board[defenderOldRow][defenderOldCol].player) {
        // Follow-up costs 1 square of movement
        attacker.remainingMovement = Math.max(0, attacker.remainingMovement - 1);

        // Move attacker to the defender's old position
        const oldCell = gameState.board[attacker.row][attacker.col];
        const newCell = gameState.board[defenderOldRow][defenderOldCol];

        // Update board state
        oldCell.player = null;
        newCell.player = attacker;

        // Move visual element
        const playerElement = document.querySelector(`[data-player-id="${attacker.id}"]`);
        oldCell.cell.removeChild(playerElement);
        newCell.cell.appendChild(playerElement);

        // Update player position
        attacker.row = defenderOldRow;
        attacker.col = defenderOldCol;

        updateStatus(`Player ${attacker.number} follows up! (Costs 1 square of movement)`);
    } else {
        updateStatus('Cannot follow up - square is occupied.');
    }

    // Complete the block action
    completeBlockAction();
}

// Handle stay action (don't follow up)
function handleStay() {
    if (!gameState.pendingFollowUp) return;

    updateStatus(`Player ${gameState.pendingFollowUp.attacker.number} stays in place.`);
    completeBlockAction();
}

// Complete block action after follow-up decision
function completeBlockAction() {
    const attacker = gameState.pendingFollowUp.attacker;

    // If this was a blitz action, allow continued movement
    if (gameState.actionMode === 'blitz') {
        gameState.blitzUsed = true; // Mark blitz as used
        // Don't mark as acted yet - allow continued movement
        // Switch back to move mode to allow remaining movement
        gameState.actionMode = 'move';
        gameState.movementPath = []; // Clear any previous path
        gameState.pendingFollowUp = null;
        hideFollowUpButtons();
        hideBlockCancelButton();
        clearValidMoves();
        showValidMoves();
        updateActionButtons();
        updateStatus(`Block complete! You can continue moving with remaining movement (${attacker.remainingMovement}). Click adjacent squares to build your movement path.`);
    } else {
        // Normal block - mark as acted and complete
        attacker.hasActed = true;
        gameState.actionMode = null;
        gameState.pendingFollowUp = null;
        hideFollowUpButtons();
        hideBlockCancelButton();
        updateActionButtons();
        clearValidMoves();

        // Clear selected highlighting
        document.querySelectorAll('.cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        document.querySelectorAll('.player.selected').forEach(player => {
            player.classList.remove('selected');
        });
        gameState.selectedPlayer = null;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Team 1 buttons
    document.getElementById('end-turn-team1').addEventListener('click', () => {
        if (gameState.currentTeam === 1) {
            endTurn(false); // User-initiated, no overlay
        }
    });

    // Team 2 buttons
    document.getElementById('end-turn-team2').addEventListener('click', () => {
        if (gameState.currentTeam === 2) {
            endTurn(false); // User-initiated, no overlay
        }
    });


    document.getElementById('btn-block').addEventListener('click', () => {
        if (!gameState.selectedPlayer) return;
        const player = gameState.selectedPlayer;

        // If player stood up during move action, revert it
        if (gameState.stoodUpThisMove) {
            const { player: stoodUpPlayer, standUpCost } = gameState.stoodUpThisMove;
            if (stoodUpPlayer === player) {
                player.knockedDown = true;
                player.remainingMovement += standUpCost;
                const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
                if (playerElement) {
                    playerElement.classList.add('knocked-down');
                }
            }
        }

        gameState.actionMode = 'block';
        gameState.movementPath = [];
        gameState.stoodUpThisMove = null;
        clearValidMoves(); // Clear any movement highlights or previous valid moves
        clearMovementPathDisplay();
        hideMovementButtons();
        showValidBlocks();
        updateActionButtons();
        updateStatus('Select an adjacent opponent to block.');
    });

    document.getElementById('btn-blitz').addEventListener('click', () => {
        if (!gameState.selectedPlayer) return;
        if (gameState.blitzUsed) {
            updateStatus('Blitz action has already been used this turn by your team. Only one blitz per turn.');
            return;
        }
        const player = gameState.selectedPlayer;

        // Clear any previous stand up tracking
        gameState.stoodUpThisMove = null;

        // If knocked down, stand up first (costs half movement)
        if (player.knockedDown) {
            const standUpCost = Math.ceil(player.movement / 2);
            if (!standUpPlayer(player)) {
                return; // Failed to stand up (not enough movement)
            }
            // Track that player stood up during this move action
            gameState.stoodUpThisMove = { player, standUpCost };
        }

        gameState.actionMode = 'blitz';
        gameState.movementPath = [];
        clearValidMoves(); // Clear any block indicators or previous valid moves
        clearMovementPathDisplay();

        // Check if there are adjacent opponents - if so, start with block mode
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        let hasAdjacentOpponent = false;
        for (const [rowOffset, colOffset] of directions) {
            const checkRow = player.row + rowOffset;
            const checkCol = player.col + colOffset;

            if (checkRow >= 0 && checkRow < gameState.boardHeight &&
                checkCol >= 0 && checkCol < gameState.boardWidth) {
                const cellData = gameState.board[checkRow][checkCol];
                if (cellData.player &&
                    cellData.player.team !== player.team &&
                    !cellData.player.knockedDown) {
                    hasAdjacentOpponent = true;
                    break;
                }
            }
        }

        if (hasAdjacentOpponent) {
            // Start with block mode - player can block adjacent opponent, then move
            hideMovementButtons();
            showValidBlocks();
            updateActionButtons();
            if (gameState.stoodUpThisMove) {
                updateStatus('Blitz! Player stood up! Block an adjacent opponent, then move. Select an adjacent opponent to block.');
            } else {
                updateStatus('Blitz! Block an adjacent opponent first, then move. Select an adjacent opponent to block.');
            }
        } else {
            // No adjacent opponents - start with move mode
            showValidMoves();
            showMovementButtons();
            updateActionButtons();
            if (gameState.stoodUpThisMove) {
                updateStatus('Blitz! Player stood up! Move, then block an opponent. Click adjacent squares to build your movement path.');
            } else {
                updateStatus('Blitz! Move first, then block. Click adjacent squares to build your movement path.');
            }
        }
    });

    document.getElementById('btn-pass').addEventListener('click', () => {
        if (!gameState.selectedPlayer) return;
        const player = gameState.selectedPlayer;

        // Check if player has the ball
        if (!player.hasBall) {
            updateStatus('Player must have the ball to pass.');
            return;
        }

        // Check if pass has already been used this turn
        if (gameState.passUsed) {
            updateStatus('Pass action has already been used this turn.');
            return;
        }

        // If player stood up during move action, revert it
        if (gameState.stoodUpThisMove) {
            const { player: stoodUpPlayer, standUpCost } = gameState.stoodUpThisMove;
            if (stoodUpPlayer === player) {
                player.knockedDown = true;
                player.remainingMovement += standUpCost;
                const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
                if (playerElement) {
                    playerElement.classList.add('knocked-down');
                }
            }
        }

        gameState.actionMode = 'pass';
        gameState.movementPath = [];
        gameState.stoodUpThisMove = null;
        gameState.passTarget = null;
        clearValidMoves(); // Clear any movement or block highlights
        clearMovementPathDisplay();

        // Allow movement before pass - show valid moves
        showValidMoves();
        // Also show valid pass targets
        showValidPassTargets();

        updateActionButtons();
        updateStatus('You can move first, then pass, or click a teammate to pass immediately.');
    });

    document.getElementById('btn-follow-up').addEventListener('click', () => {
        handleFollowUp();
    });

    document.getElementById('btn-stay').addEventListener('click', () => {
        handleStay();
    });

    const btnConfirmMove = document.getElementById('btn-confirm-move');
    if (btnConfirmMove) {
        btnConfirmMove.addEventListener('click', () => {
            executeMovement();
        });
    }

    const btnCancelMove = document.getElementById('btn-cancel-move');
    if (btnCancelMove) {
        btnCancelMove.addEventListener('click', () => {
            cancelMovement();
        });
    }

    document.getElementById('btn-die-1').addEventListener('click', () => {
        if (gameState.pendingBlockRolls) {
            processBlockResult(gameState.pendingBlockRolls.dice[0]);
        }
    });

    document.getElementById('btn-die-2').addEventListener('click', () => {
        if (gameState.pendingBlockRolls) {
            processBlockResult(gameState.pendingBlockRolls.dice[1]);
        }
    });

    document.getElementById('btn-die-3').addEventListener('click', () => {
        if (gameState.pendingBlockRolls) {
            processBlockResult(gameState.pendingBlockRolls.dice[2]);
        }
    });

    // Help overlay
    const helpLink = document.getElementById('help-link');
    if (helpLink) {
        helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Help link clicked!');
            showHelpOverlay();
        });
        console.log('Help link event listener attached');
    } else {
        console.error('Help link not found!');
    }

    const helpClose = document.getElementById('help-close');
    if (helpClose) {
        helpClose.addEventListener('click', () => {
            hideHelpOverlay();
        });
    }

    // Close help overlay when clicking outside
    const helpOverlay = document.getElementById('help-overlay');
    if (helpOverlay) {
        helpOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'help-overlay') {
                hideHelpOverlay();
            }
        });
    }

    // Demo dropdown
    const demoLink = document.getElementById('demo-link');
    const demoMenu = document.getElementById('demo-menu');

    if (demoLink && demoMenu) {
        demoLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Demo link clicked!');
            // Toggle dropdown
            const currentDisplay = window.getComputedStyle(demoMenu).display;
            console.log('Current display:', currentDisplay);
            if (currentDisplay === 'none') {
                demoMenu.style.display = 'block';
                console.log('Showing demo menu');
            } else {
                demoMenu.style.display = 'none';
                console.log('Hiding demo menu');
            }
        });
        console.log('Demo link event listener attached');

        // Demo option clicks
        document.querySelectorAll('.demo-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const demoType = option.dataset.demo;
                loadDemo(demoType);
                demoMenu.style.display = 'none';
            });
        });

        // Close demo dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.demo-dropdown')) {
                demoMenu.style.display = 'none';
            }
        });
    } else {
        console.error('Demo link or menu not found!', { demoLink, demoMenu });
    }
}

// Show player stats on hover
function showPlayerStats(player) {
    const statsPanel = document.getElementById(`player-stats-team${player.team}`);
    if (!statsPanel) return;

    // Update position
    const positionEl = document.getElementById(`player-stats-position-team${player.team}`);
    if (positionEl) {
        positionEl.textContent = player.position;
    }

    // Update stats
    document.getElementById(`player-stats-movement-team${player.team}`).textContent = player.movement;
    document.getElementById(`player-stats-strength-team${player.team}`).textContent = player.strength;
    document.getElementById(`player-stats-agility-team${player.team}`).textContent = player.agility;
    document.getElementById(`player-stats-armour-team${player.team}`).textContent = player.armour;

    // Update skills
    const skillsListEl = document.getElementById(`player-stats-skills-team${player.team}`);
    if (skillsListEl) {
        if (player.skills && player.skills.length > 0) {
            skillsListEl.textContent = player.skills.join(', ');
        } else {
            skillsListEl.textContent = 'None';
        }
    }

    // Show the stats panel
    statsPanel.style.display = 'block';
}

// Hide player stats
function hidePlayerStats(team) {
    const statsPanel = document.getElementById(`player-stats-team${team}`);
    if (statsPanel) {
        statsPanel.style.display = 'none';
    }
}

// Load a demo setup
function loadDemo(demoType) {
    // Set demo mode flag and store demo type
    gameState.demoMode = true;
    gameState.demoType = demoType;

    // Clear setup area highlights FIRST, before any other operations
    document.querySelectorAll('.setup-area').forEach(cell => {
        cell.classList.remove('setup-area');
    });

    // Reset all game state
    gameState.players = [];
    gameState.ballHolder = null;
    gameState.ballPosition = null;
    gameState.selectedPlayer = null;
    gameState.selectedCell = null;
    gameState.actionMode = null;
    gameState.movementPath = [];
    gameState.currentTeam = 1;
    gameState.blitzUsed = false;
    gameState.blitzTarget = null;
    gameState.passUsed = false;
    gameState.passTarget = null;
    gameState.setupPhase = false;
    gameState.pendingBlockRolls = null;
    gameState.pendingPushSelection = null;
    gameState.stoodUpThisMove = null;
    gameState.gfiSquaresUsed = 0;
    gameState.pendingFollowUp = null;
    gameState.removedPlayers = [];
    gameState.turnNumber = 1;
    gameState.turnsInHalf = 1;
    gameState.currentHalf = 1;
    gameState.totalTurns = 0;
    gameState.scores = { team1: 0, team2: 0 };

    // Clear all ball visuals first (from players and ground)
    document.querySelectorAll('.ball, .ball-on-ground').forEach(ball => {
        ball.remove();
    });

    // Remove has-ball class from all players
    document.querySelectorAll('.has-ball').forEach(element => {
        element.classList.remove('has-ball');
    });

    // Clear all player elements from the DOM (both on board and in reserves)
    document.querySelectorAll('.player, .player-box-item').forEach(element => {
        element.remove();
    });

    // Clear the board
    for (let row = 0; row < gameState.boardHeight; row++) {
        for (let col = 0; col < gameState.boardWidth; col++) {
            const cellData = gameState.board[row][col];
            if (cellData.player) {
                cellData.player = null;
            }
            // Remove any remaining ball visuals
            const ball = cellData.cell.querySelector('.ball, .ball-on-ground');
            if (ball) {
                ball.remove();
            }
        }
    }

    // Clear player boxes
    const team1Box = document.getElementById('player-box-content-team1');
    const team2Box = document.getElementById('player-box-content-team2');
    if (team1Box) team1Box.innerHTML = '';
    if (team2Box) team2Box.innerHTML = '';

    // Hide player boxes
    const team1BoxContainer = document.getElementById('player-box-team1');
    const team2BoxContainer = document.getElementById('player-box-team2');
    if (team1BoxContainer) team1BoxContainer.style.display = 'none';
    if (team2BoxContainer) team2BoxContainer.style.display = 'none';

    // Load the specific demo
    switch (demoType) {
        case 'movement':
            setupMovementDemo();
            break;
        case 'blocking':
            setupBlockingDemo();
            break;
        case 'blitzing':
            setupBlitzingDemo();
            break;
        case 'passing':
            setupPassingDemo();
            break;
        default:
            console.warn('Unknown demo type:', demoType);
            return;
    }

    // Clear all UI highlights and buttons
    clearValidMoves();
    clearMovementPathDisplay();
    clearTackleZones();
    hideFollowUpButtons();
    hideBlockDiceButtons();
    hideMovementButtons();

    // Clear setup area highlights and all other cell classes (force remove with !important equivalent)
    const allCells = document.querySelectorAll('.cell');
    allCells.forEach(cell => {
        cell.classList.remove('setup-area', 'valid-move', 'reachable-area', 'gfi-available', 'pass-target', 'block-good', 'block-bad', 'tackle-zone', 'selected', 'path-step', 'gfi-step');
    });

    // Also specifically target setup-area one more time to be sure
    document.querySelectorAll('.setup-area').forEach(cell => {
        cell.classList.remove('setup-area');
    });

    // Clear any selected highlighting
    document.querySelectorAll('.cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    document.querySelectorAll('.player.selected').forEach(player => {
        player.classList.remove('selected');
    });

    // Clear any path steps
    document.querySelectorAll('.cell.path-step').forEach(cell => {
        cell.classList.remove('path-step', 'gfi-step');
        cell.removeAttribute('data-step-number');
    });

    // Update UI
    updateUI();
    updateActionButtons();

    // For movement demo, automatically select the player and show valid moves
    if (demoType === 'movement' && gameState.players.length > 0) {
        const player = gameState.players[0];
        if (player && player.team === gameState.currentTeam) {
            selectPlayer(player);
            // GFI squares should be visible in movement demo
        }
    }

    // For blocking demo, automatically select the first blue player and set block mode
    if (demoType === 'blocking' && gameState.players.length > 0) {
        const bluePlayer = gameState.players.find(p => p.team === 1);
        if (bluePlayer) {
            selectPlayer(bluePlayer);
            // Set block mode after selection
            gameState.actionMode = 'block';
            clearValidMoves();
            clearMovementPathDisplay();
            showValidBlocks();
            updateActionButtons();
            updateStatus('Select an adjacent opponent to block. Double-click to perform block.');
            // Remove GFI squares (yellow highlights) from demo
            setTimeout(() => {
                document.querySelectorAll('.gfi-available').forEach(cell => {
                    cell.classList.remove('gfi-available');
                });
            }, 0);
        }
    }

    // For passing demo, automatically select the player with the ball
    if (demoType === 'passing' && gameState.players.length > 0) {
        const playerWithBall = gameState.players.find(p => p.hasBall && p.team === gameState.currentTeam);
        if (playerWithBall) {
            selectPlayer(playerWithBall);
            // Set pass mode after selection
            gameState.actionMode = 'pass';
            clearValidMoves();
            clearMovementPathDisplay();
            showValidPassTargets();
            updateActionButtons();
            updateStatus('Player has the ball! Click "Pass" button or move first, then select a teammate to pass to.');
        }
    }

    updateStatus(`Demo loaded: ${demoType.charAt(0).toUpperCase() + demoType.slice(1)}`);
}

// Demo setup functions (to be implemented)
function setupMovementDemo() {
    // Place 1 player from blue team (Team 1) in the middle of the pitch
    const middleRow = Math.floor(gameState.boardHeight / 2); // Middle row (5)
    const middleCol = Math.floor(gameState.boardWidth / 2); // Middle column (10)

    const player = createPlayer(1, 1, middleRow, middleCol);
    gameState.players.push(player);

    // Add a Team 2 player 3 squares away (to the right)
    const redPlayer = createPlayer(2, 1, middleRow, middleCol + 3);
    gameState.players.push(redPlayer);

    // Reset player state for new turn
    player.hasActed = false;
    player.hasMoved = false;
    player.remainingMovement = player.movement;
    player.knockedDown = false;

    redPlayer.hasActed = false;
    redPlayer.hasMoved = false;
    redPlayer.remainingMovement = redPlayer.movement;
    redPlayer.knockedDown = false;

    // Set current team to Team 1 so the player can be selected
    gameState.currentTeam = 1;
    gameState.attackingTeam = 1;
    gameState.defendingTeam = 2;
    gameState.setupPhase = false;

    // Initialize turn state
    gameState.turnNumber = 1;
    gameState.turnsInHalf = 1;
    gameState.currentHalf = 1;
}

function setupBlockingDemo() {
    // Scenario 1: One player of each team next to each other
    // Top-left area: Blue at (1, 2), Red at (1, 3) - adjacent horizontally
    gameState.players.push(createPlayer(1, 1, 1, 2)); // Blue
    gameState.players.push(createPlayer(2, 1, 1, 3)); // Red

    // Scenario 2: 2 blue players next to 1 red
    // Top-right area: Red at (1, 16), Blue at (0, 16) and (2, 16) - adjacent vertically
    gameState.players.push(createPlayer(2, 2, 1, 16)); // Red
    gameState.players.push(createPlayer(1, 2, 0, 16)); // Blue above
    gameState.players.push(createPlayer(1, 3, 2, 16)); // Blue below

    // Scenario 3: 1 blue next to 2 red
    // Middle-left area: Blue at (5, 3), Red at (5, 4) and (6, 3) - adjacent horizontally and diagonally
    gameState.players.push(createPlayer(1, 4, 5, 3)); // Blue
    gameState.players.push(createPlayer(2, 3, 5, 4)); // Red to the right
    gameState.players.push(createPlayer(2, 4, 6, 3)); // Red diagonally down-right

    // Scenario 4: 1 red player on the edge of the board, and 3 blue players next to them
    // Bottom-left corner: Red at (9, 0) - left edge, Blue at (8, 0), (9, 1), (10, 0) - surrounding the red
    gameState.players.push(createPlayer(2, 5, 9, 0)); // Red on left edge
    gameState.players.push(createPlayer(1, 5, 8, 0)); // Blue above
    gameState.players.push(createPlayer(1, 6, 9, 1)); // Blue to the right
    gameState.players.push(createPlayer(1, 7, 10, 0)); // Blue below

    // Scenario 5: A line of 4 blue players from one of the edges, and a red player next to the third blue player
    // Right side: 4 blue players in a vertical line, moved 8 squares towards Team 1 endzone (left)
    // First at bottom (10, 11), then (9, 11), (8, 11), (7, 11)
    // Red player at (8, 10) - next to the third blue player (counting from bottom: 1st=10, 2nd=9, 3rd=8)
    gameState.players.push(createPlayer(1, 8, 10, 11)); // Blue 1 (bottom)
    gameState.players.push(createPlayer(1, 9, 9, 11)); // Blue 2
    gameState.players.push(createPlayer(1, 10, 8, 11)); // Blue 3 (third from bottom)
    gameState.players.push(createPlayer(1, 11, 7, 11)); // Blue 4 (top)
    gameState.players.push(createPlayer(2, 6, 8, 10)); // Red next to third blue player

    // Scenario 6: A blue player, then a red player, then one red in a line, then reds above and below the last red
    // Bottom-right area: Blue at (9, 13), Red at (9, 14), Red at (9, 15), then Red at (8, 15) above and (10, 15) below
    gameState.players.push(createPlayer(1, 12, 9, 13)); // Blue
    gameState.players.push(createPlayer(2, 7, 9, 14)); // Red (first red, in contact with blue)
    gameState.players.push(createPlayer(2, 8, 9, 15)); // Red (second red, continuing the line)
    gameState.players.push(createPlayer(2, 9, 8, 15)); // Red above the last red
    gameState.players.push(createPlayer(2, 10, 10, 15)); // Red below the last red

    // Reset all players' state for new turn
    gameState.players.forEach(player => {
        player.hasActed = false;
        player.hasMoved = false;
        player.remainingMovement = player.movement;
        player.knockedDown = false;
    });

    // Set current team to Team 1 (blue) so they can act
    gameState.currentTeam = 1;
    gameState.attackingTeam = 1;
    gameState.defendingTeam = 2;
    gameState.setupPhase = false;

    // Initialize turn state
    gameState.turnNumber = 1;
    gameState.turnsInHalf = 1;
    gameState.currentHalf = 1;
}

function setupBlitzingDemo() {
    // TODO: Set up board for blitzing demo
    // Example: Place players in positions to demonstrate blitz action
}

function setupPassingDemo() {
    // Place 2 blue players (Team 1) - one in the middle of each half
    const middleRow = Math.floor(gameState.boardHeight / 2); // Middle row (5)

    // Middle of Team 1's half (left side, columns 0-9)
    const team1HalfMiddleCol = Math.floor((gameState.boardWidth / 2) / 2); // Column 5

    // Middle of Team 2's half (right side, columns 10-19)
    const team2HalfMiddleCol = Math.floor(gameState.boardWidth / 2) + Math.floor((gameState.boardWidth / 2) / 2); // Column 15

    // Create player 1 in Team 1's half (with the ball)
    const player1 = createPlayer(1, 1, middleRow, team1HalfMiddleCol);
    gameState.players.push(player1);

    // Create player 2 in Team 2's half (without the ball)
    const player2 = createPlayer(1, 2, middleRow, team2HalfMiddleCol);
    gameState.players.push(player2);

    // Give the ball to player 1
    giveBallToPlayer(player1);

    // Reset player state for new turn
    player1.hasActed = false;
    player1.hasMoved = false;
    player1.remainingMovement = player1.movement;
    player1.knockedDown = false;

    player2.hasActed = false;
    player2.hasMoved = false;
    player2.remainingMovement = player2.movement;
    player2.knockedDown = false;

    // Set current team to Team 1 so the players can be selected
    gameState.currentTeam = 1;
    gameState.attackingTeam = 1;
    gameState.defendingTeam = 2;
    gameState.setupPhase = false;

    // Initialize turn state
    gameState.turnNumber = 1;
    gameState.turnsInHalf = 1;
    gameState.currentHalf = 1;
}

// Add dice roll animation
const style = document.createElement('style');
style.textContent = `
    @keyframes roll {
        0% { transform: rotate(0deg); }
        50% { transform: rotate(180deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', initGame);

