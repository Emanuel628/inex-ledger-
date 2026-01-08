import { updateEcosystemMomentum } from "../services/momentumService.js";

export const rollMomentum = async (req, res) => {
  const { vaultStats } = req.body || {};
  if (!vaultStats || typeof vaultStats !== "object") {
    return res.status(400).json({ error: "vaultStats payload is required" });
  }

  try {
    const momentum = await updateEcosystemMomentum(req.user.id, vaultStats);
    if (!momentum) {
      return res.status(400).json({ error: "No usable vault stats were provided" });
    }

    const response = {
      level: momentum.level,
      momentumStreak: momentum.momentumStreak,
      identity: {
        ecosystem_level: momentum.level,
        momentum_streak: momentum.momentumStreak,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Momentum roll failed:", error);
    res.status(500).json({ error: "Unable to update ecosystem momentum" });
  }
};
