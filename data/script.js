function initWebSocket() {
    websocket = new WebSocket('ws://' + window.location.hostname + '/ws');
    websocket.onopen = function(event) { console.log('Connected to WebSocket'); };
    websocket.onclose = function(event) { console.log('Disconnected from WebSocket'); };
    websocket.onmessage = function(event) {
        try {
            handleWebSocketMessage(JSON.parse(event.data));
        } catch (e) {
            console.error('Invalid JSON 1.22:', event.data);
        }
    };
    websocket.onerror = function(event) { console.error('WebSocket error:', event); }; // Add error handling
}
 
// takes select element and teamId as arguments
// sends a websocket with json data to update the team name.
function updateTeamName(selectElement, teamId) {
    console.log('updateTeamName: ', teamId, " -> ", selectElement.value);
    const selectedTeamName = selectElement.value;
    
    websocket.send(JSON.stringify({ type: 'update', teamId: teamId, teamName: selectedTeamName })); // Ensure correct data format
}

// takes single team update with name, id, countdown and buttonId.
// sends or returns nothing. 
function updateTeamBox(teamName, teamId, countdown, buttonId) {
    // console.log('updateTeamBox: ', teamId, " -> ", teamName, countdown, buttonId);
    document.querySelector(`#${teamId} .team-name`).textContent = teamName;

    const teamBox = document.getElementById(teamId);
    const button = document.getElementById(buttonId);
    if (countdown > 0) {
        // console.log('Disable the button');
        button.disabled = true;
        teamBox.style.backgroundColor = 'yellow';
    } else {
        // console.log('Enable the button');
        button.disabled = false;
        teamBox.style.backgroundColor = '';
    }

}

// takes teamId, buttonId and countdown as arguments for a single lane update.
// sends a websocket with json data to notify other clients.
function pilotSwap(teamId, buttonId) {
    console.log('pilotSwap: ', teamId, " -> ", buttonId);
    const teamBox = document.getElementById(teamId);
    // const teamID = teamId.substring(4);
    const teamName = teamBox.querySelector('.team-name').textContent;
    // const button = document.getElementById(buttonId);
    // console.log('pilotSwap: ', teamID, " -> ", teamBox.id, teamName, button.id);

    const announcement = (`Pilot swap announced: ${teamName}`);
    voiceAnnounce(announcement);

    // websocket.send(JSON.stringify({ type: 'pilotSwap', teamId: teamID, buttonId: button.id })); // Ensure correct data format
}

function voiceAnnounce(text) {
    const announcement = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(announcement);
}

function updateTeamsUI(UIdata) {
    // console.log('updateTeamsUI: ', UIdata);
    for (var i = 0; i < UIdata.length; i++) {
        const teamName = UIdata[i].teamName;
        const countdown = UIdata[i].countdown;
        const teamId = 'team' + (i + 1);
        const buttonId = 'pilotSwapButton' + (i + 1);

        //console.log('Calling updateTeamBox with: ', teamId,  teamName, countdown, buttonId);
        updateTeamBox(teamName, teamId, countdown, buttonId);
    }
}

function handleWebSocketMessage(message) {
    if (message.type === 'update') {
        // console.log('handle JS Websocket update: ', message);
        updateTeamsUI(message.data);
    }  
    
    // This code removed as not needed, but kept for reference in case we need to enable voice synthesis for the pit button 
    else if (message.type === 'pilotSwap') {
       console.log('handle JS Websocket pilotSwap: ', message);
        const teamId = 'team' + message.team;
        const buttonId = 'pilotSwapButton' + message.team;
        pilotSwap(teamId, buttonId);
    }
}

window.onload = function(event) {
    console.log('onload');
    initWebSocket();
}