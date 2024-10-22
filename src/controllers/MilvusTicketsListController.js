const nodemailer = require("nodemailer");

const axios = require("axios");
const moment = require("moment");
require("dotenv").config(); // Carrega variáveis de ambiente

axios.defaults.headers.common["Authorization"] = process.env.API_AUTH_KEY;

const url = "https://apiintegracao.milvus.com.br/api/chamado/listagem";

let isDev = true;

// Função para definir emails de acordo com o ambiente
const getEmails = (devEmail, prodEmails) => (isDev ? [devEmail] : prodEmails);

// Definindo os setores com seus respectivos e-mails e usuários
const setores = {
  Vendas: {
    emails: getEmails("alexsandro.santos@conab.com.br", [
      "carlos.augusto@conab.com.br",
      "alex.dutra@conab.com.br",
      "cesar.augusto@conab.com.br",
    ]),
    users: ["alex", "luis", "andrew", "cesar", "wander", "carlos"],
  },
  Astec: {
    emails: getEmails("alexsandro.santos@conab.com.br", [
      "laercio.silva@conab.com.br",
    ]),
    users: ["laercio", "renan", "joão", "ana", "fernando", "edson"],
  },
  Suprimentos: {
    emails: getEmails("alexsandro.santos@conab.com.br", [
      "fabio.moraes@conab.com.br",
    ]),
    users: ["luiz", "vinicius", "lucas"],
  },
  Financeiro: {
    emails: getEmails("alexsandro.santos@conab.com.br", [
      "fabio.moraes@conab.com.br",
    ]),
    users: ["fabio", "cintia", "andressa", "dalva"],
  },
  // Adicione mais setores conforme necessário
};

let reqBody = {
  filtro_body: {
    status: 3,
  },
};

class MilvusTicketsList {
  async executeTask() {
    console.log("INIT", "INIT");
    // Se precisar de query params
    const params = {
      total_registros: 200,
    };
    const tickets = await axios.post(url, reqBody, {
      params: params,
      headers: {
        "Content-Type": "application/json", // Isso geralmente é configurado automaticamente
      },
    });

    const groupedTickets = groupByUser(tickets.data.lista);

    // Função para normalizar o nome (remover pontos, pegar o primeiro nome e garantir formato correto)
    const normalizeUserName = (user) =>
      user.trim().split(".")[0].split(" ")[0].toLowerCase();

    // Objeto para agrupar os tickets por setor
    const setorTickets = {};

    // Itera sobre os tickets e agrupa por nome normalizado
    Object.entries(groupedTickets).forEach(([user, tickets]) => {
      const normalizedUser = normalizeUserName(user);

      // Verifica se o usuário pertence a algum setor
      Object.entries(setores).forEach(([setor, config]) => {
        if (config.users.includes(normalizedUser)) {
          if (!setorTickets[setor]) {
            setorTickets[setor] = []; // Inicializa o array se não existir
          }
          setorTickets[setor].push(...tickets);
        }
      });
    });

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Envia emails para cada setor com os tickets agrupados
    const emailPromises = Object.entries(setorTickets).map(
      async ([setor, tickets]) => {
        const { emails } = setores[setor];
        if (tickets.length > 0 && emails.length > 0) {
          console.log(
            `Enviando tickets do setor ${setor} para: ${emails.join(", ")}`
          );
          await sendEmail(setor, emails, tickets);
          await delay(2000); // Espera 2 segundos entre os envios
        }
      }
    );

    await Promise.all(emailPromises);
  }
}

// Função para agrupar chamados por usuário
function groupByUser(tickets) {
  return tickets.reduce((acc, ticket) => {
    const { contato } = ticket;
    if (!acc[contato]) {
      acc[contato] = [];
    }

    const {
      codigo,
      assunto,
      motivo_pausa,
      data_criacao,
      ultima_log: { data: ultima_log_data },
    } = ticket;

    if (motivo_pausa === "PENDENTE CLIENTE") {
      acc[contato].push({
        codigo: codigo,
        assunto: assunto,
        motivo_pausa: motivo_pausa,
        data_criacao: data_criacao,
        ultima_log_data: ultima_log_data,
        contato: contato,
      });
    }

    return acc;
  }, {});
}

function sendEmail(setor, toEmails, tickets) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true, // ativa os logs
    debug: true, // ativa o modo de depuração
  });

  const dataAtualServidor = moment();

  // Ordenar tickets pela diferença de dias sem interação
  const orderedTickets = tickets
    .map((ticket) => {
      const diasSemInteracao = dataAtualServidor.diff(
        moment(ticket.ultima_log_data || ticket.data_criacao),
        "days"
      );
      return {
        ...ticket,
        diasSemInteracao,
      };
    })

    // Filtra tickets com menos de 2 dias de interação
    .filter((ticket) => ticket.diasSemInteracao >= 2)
    .sort((a, b) => b.diasSemInteracao - a.diasSemInteracao);

  // Se não houver tickets após a filtragem, não enviar e-mail
  if (orderedTickets.length === 0) {
    console.log(
      `Nenhum ticket relevante para o setor ${setor}, e-mail não enviado.`
    );
    return;
  }

  // Criando a tabela com os dados
  const tableRows = orderedTickets
    .map((ticket) => {
      return `
      <tr>
        <td>${ticket.codigo}</td>
        <td>${moment(ticket.data_criacao).format("DD/MM/YYYY")}</td>
        <td>${ticket.diasSemInteracao}</td>
        <td>${ticket.assunto}</td>
        <td>${ticket.motivo_pausa}</td>
        <td>${ticket.contato}</td>
      </tr>
    `;
    })
    .join("");

  // Contador total de tickets
  const totalTickets = orderedTickets.length;

  const htmlContent = `
  <div  style="color: red;"><b>[Mensagem automática, por favor, não responda a esse e-mail]</b></div>
  <br/>
  <div>Olá, prezados, tudo bem? </div>
  <br/>
  <div>O(s) ticket(s) listado(s) abaixo aguarda(m) sua interação no Milvus. Sua resposta é crucial para avançarmos na resolução do(s) caso(s) ou encerrarmos o atendimento, permitindo o seguimento para outras solicitações, dúvidas e correções.</div>
  <br/>

   <h2>Ticket(s) pendente(s) de interação</h2>
  <table border="1" cellpadding="10" cellspacing="0">
    <thead>
      <tr>
        <th>N°</th>
        <th>Data Criação</th>
        <th>Dias sem interação</th>
        <th>Assunto</th>
        <th>Situação</th>
        <th>Contato</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <br/>
    <div>Total de tickets: <b>${totalTickets}</b></div> <!-- Adicionando o contador total -->
`;

  const mailOptions = {
    from: "cpd4@conab.com.br",
    to: toEmails.join(", "), // Envia para os e-mails definidos no setor
    cc: getEmails(
      "alexsandro.santos@conab.com.br",
      [
        "marcelo.pimentel@conab.com.br",
        "hamilton.bertolucci@conab.com.br",
        "8e45ff98.conabconserbombas.onmicrosoft.com@amer.teams.ms",
      ].join(", ")
    ), // Converte o array para string de e-mails separados por vírgula
    bcc: "alexsandro.santos@conab.com.br", // E-mails em cópia oculta
    subject: `Ticket(s) pendente(s) de interação para o setor ${setor}`,
    html: htmlContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(`Erro ao enviar email para setor ${setor}:`, error);
    } else {
      console.log(`E-mail enviado para setor ${setor}: ${info.response}`);
    }
  });
}

function capitalizeFirstLetter(string) {
  if (!string || typeof string !== "string") return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = new MilvusTicketsList();
