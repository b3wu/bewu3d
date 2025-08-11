// netlify/functions/quote.js
const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    const { name, email, phone, notes, model, attachment, thumb } = body || {};

    if (!model || !model.filename) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Brak danych modelu.' }) };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const to = process.env.CONTACT_TO;
    if (!to) return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Brak CONTACT_TO w konfiguracji.' }) };

    const subject = `[Wycena] ${model.filename} (${model.material || '-'}, ${model.weightG || '-'} g, x${model.copies || 1})`;

    const lines = [
      `Imię: ${name || '-'}`,
      `E-mail: ${email || '-'}`,
      `Telefon: ${phone || '-'}`,
      ``,
      `Model:`,
      `  plik: ${model.filename} (${model.size || 0} B)`,
      `  materiał: ${model.material || '-'}`,
      `  kolory (AMS): ${model.colors || 1}`,
      `  ilość: ${model.copies || 1}`,
      `  waga: ${model.weightG || '-'} g`,
      `  czas: ${model.timeH || '-'} h`,
      `  cena/szt.: ${model.pricePerPiece != null ? model.pricePerPiece + ' PLN' : '-'}`,
      `  razem: ${model.total != null ? model.total + ' PLN' : '-'}`,
      ``,
      `Uwagi: ${notes || '-'}`,
    ];

    const mailOptions = {
      from: `"Bewu3D" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text: lines.join('\n'),
      attachments: [].concat(
        attachment && attachment.contentBase64 ? [{
          filename: attachment.filename || 'model.stl',
          content: Buffer.from(attachment.contentBase64, 'base64'),
          contentType: attachment.mimeType || 'application/octet-stream',
        }] : []
      ).concat(
        thumb && thumb.startsWith('data:image/') ? [{
          filename: 'miniatura.png',
          content: Buffer.from(thumb.split(',')[1], 'base64'),
          contentType: 'image/png',
        }] : []
      ),
    };

    const info = await transporter.sendMail(mailOptions);
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: info.messageId }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Błąd wysyłki.' }) };
  }
}
