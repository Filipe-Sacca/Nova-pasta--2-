import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, QrCode, Download, Eye } from "lucide-react";

const QrCodeGenerator = () => {
  const [merchantId, setMerchantId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const generateQrCode = useCallback(async () => {
    console.log('🎯 QR Code Generator - Iniciando função generateQrCode');
    console.log('📦 Merchant ID:', merchantId);

    if (!merchantId.trim()) {
      console.log('❌ Erro: Merchant ID vazio');
      setError('Por favor, insira o Merchant ID');
      return;
    }

    console.log('⚡ Iniciando requisição...');
    setIsLoading(true);
    setError('');
    setSuccess('');
    setQrCodeData(null);
    setQrCodeImageUrl('');

    try {
      // Detectar a URL base automaticamente
      const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8093' : 'http://5.161.109.157:8093';
      const apiUrl = `${baseUrl}/merchants/checkin-qrcode`;

      console.log('🔄 Fazendo fetch para:', apiUrl);
      console.log('🌐 Hostname atual:', window.location.hostname);
      console.log('🌐 URL base detectada:', baseUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: merchantId.trim()
        })
      });

      console.log('📥 Resposta recebida, status:', response.status);
      const data = await response.json();
      console.log('📊 Dados da resposta:', data);

      if (data.success) {
        setQrCodeData(data);

        // Criar URL do PDF para visualização
        if (data.qrCodeData && data.dataType === 'pdf') {
          const pdfBlob = new Blob([
            Uint8Array.from(atob(data.qrCodeData), c => c.charCodeAt(0))
          ], { type: 'application/pdf' });
          const pdfUrl = URL.createObjectURL(pdfBlob);
          setQrCodeImageUrl(pdfUrl);
        }

        setSuccess('QR Code gerado com sucesso!');
        console.log('✅ QR Code gerado com sucesso!', data);
      } else {
        console.log('❌ Erro na resposta:', data);
        setError(data.error || 'Erro ao gerar QR Code');
      }
    } catch (err: any) {
      console.log('🚨 Erro na requisição:', err);
      setError('Erro de conexão: ' + err.message);
      console.error('Erro ao gerar QR Code:', err);
    } finally {
      console.log('🏁 Finalizando requisição...');
      setIsLoading(false);
    }
  }, [merchantId]);

  const downloadQrCode = useCallback(() => {
    if (!qrCodeData?.qrCodeData) return;

    try {
      const filename = qrCodeData.filename || `qrcode-${merchantId}-${Date.now()}.pdf`;

      if (typeof qrCodeData.qrCodeData === 'string' && qrCodeData.dataType === 'pdf') {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${qrCodeData.qrCodeData}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccess('QR Code PDF baixado com sucesso!');
      } else {
        const jsonData = JSON.stringify(qrCodeData.qrCodeData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qrcode-debug-${merchantId}-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Erro ao baixar QR Code:', err);
      setError('Erro ao baixar o arquivo');
    }
  }, [qrCodeData, merchantId]);

  // Memoizar o estado do botão para melhor performance
  const isButtonDisabled = useMemo(() => {
    return isLoading || !merchantId.trim();
  }, [isLoading, merchantId]);

  // Limpeza de URLs para evitar vazamentos de memória
  useEffect(() => {
    return () => {
      if (qrCodeImageUrl) {
        URL.revokeObjectURL(qrCodeImageUrl);
      }
    };
  }, [qrCodeImageUrl]);

  return (
    <div className="space-y-6 pt-16 mt-6">
      <Card>
        <CardHeader className="pb-6 pt-8">
          <CardTitle className="flex items-center gap-2 text-xl mb-4">
            <QrCode className="h-6 w-6" />
            Gerador de QR Code de Check-in
          </CardTitle>
          <CardDescription className="mt-4 text-base">
            Gere QR codes para check-in de entregadores no iFood.
            Insira o Merchant ID para gerar o código.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-4 pb-8">
          <div className="space-y-4 py-4">
            <Label htmlFor="merchantId" className="text-base font-medium">Merchant ID</Label>
            <Input
              id="merchantId"
              placeholder="Ex: 577cb3b1-5845-4fbc-a219-8cd3939cb9ea"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              disabled={isLoading}
              className="h-12 text-base"
            />
          </div>

          <Button
            onClick={() => {
              console.log('🔘 Botão clicado! Merchant ID:', merchantId, 'Disabled:', isButtonDisabled);
              generateQrCode();
            }}
            disabled={isButtonDisabled}
            className="w-full h-12 text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                Gerar QR Code
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription className="text-green-600">{success}</AlertDescription>
            </Alert>
          )}

          {qrCodeData && (
            <Card className="bg-gray-50 mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  QR Code Gerado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Visualizador do QR Code */}
                {qrCodeImageUrl && qrCodeData.dataType === 'pdf' && (
                  <div className="bg-white p-4 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
                        <QrCode className="h-4 w-4" />
                        Visualização do QR Code
                      </div>
                      <div className="bg-white rounded border shadow-sm overflow-hidden">
                        <iframe
                          src={qrCodeImageUrl}
                          width="100%"
                          height="400"
                          title="QR Code PDF"
                          className="border-0"
                          style={{ minHeight: '400px' }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        ✅ QR Code carregado e pronto para uso
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-sm space-y-1">
                  <p><strong>Merchant ID:</strong> {qrCodeData.merchantId}</p>
                  <p><strong>Data/Hora:</strong> {new Date(qrCodeData.timestamp).toLocaleString('pt-BR')}</p>
                  <p><strong>Tipo:</strong> {qrCodeData.dataType === 'pdf' ? 'PDF com QR Code' : typeof qrCodeData.qrCodeData}</p>
                  {qrCodeData.filename && (
                    <p><strong>Arquivo:</strong> {qrCodeData.filename}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={downloadQrCode}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PDF
                  </Button>
                  {qrCodeImageUrl && (
                    <Button
                      onClick={() => window.open(qrCodeImageUrl, '_blank')}
                      variant="secondary"
                      className="flex-1"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Abrir em Nova Aba
                    </Button>
                  )}
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    Ver informações técnicas
                  </summary>
                  <div className="mt-2 p-2 bg-gray-200 rounded text-xs space-y-1 text-gray-800">
                    <p><strong>Tamanho base64:</strong> {qrCodeData.qrCodeData?.length || 0} caracteres</p>
                    <p><strong>Content Type:</strong> {qrCodeData.contentType || 'N/A'}</p>
                    <p><strong>Status API:</strong> {qrCodeData.success ? 'Sucesso' : 'Erro'}</p>
                    {qrCodeData.dataType === 'pdf' && (
                      <p className="text-green-600"><strong>Formato:</strong> PDF válido pronto para download</p>
                    )}
                  </div>
                </details>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-sm text-blue-800">ℹ️ Como usar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <p><strong>1.</strong> Insira o Merchant ID da loja no campo acima</p>
          <p><strong>2.</strong> Clique em "Gerar QR Code" para solicitar à API do iFood</p>
          <p><strong>3.</strong> O sistema irá retornar os dados do QR code para check-in</p>
          <p><strong>4.</strong> Use o botão "Baixar" para salvar o arquivo gerado</p>
          <p className="text-xs mt-2 text-gray-600">
            <strong>Nota:</strong> Este endpoint gera um PDF com QR code para check-in de entregadores conforme especificação do iFood.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QrCodeGenerator;