import express from "express";
import cors from "cors";
import { corsUrl } from "../config";

const app = express();

app.use(cors({ origin: corsUrl, optionsSuccessStatus: 200 }));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/healthz", (req, res) => {
  res.send({ ok: true });
});

export default app;
