import bcrypt from "bcryptjs";

const hash = (pw) => bcrypt.hashSync(pw, 10);

export const SEEDED_USERS = [
  { id: "driver-001", username: "driver1", password: hash("pass123"), role: "DRIVER" },
  { id: "driver-002", username: "driver2", password: hash("pass123"), role: "DRIVER" },
  { id: "driver-003", username: "driver3", password: hash("pass123"), role: "DRIVER" },
  { id: "driver-004", username: "driver4", password: hash("pass123"), role: "DRIVER" },
  { id: "rider-001",  username: "rider1",  password: hash("pass123"), role: "RIDER"  },
];
