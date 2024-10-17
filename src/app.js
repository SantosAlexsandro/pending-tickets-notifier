import dotenv from "dotenv";
import { resolve } from "path";
import cors from "cors";
import cron from "node-cron";
const MilvusTicketsList = require("../src/controllers/MilvusTicketsListController");

dotenv.config();

import express from "express";
// import tokenRoutes from './routes/tokenRoutes';
import milvusTicketsListRoutes from "./routes/milvusTicketsListRoutes";

const whiteList = ["http://localhost:3000", "https://dash.cumpacell.com"];

const corsOptions = {
  origin(origin, callback) {
    if (whiteList.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

class App {
  constructor() {
    this.app = express();
    this.middlewares();
    this.routes();
    this.startCronJob();
  }

  middlewares() {
    this.app.use(cors(corsOptions));
    // this.app.use(helmet());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
  }

  routes() {
    //this.app.use("/", milvusTicketsListRoutes);
    // this.app.use('/tokens/', tokenRoutes);
  }

  startCronJob() {
    // Configura o cron job para rodar a cada minuto
    cron.schedule("04 00 * * *", () => {
      console.log("Executando diariamente as 7:30");
      MilvusTicketsList.executeTask(); // Chama a função sem req e res
    });
  }
}

//  41 7 * * *

export default new App().app;
