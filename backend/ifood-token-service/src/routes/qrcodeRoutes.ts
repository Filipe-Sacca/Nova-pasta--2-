import express from 'express';
import axios from 'axios';
import { getAnyAvailableToken } from '../ifoodTokenService';

const router = express.Router();

// POST /merchants/checkin-qrcode - Gerar QR code de check-in para entregador
router.post('/merchants/checkin-qrcode', async (req, res) => {
  try {
    const { merchantId } = req.body;

    console.log('🔗 QR CODE - Gerando QR code de check-in para merchant:', merchantId);

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'merchantId é obrigatório no body da requisição'
      });
    }

    // Buscar token de acesso
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(401).json({
        success: false,
        error: 'Nenhum token de acesso encontrado'
      });
    }

    console.log('🔑 QR CODE - Usando token disponível:', tokenInfo.user_id);

    // Chamar API do iFood para gerar QR code
    const ifoodUrl = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/checkin-qrcode`;

    console.log('📤 QR CODE - Fazendo requisição para iFood API:', ifoodUrl);
    console.log('📦 QR CODE - Body:', { merchantIds: [merchantId] });

    const response = await axios.post(ifoodUrl, {
      merchantIds: [merchantId] // Array com merchantId conforme API do iFood
    }, {
      headers: {
        'accept': 'application/pdf', // Aceitar PDF conforme sua requisição que funcionou
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenInfo.access_token}`
      },
      responseType: 'arraybuffer', // Receber como buffer binário
      timeout: 30000 // 30 segundos
    });

    console.log('✅ QR CODE - Resposta da API iFood:', response.status);
    console.log('📥 QR CODE - Dados recebidos:', typeof response.data);
    console.log('📄 QR CODE - Tamanho do PDF:', response.data.byteLength, 'bytes');

    // Converter o buffer do PDF para base64
    const pdfBuffer = Buffer.from(response.data);
    const pdfBase64 = pdfBuffer.toString('base64');

    console.log('✅ QR CODE - PDF convertido para base64, tamanho:', pdfBase64.length, 'chars');

    res.json({
      success: true,
      merchantId: merchantId,
      qrCodeData: pdfBase64,
      dataType: 'pdf',
      contentType: 'application/pdf',
      filename: `qrcode-${merchantId}-${Date.now()}.pdf`,
      message: 'QR code de check-in gerado com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ QR CODE - Erro ao gerar QR code:', error.response?.data || error.message);

    let errorMessage = 'Erro interno do servidor';
    let statusCode = 500;

    if (error.response?.status === 400) {
      errorMessage = 'Dados inválidos para gerar QR code';
      statusCode = 400;
    } else if (error.response?.status === 401) {
      errorMessage = 'Token de acesso inválido';
      statusCode = 401;
    } else if (error.response?.status === 404) {
      errorMessage = 'Merchant não encontrado';
      statusCode = 404;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout na requisição para iFood API';
      statusCode = 408;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.response?.data?.message || error.message
    });
  }
});

export default router;