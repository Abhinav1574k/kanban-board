const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./kanban.db");
db.run("PRAGMA foreign_keys = ON");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      column_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM boards", (err, row) => {
    if (err) {
      console.error(err);
      return;
    }

    if (row.count === 0) {
      db.run("INSERT INTO boards (name) VALUES (?)", ["My Kanban Board"], function () {
        const boardId = this.lastID;

        const columns = ["To Do", "In Progress", "Done"];

        columns.forEach((name, index) => {
          db.run(
            "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
            [boardId, name, index]
          );
        });
      });
    }
  });
});

// GET board
app.get("/api/boards/:id", (req, res) => {
  const boardId = req.params.id;

  db.get(
    "SELECT * FROM boards WHERE id = ?",
    [boardId],
    (err, board) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!board) return res.status(404).json({ error: "Board not found" });

      db.all(
        "SELECT * FROM columns WHERE board_id = ? ORDER BY position",
        [boardId],
        (err, columns) => {
          if (err) return res.status(500).json({ error: err.message });

          let completed = 0;

          if (columns.length === 0) {
            return res.json({ ...board, columns: [] });
          }

          columns.forEach((column) => {
            db.all(
              "SELECT * FROM cards WHERE column_id = ? ORDER BY position",
              [column.id],
              (err, cards) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }

                column.cards = cards;
                completed++;

                if (completed === columns.length) {
                  res.json({
                    ...board,
                    columns
                  });
                }
              }
            );
          });
        }
      );
    }
  );
});

// GET all boards
app.get("/api/boards", (req, res) => {
  db.all("SELECT * FROM boards ORDER BY id", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// CREATE board
app.post("/api/boards", (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Board name is required" });
  }

  db.run(
    "INSERT INTO boards (name) VALUES (?)",
    [name.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        id: this.lastID,
        name: name.trim()
      });
    }
  );
});

// CREATE column
app.post("/api/columns", (req, res) => {
  const { board_id, name } = req.body;

  if (!board_id || !name || !name.trim()) {
    return res.status(400).json({ error: "Board ID and column name are required" });
  }

  db.get(
    "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM columns WHERE board_id = ?",
    [board_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
        [board_id, name.trim(), row.position],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          res.status(201).json({
            id: this.lastID,
            board_id,
            name: name.trim(),
            position: row.position
          });
        }
      );
    }
  );
});

// CREATE card
app.post("/api/cards", (req, res) => {
  const { column_id, title, description = "" } = req.body;

  if (!column_id || !title || !title.trim()) {
    return res.status(400).json({
      error: "Column ID and card title are required"
    });
  }

  db.get(
    "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM cards WHERE column_id = ?",
    [column_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        `INSERT INTO cards
         (column_id, title, description, position)
         VALUES (?, ?, ?, ?)`,
        [column_id, title.trim(), description, row.position],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          res.status(201).json({
            id: this.lastID,
            column_id,
            title: title.trim(),
            description,
            position: row.position
          });
        }
      );
    }
  );
});

// UPDATE card
app.put("/api/cards/:id", (req, res) => {
  const { title, description } = req.body;

  db.run(
    `UPDATE cards
     SET title = ?, description = ?
     WHERE id = ?`,
    [title, description || "", req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (this.changes === 0) {
        return res.status(404).json({ error: "Card not found" });
      }

      res.json({ message: "Card updated successfully" });
    }
  );
});

// MOVE CARD
app.put("/api/cards/:id/move", (req, res) => {
  const { column_id, position } = req.body;

  if (!column_id || position === undefined) {
    return res.status(400).json({
      error: "column_id and position are required"
    });
  }

  db.run(
    `UPDATE cards
     SET column_id = ?, position = ?
     WHERE id = ?`,
    [column_id, position, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (this.changes === 0) {
        return res.status(404).json({ error: "Card not found" });
      }

      res.json({ message: "Card position saved" });
    }
  );
});

// DELETE card
app.delete("/api/cards/:id", (req, res) => {
  db.run(
    "DELETE FROM cards WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (this.changes === 0) {
        return res.status(404).json({ error: "Card not found" });
      }

      res.json({ message: "Card deleted successfully" });
    }
  );
});

// DELETE column
app.delete("/api/columns/:id", (req, res) => {
  db.run(
    "DELETE FROM columns WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Column deleted successfully" });
    }
  );
});

// Default route
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Kanban server running on port ${PORT}`);
});