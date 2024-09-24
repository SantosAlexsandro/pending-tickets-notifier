const nodemailer = require("nodemailer");
const axios = require("axios");

axios.defaults.headers.common["Authorization"] =
  "uTLcDZAvKaEavsKRJJMwxQmuCvtbU5iExCfI1kx52hAul46yDWVbumu0wLJN6dPyzXgKw7cAncjgp4jSKJ0lvaFIun6uypfiyzaCy";

const url = "https://apiintegracao.milvus.com.br/api/chamado/listagem";

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
        // Aqui você pode chamar sua função de envio de email
        sendEmail(user, tickets);
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

    const { codigo, assunto, motivo_pausa } = ticket;

    if (motivo_pausa === "PENDENTE CLIENTE") {
      acc[contato].push({
        codigo: codigo,
        assunto: assunto,
        motivo_pausa: motivo_pausa,
      });
    }

    return acc;
  }, {});
}

function sendEmail(user, tickets) {
  if (user !== "alex") {
    return;
  }

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

  // console.log(groupedTickets);

  // Criando a tabela com os dados
  const tableRows = tickets
    .map((ticket) => {
      return `
      <tr>
        <td>${ticket.codigo}</td>
        <td>${ticket.assunto}</td>
        <td>${ticket.motivo_pausa}</td>
      </tr>
    `;
    })
    .join(""); // .join('') para juntar todas as linhas da tabela em uma string única

  const htmlContent = `
  <div  style="color: red;"><b>[Mensagem automática, por favor, não responda a esse e-mail]</b></div>
  <br/>
  <div>Olá, ${capitalizeFirstLetter(user)}, tudo bem? </div>
  <br/>
  <div>Os tickets listados abaixo aguardam sua interação no Milvus. Sua resposta é crucial para avançarmos na resolução dos casos ou encerrarmos o atendimento, permitindo o seguimento para outras solicitações, dúvidas e correções.</div>
  <br/>

   <h2>Chamados pendentes de interação</h2>
  <table border="1" cellpadding="10" cellspacing="0">
    <thead>
      <tr>
        <th>N°</th>
        <th>Assunto</th>
        <th>Situação</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
`;

  const mailOptions = {
    from: "alexsandro.santos@conab.com.br",
    to: "web_alexsandro@hotmail.com",
    subject: "Chamados pendentes de interação [Mensagem automática]",
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
