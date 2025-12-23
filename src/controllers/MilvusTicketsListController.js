const nodemailer = require('nodemailer');
const axios = require('axios');
const moment = require('moment');
require('dotenv').config();

axios.defaults.headers.common['Authorization'] = process.env.API_AUTH_KEY;
const url = 'https://apiintegracao.milvus.com.br/api/chamado/listagem';

let isDev = false;

// Função para definir e-mails de acordo com o ambiente
const getEmails = (devEmail, prodEmails) => (isDev ? [devEmail] : prodEmails);

// Configuração dos setores com seus respectivos e-mails
const setores = {
  VENDAS: {
    emails: getEmails('alexsandro.santos@conab.com.br', [
      'alex.dutra@conab.com.br'
    ]),
  },
  ASTEC: {
    emails: getEmails('alexsandro.santos@conab.com.br', [
      'laercio.silva@conab.com.br',
    ]),
  },
  SUPRIMENTOS: {
    emails: getEmails('alexsandro.santos@conab.com.br', [
      'setor_compras@conab.com.br',
    ]),
  },
  'FISCAL / FINANCEIRO': {
    emails: getEmails('alexsandro.santos@conab.com.br', [
      'setor_financeiro@conab.com.br',
    ]),
  },
};

// Parâmetros para consulta de tickets
let reqBody = { filtro_body: { status: 3 } };

// Classe principal para gerenciar a execução da tarefa
class MilvusTicketsList {
  async executeTask() {
    console.log('Iniciando a tarefa de envio de tickets...');
    const params = { total_registros: 200 };

    try {
      const ticketsResponse = await axios.post(url, reqBody, { params });
      const tickets = ticketsResponse.data.lista;

      // Filtrar apenas tickets com motivo 'PENDENTE CLIENTE'
      const filteredTickets = tickets.filter(
        (ticket) => ticket.motivo_pausa === 'PENDENTE CLIENTE'
      );

      // Agrupar tickets por setor
      const setorTickets = this.groupTicketsBySetor(filteredTickets);

      // Enviar e-mails para cada setor com os tickets agrupados
      async function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      // Adicionar delay entre envios
      for (const [setor, tickets] of Object.entries(setorTickets)) {
        const { emails } = setores[setor] || {};
        if (tickets.length > 0 && emails && emails.length > 0) {
          console.log(
            `Enviando tickets do setor ${setor} para: ${emails.join(', ')}`
          );
          await sendEmail(setor, emails, tickets);
          await delay(15000); // Aguarda 15 segundos entre cada envio
        }
      }

      await Promise.allSettled(emailPromises);
    } catch (error) {
      console.error('Erro ao obter tickets:', error.message);
    }
  }

  // Função para agrupar tickets pelo campo 'setor'
  groupTicketsBySetor(tickets) {
    return tickets.reduce((acc, ticket) => {
      const { setor } = ticket;
      if (!setor) return acc;

      const normalizedSetor = setor.toUpperCase();
      if (!acc[normalizedSetor]) acc[normalizedSetor] = [];
      acc[normalizedSetor].push(ticket);

      return acc;
    }, {});
  }
}

// Função para enviar e-mails com os tickets pendentes
async function sendEmail(setor, toEmails, tickets) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true, // Valida certificados
      },
      pool: true, // Habilita o uso de pool de conexões
      maxConnections: 3, // Limita a 3 conexões simultâneas
      maxMessages: 100, // Limite de mensagens por conexão
    });

    const dataAtualServidor = moment();

    // Calcular "dias sem interação" com base em 'ultima_log.data'
    const orderedTickets = tickets
      .map((ticket) => {
        const ultimaInteracao = ticket.ultima_log?.data || ticket.data_criacao;
        const diasSemInteracao = dataAtualServidor.diff(
          moment(ultimaInteracao),
          'days'
        );
        return {
          ...ticket,
          diasSemInteracao,
        };
      })
      .sort((a, b) => b.diasSemInteracao - a.diasSemInteracao);

    if (orderedTickets.length === 0) {
      console.log(
        `Nenhum ticket relevante para o setor ${setor}, e-mail não enviado.`
      );
      return;
    }

    // Criar a tabela com os tickets
    const tableRows = orderedTickets
      .map(
        (ticket) => `
      <tr>
        <td>${ticket.codigo}</td>
        <td>${moment(ticket.data_criacao).format('DD/MM/YYYY')}</td>
        <td style="text-align: center;">${
          ticket.diasSemInteracao
        }</td> <!-- Centralizar esta coluna -->
        <td>${ticket.assunto}</td>
        <td>${ticket.motivo_pausa}</td>
        <td>${ticket.contato}</td>
      </tr>`
      )
      .join('');

    const totalTickets = orderedTickets.length;

    // Montar o conteúdo do e-mail usando o layout fornecido
    const htmlContent = `
    <div style="color: red;">
      <b>[Mensagem automática, por favor, não responda a esse e-mail]</b>
    </div>
    <br/>
    <div>Olá, prezados, tudo bem?</div>
    <br/>
    <div>O(s) ticket(s) listado(s) abaixo aguarda(m) sua interação no Milvus.
    Sua resposta é crucial para avançarmos na resolução do(s) caso(s) ou encerrarmos o atendimento,
    permitindo o seguimento para outras solicitações, dúvidas e correções.</div>
    <br/>
    <h2>Ticket(s) pendente(s) de interação</h2>
    <table border="1" cellpadding="10" cellspacing="0">
      <thead>
        <tr>
          <th>N°</th>
          <th>Data Criação</th>
          <th>Dias sem Interação</th>
          <th>Assunto</th>
          <th>Situação</th>
          <th>Contato</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <br/>
    <div>Total de tickets: <b>${totalTickets}</b></div>
  `;

    // Configurar e enviar o e-mail
    await transporter.sendMail({
      from: 'no-reply@conab.com.br',
      to: toEmails.join(', '),
      cc: getEmails(
        'alexsandro.santos@conab.com.br',
        [
          'marcelo.pimentel@conab.com.br',
          'hamilton.bertolucci@conab.com.br',
          '8e45ff98.conabconserbombas.onmicrosoft.com@amer.teams.ms',
        ].join(', ')
      ), // Converte o array para string de e-mails separados por vírgula
      bcc: ['adriano.santos@conab.com.br', 'alexsandro.santos@conab.com.br', 'fred.pereira@conab.com.br'].join(', '), // E-mails em cópia oculta
      subject: `Ticket(s) pendente(s) de interação para o setor ${setor}`,
      html: htmlContent,
    });

    console.log(`E-mail enviado para o setor ${setor}`);
  } catch (error) {
    console.error(
      `Erro ao enviar e-mail para o setor ${setor}: ${error.message}`
    );
  }
}

// Executar a tarefa
const milvusTicketsList = new MilvusTicketsList();
// milvusTicketsList.executeTask();

module.exports = milvusTicketsList;
