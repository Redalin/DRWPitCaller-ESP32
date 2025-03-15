/* Set the width of the sidebar to 250px (show it) */
function openNav() {
  document.getElementById("menuSidepanel").style.width = "200px";
}

/* Set the width of the sidebar to 0 (hide it) */
function closeNav() {
  document.getElementById("menuSidepanel").style.width = "0";
}

var websocket;

function initWebSocket() {
  websocket = new WebSocket('ws://' + window.location.hostname + '/ws');
  websocket.onopen = function(event) { console.log('Connected to WebSocket'); };
  websocket.onclose = function(event) { console.log('Disconnected from WebSocket'); };
  websocket.onmessage = function(event) { handleWebSocketMessage(JSON.parse(event.data)); };
}

function startPit(lane) {
  websocket.send('start' + lane);
}

function updateLaneName(lane, name) {
  websocket.send('update' + lane + ':' + name);
}

function updatePilotName(lane, pilotNum, name) {
  websocket.send('update' + lane + ':' + pilotNum + ":" + name);
}

function handleWebSocketMessage(message) {
  if (message.type === 'update') {
    updateUI(message.data);
  } else if (message.type === 'announce') {
    announcePitting(message.lane, message.pilotName1, message.pilotName2);
  }
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

function announcePitting(teamName, activePilot, standbyPilot) {
  var text = "Team " + (teamName) + " is switching " + activePilot + " for " + standbyPilot;
  var utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
}

function updateUI(buttonStates) {
  for (var i = 0; i < buttonStates.length; i++) {
    var lane = document.getElementById('lane' + (i + 1));
    var h2 = lane.getElementsByTagName('h2')[0];
    var h3 = lane.getElementsByTagName('h3')[0];
    var h4 = lane.getElementsByTagName('h4')[0];
    var button = lane.getElementsByTagName('button')[0];
    var pilotName1 = lane.getElementsByClassName('pilotName1')[0];
    if (buttonStates[i].countdown > 0) {
      button.innerHTML = buttonStates[i].countdown;
      button.disabled = true;
    } else {
      button.innerHTML = 'Pilot Switch';
      button.disabled = false;
    }
    h2.textContent = "Team: " + (i + 1) + (buttonStates[i].pilotName ? ": " + buttonStates[i].pilotName : "");
    h3.textContent = "Pilot: " + (buttonStates[i].activePilot || 'None'); 
    h4.textContent = "Standby: " + (buttonStates[i].standbyPilot || 'None');
    input.value = buttonStates[i].pilotName || '';
  }
}

window.onload = function(event) {
  initWebSocket();
}
