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

function resetStats() {
  websocket.send('resetStats');
  for(var lane = 0; lane < 4; lane++) {
    updateStats(lane, "0");
  }
}

function handleWebSocketMessage(message) {
  if (message.type === 'update') {
    updateUI(message.data);
  } else if (message.type === 'announce') {
    announcePitting(message.lane, message.pilotName, message.isPitting);
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

function announcePitting(lane, pilotName, isPitting) {
  var text = isPitting ? "Lane " + (lane + 1) + " pilot " + pilotName + "  is pitting" : "Lane " + (lane + 1) + " pilot " + pilotName + " is leaving the pits";
  var utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
}

function updateUI(buttonStates) {
  for (var i = 0; i < buttonStates.length; i++) {
    var lane = document.getElementById('lane' + (i + 1));   
    var h2 = lane.getElementsByTagName('h2')[0];
    var button = lane.getElementsByTagName('button')[0];
    var input = lane.getElementsByClassName('pilotName')[0];
    updateStats(i, buttonStates[i].pitCount)
    if (buttonStates[i].countdown > 0) {
      button.innerHTML = buttonStates[i].countdown;
      button.disabled = true;
    } else if (buttonStates[i].isPitting) {
      button.innerHTML = 'Leave Pit';
      button.disabled = false;
      button.style.backgroundColor = 'purple';
    } else {
      button.innerHTML = 'Pit';
      button.disabled = false;
      button.style.backgroundColor = ""
    }
    h2.textContent = "Lane " + (i + 1) + (buttonStates[i].pilotName ? ": " + buttonStates[i].pilotName : "");
    input.value = buttonStates[i].pilotName || '';
  }
}

function updateStats(lane, count) {
  var laneStat = document.getElementById('stats' + (lane + 1));
  laneStat.textContent = "Lane " + (lane + 1) + ": " + count;
}

window.onload = function(event) {
  initWebSocket();
}
