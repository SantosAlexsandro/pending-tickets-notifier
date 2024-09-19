const nodemailer = require("nodemailer");

const axios = require("axios");
axios.defaults.headers.common["Authorization"] =
  "uTLcDZAvKaEavsKRJJMwxQmuCvtbU5iExCfI1kx52hAul46yDWVbumu0wLJN6dPyzXgKw7cAncjgp4jSKJ0lvaFIun6uypfiyzaCy";

const url = "https://apiintegracao.milvus.com.br/api/chamado/listagem";

class MilvusTicketsList {
  async store(req, res) {
    const tickets = await axios.post(url, req.body);
    const groupedTickets = groupByUser(tickets.data.lista);

    const firstTicket = groupedTickets["cesar.augusto@conab.com.br"][0];
    sendEmail(firstTicket.codigo);
    return res.json(groupedTickets);
  }
}

// Função para agrupar chamados por usuário
function groupByUser(tickets) {
  return tickets.reduce((acc, ticket) => {
    const { email_conferencia } = ticket;
    if (!acc[email_conferencia]) {
      acc[email_conferencia] = [];
    }

    const { codigo, assunto, motivo_pausa } = ticket;

    if (motivo_pausa === "PENDENTE CLIENTE") {
      acc[email_conferencia].push({
        codigo: codigo,
        assunto: assunto,
        motivo_pausa: motivo_pausa,
      });
    }

    return acc;
  }, {});
}

function sendEmail(groupedTickets) {
  const transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com",
    port: 587,
    auth: {
      user: "alexsandro.santos@conab.com.br",
      pass: "Al8725@",
    },
  });

  console.log(groupedTickets)

  const mailOptions = {
    from: "alexsandro.santos@conab.com.br",
    to: "web_alexsandro@hotmail.com",
    subject: "Assunto Teste",
    text: groupedTickets.toString(),
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log("E-mail enviado: " + info.response);
    }
  });
}

export default new MilvusTicketsList();
