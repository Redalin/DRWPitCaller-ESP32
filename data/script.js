function initWebSocket() {
    websocket = new WebSocket('ws://' + window.location.hostname + '/ws');
    websocket.onopen = function(event) { console.log('Connected to WebSocket'); };
    websocket.onclose = function(event) { console.log('Disconnected from WebSocket'); };
    websocket.onmessage = function(event) { handleWebSocketMessage(JSON.parse(event.data)); };
}
  
function updateTeamName(selectElement, teamId) {
    const selectedTeamName = selectElement.value;
    document.querySelector(`#${teamId} .team-name`).textContent = selectedTeamName;
    websocket.send(`update${teamId}:${selectedTeamName}`);
}

function pilotSwap(teamId, buttonId) {
    const teamBox = document.getElementById(teamId);
    const teamName = teamBox.querySelector('.team-name').textContent;
    const button = document.getElementById(buttonId);

    teamBox.style.backgroundColor = 'yellow';

    const announcement = (`Pilot swap announced: ${teamName}`);
    voiceAnnounce(announcement);

    button.disabled = true;

    setTimeout(() => {
        teamBox.style.backgroundColor = '';
        button.disabled = false;
    }, 20000);

    websocket.send(`pilotSwap: ${teamId}`);
}

function voiceAnnounce(text) {
    const announcement = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(announcement);
}

function handleWebSocketMessage(message) {
    if (message.type === 'update') {
        updateUI(message.data);
    } else if (message.type === 'pilotSwap') {
        pilotSwap(message.teamId, message.buttonId);
    }
}

window.onload = function(event) {
    initWebSocket();
}