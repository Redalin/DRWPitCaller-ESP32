function initWebSocket() {
    websocket = new WebSocket('ws://' + window.location.hostname + '/ws');
    websocket.onopen = function(event) { console.log('Connected to WebSocket'); };
    websocket.onclose = function(event) { console.log('Disconnected from WebSocket'); };
    websocket.onmessage = function(event) { handleWebSocketMessage(JSON.parse(event.data)); };
    websocket.onerror = function(event) { console.error('WebSocket error:', event); }; // Add error handling
}
  
function updateTeamName(selectElement, teamId) {
    const selectedTeamName = selectElement.value;
    document.querySelector(`#${teamId} .team-name`).textContent = selectedTeamName;
    websocket.send(JSON.stringify({ type: 'update', teamId: teamId, teamName: selectedTeamName })); // Ensure correct data format
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

    websocket.send(JSON.stringify({ type: 'pilotSwap', teamId: teamId, buttonId: buttonId })); // Ensure correct data format
}

function voiceAnnounce(text) {
    const announcement = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(announcement);
}

function handleWebSocketMessage(message) {
    if (message.type === 'update') {
        // we don't need to do anything here because we're already calling the
        // updateTeamName function
        // updateUI(message.data);
    } else if (message.type === 'pilotSwap') {
        // we don't need to do anything because we're already calling the voice 
        // from the pilotSwap function
        // pilotSwap(message.teamId, message.buttonId);
    } else {
        // nothing here either. 
    }
}

window.onload = function(event) {
    initWebSocket();
}