import pool from "../db.js";

export const purgeUserData = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: "error", message: "Missing authenticated user" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM plaid_items WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_snapshots WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_snapshots_history WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM transactions WHERE user_id = $1", [userId]);

    await client.query(
      "UPDATE users SET email = NULL, profile_data = '{}', updated_at = NOW() WHERE id = $1",
      [userId]
    );

    await client.query("COMMIT");
    return res.json({ status: "ok", message: "User data purged" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error purging user data", error);
    return res.status(500).json({ status: "error", message: "Purge failed" });
  } finally {
    client.release();
  }
};

export const recordExportVerification = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: "error", message: "Missing authenticated user" });
  }
  const { format, exportId, hash, statement, confirmedAt } = req.body || {};
  if (!format || !exportId || !hash || !statement || !confirmedAt) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing export verification payload details." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT profile_data FROM users WHERE id = $1 FOR UPDATE", [
      userId,
    ]);
    const rawData = rows[0]?.profile_data;
    let profileData = {};
    if (rawData) {
      try {
        profileData = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      } catch {
        profileData = {};
      }
    }
    const history = Array.isArray(profileData.exportVerifications) ? profileData.exportVerifications : [];
    const nextEntry = {
      format: String(format).toUpperCase(),
      exportId,
      hash,
      statement,
      confirmedAt,
      recordedAt: new Date().toISOString(),
    };
    const nextHistory = [nextEntry, ...history].slice(0, 20);
    const nextProfileData = { ...profileData, exportVerifications: nextHistory };
    await client.query(
      "UPDATE users SET profile_data = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(nextProfileData), userId]
    );
    await client.query("COMMIT");
    return res.json({ status: "ok", exportVerifications: nextHistory });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to record export verification", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to record export verification acknowledgement.",
    });
  } finally {
    client.release();
  }
};
