// Initial page load constructors
window.onload = function(event) {
    console.log('onload');
    buildTeamNamesTable()
    // initWebSocket();
    // setInterval(keepAlive, keepAliveInterval); // Check WebSocket connection every 10 seconds
}

// Team names table and functions
function buildTeamNamesTable() {
    const tableBody = document.getElementById('azureTableBody');
    tableBody.innerHTML = ''; // Clear existing rows
    teamNames = ["Azure1", "Azure2", "Azure3"];
    teamNames.forEach(name => {
        const row = document.createElement('tr');
        row.setAttribute('draggable', 'true');
        row.setAttribute('ondragstart', 'startDrag(event)');
        row.setAttribute('ondragover', 'dragOver(event)');

        const dragHandleCell = document.createElement('td');
        dragHandleCell.className = 'drag-handle';
        dragHandleCell.textContent = '☰';

        const nameCell = document.createElement('td');
        nameCell.setAttribute('contenteditable', 'true');
        nameCell.textContent = name;

        const removeButtonCell = document.createElement('td');
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.setAttribute('onclick', 'removeRow(this)');
        removeButtonCell.appendChild(removeButton);

        row.appendChild(dragHandleCell);
        row.appendChild(nameCell);
        row.appendChild(removeButtonCell);

        tableBody.appendChild(row);
    });
}

function addRow() {
    random = randomInt(9);
    const table = document.getElementById('azureTable').getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();
    newRow.draggable = true;
    newRow.setAttribute('ondragOver' , 'dragOver(event)');
    newRow.setAttribute('ondragstart', 'startDrag(event)');
    const newCell1 = newRow.insertCell(0);
    const newCell2 = newRow.insertCell(1);
    const newCell3 = newRow.insertCell(2);
    newCell1.className = "drag-handle";
    newCell1.textContent = "☰";
    newCell2.contentEditable = "true";
    newCell2.textContent = "New Azure " + random;
    newCell3.innerHTML = '<button onclick="removeRow(this)">Remove</button>';
}


var pickedRow;
var pickedRowText;
var pickedRowIndex;

function startDrag(event) {
    pickedRow = event.target;
    pickedRowIndex = pickedRow.closest("tr").rowIndex;
    pickedRowText = pickedRow.closest("tr").getElementsByTagName("td")[1].textContent;
    event.dataTransfer.setData("text/plain", pickedRowText);
    // event.target.style.opacity = '0.4';
    console.log('Dragged row:', pickedRowIndex);
}

function dragOver(event) {
    event.preventDefault();

    const targetRow = event.target.closest("tr");

    if (isBefore(pickedRow, targetRow)) {
        pickedRow.parentNode.insertBefore(pickedRow, targetRow);
    } else {
        pickedRow.parentNode.insertBefore(pickedRow, targetRow.nextSibling);
    }
 
}

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function removeRow(button) {
    const row = button.parentNode.parentNode;
    row.parentNode.removeChild(row);
}

function isBefore(pickedRow, targetRow) {
  if (targetRow.parentNode === pickedRow.parentNode)
    for (var cur = pickedRow.previousSibling; cur && cur.nodeType !== 9; cur = cur.previousSibling)
      if (cur === targetRow)
        return true;
  return false;
}
