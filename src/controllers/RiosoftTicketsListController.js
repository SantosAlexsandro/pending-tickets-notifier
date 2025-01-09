const nodemailer = require("nodemailer");
const axios = require("axios");
const moment = require("moment");
require("dotenv").config();

const urlBase = "http://riosoft.xbotdesk.com.br/api";

const ticketsListUrl =
  urlBase +
  "/Ticket/RetrievePage?filter=IDEstado=10&order=&pageSize=20&pageIndex=1";

const tokenApiUrl = urlBase + "/RsLogin/Login";

const payload = {
  UserName: "CONAB.ALEXSANDROSANTOS",
  Password: "Al8725@",
};

// Função para obter o token
async function fetchTokenByUserName() {
  try {
    const tokenResponse = await axios.post(tokenApiUrl, payload);
    console.log("tokenResponse", tokenResponse.headers["riosoft-token"]);
    if (tokenResponse.headers["riosoft-token"]) {
      return tokenResponse.headers["riosoft-token"];
    } else {
      throw new Error("Token não encontrado na resposta");
    }
  } catch (e) {
    console.log("Erro ao obter o token", e);
    throw e; // Lança o erro para ser capturado posteriormente
  }
}

// Função para configurar o cabeçalho do Axios com o token
async function setupAxiosHeader() {
  try {
    axios.defaults.headers.common["Riosoft-Token"] =
      await fetchTokenByUserName();
  } catch (e) {
    console.error("Erro ao configurar o token no axios", e);
  }
}

// Chama a função para buscar a lista de tickets
async function fetchTicketsList() {
  console.log("Iniciando a tarefa de envio de tickets...");
  try {
    await setupAxiosHeader(); // Configura o token primeiro
    const ticketsResponse = await axios.get(ticketsListUrl);
    const tickets = ticketsResponse.data;
    console.log("tickets recebidos", tickets.length);
    return tickets;
  } catch (e) {
    console.log(e);
  }
}

// Função para enviar e-mails com os tickets pendentes
async function sendEmail(tickets) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { ciphers: "SSLv3", rejectUnauthorized: false },
    connectionTimeout: 60000,
  });

  const dataAtualServidor = moment();

  // Calcular "dias sem interação" com base em 'ultima_log.data'
  const orderedTickets = tickets
    .map((ticket) => {
      const ultimaInteracao = ticket.DataHoraAlteracaoEstado;
      const diasSemInteracao = dataAtualServidor.diff(
        moment(ultimaInteracao),
        "days"
      );
      return {
        ...ticket,
        diasSemInteracao,
      };
    })
    .sort((a, b) => b.diasSemInteracao - a.diasSemInteracao);

  // Criar a tabela com os tickets
  const tableRows = orderedTickets
    .map(
      (ticket) => `
  <tr>
   <td>${ticket.NumeroTicket}</td>
    <td>${moment(ticket.DataHoraCadastro).format("DD/MM/YYYY")}</td>
    <td style="text-align: center;">${ticket.diasSemInteracao}</td>
    <td>${ticket.Titulo}</td>
  </tr>`
    )
    .join("");

  const totalTickets = tickets.length;

  // Montar o conteúdo do e-mail usando o layout fornecido
  const htmlContent = `
<div style="color: red;">
</div>
<br/>
<div>Olá, Marcelo, tudo bem?</div>
<br/>
<div>Os tickets listados abaixo estão pendentes de retorno por parte do fornecedor.</div>
<br/>
<h2>Tickets pendentes de retorno do fornecedor</h2>
<table border="1" cellpadding="10" cellspacing="0">
  <thead>
    <tr>
      <th>N°</th>
      <th>Data criação</th>
      <th>Dias sem retorno</th>
      <th>Assunto</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<br/>
 <div>Total de tickets: <b>${totalTickets}</b></div>
`;

  // Configurar e enviar o e-mail
  await transporter.sendMail({
    from: "cpd4@conab.com.br",
    to: "marcelo.pimentel@conab.com.br",
    cc: "atendimento.ti@conab.com.br",
    bcc: "alexsandro.santos@conab.com.br", // E-mails em cópia oculta
    subject: `Tickets pendentes de retorno do fornecedor Riosoft`,
    html: htmlContent,
  });

  console.log(`E-mail enviado`);
}

class RiosoftTicketsList {
  async executeTask() {
    try {
      const tickets = await fetchTicketsList(); // Espera pela lista de tickets
      if (tickets && tickets.length > 0) {
        await sendEmail(tickets);
      } else {
        console.log("Nenhum ticket para enviar.");
      }
    } catch (e) {
      console.error("Erro ao executar a tarefa de tickets:", e);
    }
  }
}

const riosoftTicketsList = new RiosoftTicketsList();

module.exports = riosoftTicketsList;
