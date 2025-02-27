document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('playButton');
    const joinButton = document.getElementById('joinButton');
    const gameIdInput = document.getElementById('gameIdInput');

    playButton.addEventListener('click', () => {
        window.location.href = '/play';
    });

    function joinGame() {
        const gameId = gameIdInput.value.toUpperCase();
        if (gameId.length === 4) {
            window.location.href = `/game/${gameId}`;
        } else {
            alert('Please enter a valid 4-character game ID');
        }
    }

    joinButton.addEventListener('click', joinGame);
    gameIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
}); 