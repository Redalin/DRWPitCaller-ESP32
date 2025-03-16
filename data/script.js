function updateTeamName(selectElement, teamId) {
    const selectedTeamName = selectElement.value;
    document.querySelector(`#${teamId} .team-name`).textContent = selectedTeamName;
}

function pilotSwap(teamId, buttonId) {
    const teamBox = document.getElementById(teamId);
    const teamName = teamBox.querySelector('.team-name').textContent;
    const button = document.getElementById(buttonId);

    teamBox.style.backgroundColor = 'yellow';

    const announcement = new SpeechSynthesisUtterance(`Pilot swap announced: ${teamName}`);
    window.speechSynthesis.speak(announcement);

    button.disabled = true;

    setTimeout(() => {
        teamBox.style.backgroundColor = '';
        button.disabled = false;
    }, 20000);


}