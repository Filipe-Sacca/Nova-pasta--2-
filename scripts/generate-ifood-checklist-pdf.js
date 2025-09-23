const fs = require('fs');
const path = require('path');

// Lê o arquivo markdown
const markdownContent = fs.readFileSync('Checklist_IfoodHub.md', 'utf8');

// Converte markdown para HTML com formatação melhorada
function markdownToHtml(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Code inline
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Lists with checkboxes
    html = html.replace(/^\s*- \[x\] (.*?)$/gm, '<li class="checked">✅ $1</li>');
    html = html.replace(/^\s*- \[ \] (.*?)$/gm, '<li class="unchecked">❌ $1</li>');
    html = html.replace(/^\s*- (.*?)$/gm, '<li>$1</li>');
    
    // Tables - simples conversão
    html = html.replace(/\|/g, ' | ');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>\n');
    
    // Emojis já funcionam em HTML
    
    return html;
}

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Checklist de Homologação iFood Hub</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        h1 {
            color: #d32f2f;
            border-bottom: 3px solid #d32f2f;
            padding-bottom: 10px;
            margin-bottom: 30px;
            font-size: 28px;
        }
        
        h2 {
            color: #1976d2;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 8px;
            margin-top: 30px;
            margin-bottom: 20px;
            font-size: 22px;
        }
        
        h3 {
            color: #388e3c;
            margin-top: 20px;
            margin-bottom: 15px;
            font-size: 18px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        table th {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #555;
        }
        
        table td {
            border: 1px solid #ddd;
            padding: 10px;
            background: white;
        }
        
        table tr:nth-child(even) td {
            background-color: #fafafa;
        }
        
        .checked {
            color: #2e7d32;
            list-style: none;
            margin: 5px 0;
            padding-left: 25px;
        }
        
        .unchecked {
            color: #c62828;
            list-style: none;
            margin: 5px 0;
            padding-left: 25px;
        }
        
        li {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        code {
            background-color: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #d32f2f;
        }
        
        strong {
            color: #1976d2;
            font-weight: 600;
        }
        
        .status-complete {
            background-color: #c8e6c9;
            color: #1b5e20;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        
        .status-partial {
            background-color: #fff3e0;
            color: #e65100;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        
        .status-pending {
            background-color: #ffebee;
            color: #c62828;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        
        .summary-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .summary-box h2 {
            color: white;
            border-bottom: 2px solid rgba(255,255,255,0.3);
        }
        
        .progress-bar {
            background-color: rgba(255,255,255,0.2);
            border-radius: 10px;
            overflow: hidden;
            height: 30px;
            margin: 15px 0;
        }
        
        .progress-fill {
            background: linear-gradient(90deg, #4caf50, #8bc34a);
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 0.3s ease;
        }
        
        .module-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .module-card h3 {
            margin-top: 0;
        }
        
        .critical-gap {
            background-color: #ffebee;
            border-left: 4px solid #f44336;
            padding: 10px 15px;
            margin: 15px 0;
        }
        
        .success-feature {
            background-color: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 10px 15px;
            margin: 15px 0;
        }
        
        @media print {
            body {
                font-size: 11pt;
            }
            
            h1 { page-break-after: avoid; }
            h2 { page-break-after: avoid; }
            h3 { page-break-after: avoid; }
            
            .module-card {
                page-break-inside: avoid;
            }
            
            table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="summary-box">
        <h1 style="color: white; border-bottom: 2px solid rgba(255,255,255,0.3);">📊 Checklist de Homologação iFood Hub</h1>
        <p style="font-size: 18px;">Status Geral de Implementação</p>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 70.2%;">70.2% Completo (33/47 critérios)</div>
        </div>
        <p>Data de Geração: ${new Date().toLocaleDateString('pt-BR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</p>
    </div>
    
    ${markdownToHtml(markdownContent)}
    
    <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center; color: #666;">
        <p>Documento gerado automaticamente pelo sistema de homologação iFood Hub</p>
        <p>© 2025 - Plano Certo Hub Insights</p>
    </div>
</body>
</html>`;

// Salva o HTML
fs.writeFileSync('Checklist_IfoodHub.html', htmlContent, 'utf8');

console.log('✅ Arquivo HTML gerado: Checklist_IfoodHub.html');
console.log('📄 Para converter em PDF:');
console.log('   1. Abra o arquivo HTML no navegador');
console.log('   2. Pressione Ctrl+P (ou Cmd+P no Mac)');
console.log('   3. Selecione "Salvar como PDF"');
console.log('   4. Configure as margens e orientação conforme necessário');
console.log('   5. Clique em "Salvar"');
console.log('\n💡 Dica: O arquivo já está formatado para impressão A4 com margens adequadas!');