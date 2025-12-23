import dotenv from "dotenv";
import cron from "node-cron";
import express from "express";
const MilvusTicketsList = require("../src/controllers/MilvusTicketsListController");
const RiosoftTicketsList = require("../src/controllers/RiosoftTicketsListController");

dotenv.config();

class App {
  constructor() {
    this.app = express();
    this.startCronJob();
  }

  startCronJob() {
    // Milvus
    cron.schedule("30 7 * * 1,2,3,4,5", () => {
      console.log("Executando envio de Tickets do Milvus");
      MilvusTicketsList.executeTask();
    });

    // XBotDesk
    cron.schedule("45 7 * * 1,2,3,4,5", () => {
      console.log("Executando envio de Tickets do XBotDesk");
      RiosoftTicketsList.executeTask();
    });

  }
}

export default new App().app;
