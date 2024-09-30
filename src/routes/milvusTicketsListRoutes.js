
/*
import { Router } from "express";
// import milvusticketscontroller from '../controllers/MilvusTicketsListController';
const MilvusTicketsList = require("../controllers/MilvusTicketsListController");
const router = new Router();

// Rota para executar a tarefa manualmente
router.post("/execute-task", async (req, res) => {
  try {
    await MilvusTicketsList.executeTask(); // Chama a função sem req e res
    res.status(200).send("Tarefa executada com sucesso.");
  } catch (error) {
    console.error("Erro ao executar tarefa:", error);
    res.status(500).send("Erro ao executar tarefa.");
  }
});

export default router;*/
