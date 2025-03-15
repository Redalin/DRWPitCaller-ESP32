const sounds = ['AirStrike', 'Explosion', 'Anthem', 'Baa', 'Moo', 'Cymbals', 'Dumdum', 'Puke', 'RubberDucky', 'Trumpet', 'WarningHorn', 'Waahwaah', 'Woow', 'Yaay'];

sounds.forEach((sound) => {
  const btn = document.createElement('button');
  btn.classList.add('soundButton');
  btn.innerText = sound;

  btn.addEventListener('click', ()=> {
    stopSounds();
    document.getElementById(sound).play();
  });

  document.getElementById('buttons').appendChild(btn);
});

function stopSounds() {
  sounds.forEach((sound) =>{
    const song = document.getElementById(sound);
    song.pause();
    song.currentTime = 0;
  });
}

const input = document.getElementById('editableInput');
const editButton = document.getElementById('editButton');

editButton.addEventListener('click', () => {
  if (input.hasAttribute('readonly')) {
    input.removeAttribute('readonly');
    input.focus();
    editButton.title = "Save";
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>`;
  } else {
    input.setAttribute('readonly', true);
    editButton.title = "Edit";
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-2.036a2.5 2.5 0 113.536 3.536L7 21H3v-4L16.732 6.732z" />
      </svg>`;
  }
});

/* Set the width of the sidebar to 250px (show it) */
function openNav() {
  document.getElementById("menuSidepanel").style.width = "200px";
}

/* Set the width of the sidebar to 0 (hide it) */
function closeNav() {
  document.getElementById("menuSidepanel").style.width = "0";
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

function playCustomMessage() {
  // Find the closest card div to the button that was clicked
  const button = event.target; // Get the button that triggered this function
  const card = button.closest('.card'); // Find the closest parent card div
  const input = card.querySelector('.pilotName'); // Select the input within this card

  if (input && input.value) {
    speakText(input.value); // Pass the input's value to the speakText function
  } else {
    console.error("No text found in input field.");
  }
}

function speakText(text) {
  if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
  } else {
      console.error("Speech Synthesis not supported in this browser.");
  }
}

window.onload = function(event) {

}