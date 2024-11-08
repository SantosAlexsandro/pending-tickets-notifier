import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false, // Defina como true se estiver usando SSL/TLS (porta 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false, // Ignora erros de certificado (use com cuidado)
  },
  connectionTimeout: 60000, // 60 segundos
  logger: false, // Desativa logs
  debug: false, // Desativa o modo de depuração
});

// Exporta o transporter para ser usado em outros arquivos
export default transporter;
