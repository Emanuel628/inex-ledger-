import fs from "fs/promises";
import path from "path";
import pool from "../db.js";

const MIGRATIONS_DIR = path.resolve(new URL("../migrations", import.meta.url));

const applyMigrations = async () => {
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = entries.filter((name) => name.endsWith(".sql")).sort();
    if (!sqlFiles.length) {
      console.log("No migrations found.");
      return;
    }

    for (const file of sqlFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const contents = await fs.readFile(filePath, "utf8");
      if (!contents.trim()) continue;
      console.log(`Applying migration ${file}...`);
      await pool.query(contents);
    }
  } catch (error) {
    console.error("Migration runner encountered an error:", error);
    throw error;
  } finally {
    await pool.end();
  }
};

if (process.argv[1].endsWith("applyMigrations.js")) {
  applyMigrations()
    .then(() => console.log("Migrations applied."))
    .catch((err) => {
      console.error("Failed to apply migrations", err);
      process.exit(1);
    });
}
