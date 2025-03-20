const timeout = 5000; // 5 seconds
const keepAliveInterval = 10000; // 10 seconds
const countdown = 20; // 20 seconds   
 
function initWebSocket() {
    websocket = new WebSocket('ws://' + window.location.hostname + '/ws');
    websocket.onopen = function(event) { 
        console.log('Connected to WebSocket'); 
        updateConnectionStatus(true);
    };
    websocket.onclose = function(event) { 
        console.log('Disconnected from WebSocket'); 
        updateConnectionStatus(false);
        setTimeout(initWebSocket, timeout); // Attempt to reconnect after 5 seconds
    };
    websocket.onmessage = function(event) {
        try {
            handleWebSocketMessage(JSON.parse(event.data));
        } catch (e) {
            console.error('Invalid JSON 1.22:', event.data);
        }
    };
    websocket.onerror = function(event) { 
        console.error('WebSocket error:', event); 
        updateConnectionStatus(false);
    }; // Add error handling
}

function keepAlive() {
    if (!websocket || websocket.readyState === WebSocket.CLOSED) {
        console.log('WebSocket is closed, attempting to reconnect...');
        initWebSocket();
    }
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
// function pilotSwap(teamId, buttonId) {
function pilotSwap(teamId) {
    const teamBox = document.getElementById(teamId);
    const teamName = teamBox.querySelector('.team-name').textContent;
    console.log('pilotSwap: ', teamId, " -> ", teamName);

    const announcement = (`Pilot swap announced: ${teamName}`);
    voiceAnnounce(announcement);
}

function pilotSwapStart (teamId, buttonId) {
    const teamID = teamId.substring(4); // get the team number off the end of the teamId
    websocket.send(JSON.stringify({ type: 'pilotSwap', teamId: teamID, buttonId: buttonId })); // Tell the websocket which lane to start
}

// hack to force IOS devices to play audio on an event
let hasEnabledVoice = false;

document.addEventListener('click', () => {
  if (hasEnabledVoice) {
    return;
  }
  const lecture = new SpeechSynthesisUtterance('hello');
  lecture.volume = 0;
  speechSynthesis.speak(lecture);
  hasEnabledVoice = true;
});

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
    }  else if (message.type === 'pilotSwap') {
       // console.log('handle JS Websocket pilotSwap: ', message);
        const teamId = 'team' + message.team;
        // const buttonId = 'pilotSwapButton' + message.team;
        // pilotSwap(teamId, buttonId);
        pilotSwap(teamId);
    }
}

function updateConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('connectionStatusIndicator');
    const statusText = document.getElementById('connectionStatusText');
    if (isConnected) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
}

window.onload = function(event) {
    console.log('onload');
    initWebSocket();
    setInterval(keepAlive, keepAliveInterval); // Check WebSocket connection every 10 seconds
}