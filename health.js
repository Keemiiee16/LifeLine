import express from "express";

export function startHealthServer(port) {
  const app = express();

  app.get("/", (_req, res) => {
    res.status(200).send("NPC bot is running.");
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "npc-life-simulator-bot",
    });
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Health server ready on port ${port}.`);
  });
}
