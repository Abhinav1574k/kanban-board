let boardData = null;
const boardId = 1;

async function loadBoard() {
  const response = await fetch(`/api/boards/${boardId}`);
  boardData = await response.json();

  renderBoard();
}

function renderBoard() {
  const board = document.getElementById("board");

  board.innerHTML = "";

  boardData.columns.forEach((column) => {
    const columnElement = document.createElement("div");
    columnElement.className = "column";

    columnElement.innerHTML = `
       <div class="column-header">
    <h2>${escapeHtml(column.name)}</h2>

    <button
      class="delete-column"
      onclick="deleteColumn(${column.id})"
    >
      Delete Column
    </button>
  </div>

  <div
    class="cards drop-zone"
    data-column-id="${column.id}"
    ondragover="allowDrop(event)"
    ondrop="dropCard(event)"
  ></div>

  <button class = "add-card-inColumn" onclick="addCardToColumn(${column.id})">
    + Add Card
  </button>
    `;

    const cardsContainer = columnElement.querySelector(".cards");

    column.cards.forEach((card) => {
      const cardElement = document.createElement("div");

      cardElement.className = "card";
      cardElement.draggable = true;
      cardElement.dataset.id = card.id;

      cardElement.ondragstart = (event) => {
        event.dataTransfer.setData("cardId", card.id);
      };

      cardElement.innerHTML = `
        <div class="card-title">
          ${escapeHtml(card.title)}
        </div>

        <div class="card-description">
          ${escapeHtml(card.description || "")}
        </div>

        <div class="card-actions">
          <button onclick="editCard(${card.id})">
            Edit
          </button>

          <button
            class="delete"
            onclick="deleteCard(${card.id})"
          >
            Delete
          </button>
        </div>
      `;

      cardsContainer.appendChild(cardElement);
    });

    board.appendChild(columnElement);
  });
}

function allowDrop(event) {
  event.preventDefault();
}

async function dropCard(event) {
  event.preventDefault();

  const cardId = event.dataTransfer.getData("cardId");
  const columnId = event.currentTarget.dataset.columnId;

  const cards = event.currentTarget.querySelectorAll(".card");

  const position = cards.length;

  await fetch(`/api/cards/${cardId}/move`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      column_id: Number(columnId),
      position
    })
  });

  showStatus("Card position saved");

  await loadBoard();
}

async function addCardToColumn(columnId) {
  const title = prompt("Card title:");

  if (!title) return;

  const description = prompt("Description:") || "";

  await fetch("/api/cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      column_id: columnId,
      title,
      description
    })
  });

  await loadBoard();
}

async function addCard() {
  if (!boardData || boardData.columns.length === 0) {
    alert("Create a column first.");
    return;
  }

  addCardToColumn(boardData.columns[0].id);
}

async function addColumn() {
  const name = prompt("Column name:");

  if (!name) return;

  await fetch("/api/columns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      board_id: boardId,
      name
    })
  });

  await loadBoard();
}

async function editCard(id) {
  const card = findCard(id);

  if (!card) return;

  const title = prompt("New title:", card.title);

  if (!title) return;

  const description = prompt(
    "New description:",
    card.description || ""
  );

  await fetch(`/api/cards/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      description
    })
  });

  await loadBoard();
}

async function deleteCard(id) {
  if (!confirm("Delete this card?")) return;

  await fetch(`/api/cards/${id}`, {
    method: "DELETE"
  });

  await loadBoard();
}
async function deleteColumn(id) {
  if (!confirm("Delete this column and all its cards?")) {
    return;
  }

  const response = await fetch(`/api/columns/${id}`, {
    method: "DELETE"
  });

  const result = await response.json();

  if (!response.ok) {
    alert(result.error || "Failed to delete column");
    return;
  }

  showStatus("Column deleted");

  await loadBoard();
}

function findCard(id) {
  for (const column of boardData.columns) {
    const card = column.cards.find(
      (card) => card.id === Number(id)
    );

    if (card) return card;
  }

  return null;
}

function showStatus(message) {
  const status = document.getElementById("status");

  status.textContent = message;

  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadBoard();