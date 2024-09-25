const nodemailer = require("nodemailer");
const axios = require("axios");
const moment = require("moment");

axios.defaults.headers.common["Authorization"] =
  "uTLcDZAvKaEavsKRJJMwxQmuCvtbU5iExCfI1kx52hAul46yDWVbumu0wLJN6dPyzXgKw7cAncjgp4jSKJ0lvaFIun6uypfiyzaCy";

const url = "https://apiintegracao.milvus.com.br/api/chamado/listagem";

// Lista de usuários e seus respectivos e-mails
const userEmails = {
  fabio: "alexsandro.santos@conab.com.br",
  //ana: "ana@exemplo.com",
  //carlos: "carlos@exemplo.com",
};

class MilvusTicketsList {
  async store(req, res) {
    // Se precisar de query params
    const params = {
      total_registros: 200,
    };

    const tickets = await axios.post(url, req.body, {
      params: params,
    });
    const groupedTickets = groupByUser(tickets.data.lista);

    // Função para normalizar o nome (remover pontos, pegar o primeiro nome e garantir formato correto)
    const normalizeUserName = (user) =>
      user.trim().split(".")[0].split(" ")[0].toLowerCase();

    // Objeto para agrupar os tickets por usuário normalizado
    const normalizedGroupedTickets = {};

    // Itera sobre os tickets e agrupa por nome normalizado
    Object.entries(groupedTickets).forEach(([user, tickets]) => {
      // Divide usuários por vírgulas, caso existam múltiplos
      const usersArray = user.split(",");

      usersArray.forEach((singleUser) => {
        const normalizedUser = normalizeUserName(singleUser); // Normaliza o nome do usuário

        if (!normalizedGroupedTickets[normalizedUser]) {
          normalizedGroupedTickets[normalizedUser] = []; // Inicializa o array se não existir
        }

        // Adiciona os tickets ao grupo do usuário normalizado
        normalizedGroupedTickets[normalizedUser].push(...tickets);
      });
    });

    // Exemplo de como enviar emails com os tickets normalizados
    Object.entries(normalizedGroupedTickets).forEach(([user, tickets]) => {
      if (tickets.length > 0) {
        console.log(`Enviando email para ${user} com os tickets:`, tickets);

        // Chama a função de envio de e-mail passando o e-mail correspondente ao usuário
        const userEmail = userEmails[user];
        if (userEmail) {
          sendEmail(user, userEmail, tickets); // Agora envia para o e-mail do usuário
        }
      }
    });

    return res.json(groupedTickets);
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
        ultima_log_data: ultima_log_data, // Melhor manter o nome mais descritivo
      });
    }

    return acc;
  }, {});
}

function sendEmail(user, toEmail, tickets) {
  const transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com",
    port: 587,
    auth: {
      user: "alexsandro.santos@conab.com.br",
      pass: "Al8725@",
    },
    //tls: {
    //rejectUnauthorized: false
    //}
  });

  const dataAtualServidor = moment();

  // Ordenar tickets pela diferença de dias sem interação (do maior para o menor)
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
    .sort((a, b) => b.diasSemInteracao - a.diasSemInteracao); // Ordenação decrescente

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
      </tr>
    `;
    })
    .join(""); // .join('') para juntar todas as linhas da tabela em uma string única

  // Contador total de tickets
  const totalTickets = orderedTickets.length;

  const htmlContent = `
  <div  style="color: red;"><b>[Mensagem automática, por favor, não responda a esse e-mail]</b></div>
  <br/>
  <div>Olá, <b>${capitalizeFirstLetter(user)} </b>, tudo bem? </div>
  <br/>
  <div>Os tickets listados abaixo aguardam sua interação no Milvus. Sua resposta é crucial para avançarmos na resolução dos casos ou encerrarmos o atendimento, permitindo o seguimento para outras solicitações, dúvidas e correções.</div>
  <br/>

   <h2>Tickets pendentes de interação</h2>
  <table border="1" cellpadding="10" cellspacing="0">
    <thead>
      <tr>
        <th>N°</th>
        <th>Data Criação</th>
        <th>Dias sem interação</th>
        <th>Assunto</th>
        <th>Situação</th>
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
    from: "alexsandro.santos@conab.com.br",
    to: toEmail, // Usa o e-mail passado como parâmetro
    subject: "Tickets pendentes de interação [Mensagem automática]",
    html: htmlContent, // Corpo do e-mail com HTML (tabela)
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log("E-mail enviado: " + info.response);
    }
  });
}

function capitalizeFirstLetter(string) {
  if (!string || typeof string !== "string") return ""; // Verifica se é uma string válida
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export default new MilvusTicketsList();
