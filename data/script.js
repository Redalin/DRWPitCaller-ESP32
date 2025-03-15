function updateTeamName(selectElement, teamId) {
    const selectedTeamName = selectElement.value;
    document.querySelector(`#${teamId} .team-name`).textContent = selectedTeamName;
}

function pilotSwap(teamId) {
    const teamBox = document.getElementById(teamId);
    const teamName = teamBox.querySelector('.team-name').textContent;
    teamBox.style.backgroundColor = 'yellow';
    setTimeout(() => {
        teamBox.style.backgroundColor = '';
    }, 10000);

    const announcement = new SpeechSynthesisUtterance(`Pilot swap announced: ${teamName}`);
    window.speechSynthesis.speak(announcement);
}