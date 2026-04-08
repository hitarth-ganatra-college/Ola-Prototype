import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { SEEDED_USERS } from "./seed/users.js";

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-dev-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

app.get("/health", (_req, res) => res.json({ ok: true, service: "identity-service" }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const user = SEEDED_USERS.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get("/users", (_req, res) => {
  res.json(SEEDED_USERS.map(({ password: _pw, ...u }) => u));
});

const PORT = process.env.IDENTITY_PORT || 4001;
app.listen(PORT, () => console.log(`[identity-service] Listening on :${PORT}`));
