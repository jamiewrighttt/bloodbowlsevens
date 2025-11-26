# Mini Blood Bowl

A simplified web-based version of the classic fantasy football game Blood Bowl.

## Features

- **Turn-based gameplay**: Alternate between Team 1 and Team 2
- **Player movement**: Move players across the grid-based field
- **Blocking**: Attempt to knock down opponents
- **Passing**: Pass to teammates
- **Dice rolling**: All actions use dice rolls for success/failure
- **Touchdowns**: Score by reaching the opponent's endzone
- **Score tracking**: Keep track of each team's score

## How to Play

1. **Open the game**: Open `index.html` in Google Chrome (recommended browser)
2. **Select a player**: Click on one of your team's players (blue for Team 1, red for Team 2)
3. **Choose an action**:
   - **Move**: Click "Move" then select a valid cell to move to
   - **Block**: Click "Block" then select an adjacent opponent to block
   - **Pass**: Click "Pass" then select a teammate to pass to
4. **Roll dice**: Actions require dice rolls - click "Roll Dice" to see the result
5. **End turn**: When done with all actions, click "End Turn" to switch to the other team
6. **Score**: Move a player into the opponent's endzone (top 2 rows for Team 2, bottom 2 rows for Team 1) to score a touchdown!

## Game Mechanics

- **Movement**: Players can move up to 6 squares per turn
- **Actions**: Each player can perform one action per turn
- **Dice**: Actions use 6-sided dice - lower rolls are generally better for movement
- **Blocking**: Compares attacker's strength + roll vs defender's strength + roll
- **Passing**: Success depends on distance and agility

## Controls

- Click on players to select them
- Use action buttons (Move, Block, Pass) to choose what to do
- Click on the board to execute actions
- "Roll Dice" button shows a random dice result
- "End Turn" switches to the other team

## Technical Details

- Pure HTML, CSS, and JavaScript (no dependencies)
- Grid-based board (11x20 cells) - Blood Bowl Sevens dimensions
- Three zones of 6 squares each plus two 1-square endzones
- 7 players per team
- Turn-based state management
- Responsive design with modern CSS

Enjoy the game!

