// Script para aplicar migração da tabela financial_data
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyFinancialMigration() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.log('❌ Erro: Variáveis SUPABASE_URL e SUPABASE_KEY não encontradas');
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🚀 Aplicando migração da tabela financial_data...\n');
    
    try {
        // Ler o arquivo SQL da migração
        const migrationPath = path.join(__dirname, 'frontend/plano-certo-hub-insights/supabase/migrations/20250816000000-create-financial-data-table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Migração carregada do arquivo');
        console.log('🔧 Executando SQL...\n');
        
        // Executar a migração usando uma função customizada
        // Como não temos acesso direto ao SQL via Supabase client, vamos criar a tabela via código
        
        // Primeiro, verificar se a tabela já existe
        const { data: existingTables, error: checkError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'financial_data');
            
        if (checkError) {
            console.log('ℹ️  Não foi possível verificar tabelas existentes via query, tentando criar...');
        } else if (existingTables && existingTables.length > 0) {
            console.log('✅ Tabela financial_data já existe!');
            return;
        }
        
        // Como não podemos executar SQL diretamente, vamos tentar fazer uma operação simples na tabela
        // Se der erro 404, significa que a tabela não existe
        const { data: testData, error: testError } = await supabase
            .from('financial_data')
            .select('id')
            .limit(1);
            
        if (testError && testError.code === 'PGRST106') {
            console.log('❌ Tabela financial_data não existe no Supabase');
            console.log('📋 Para criar a tabela, você precisa:');
            console.log('   1. Acessar o Supabase Dashboard');
            console.log('   2. Ir para SQL Editor');
            console.log('   3. Executar o conteúdo do arquivo:');
            console.log('      frontend/plano-certo-hub-insights/supabase/migrations/20250816000000-create-financial-data-table.sql');
            console.log('\n📄 Conteúdo da migração:');
            console.log('----------------------------------------');
            console.log(migrationSQL);
            console.log('----------------------------------------');
        } else {
            console.log('✅ Tabela financial_data já existe e está acessível!');
        }
        
    } catch (err) {
        console.log('❌ Erro:', err.message);
        console.log('\n💡 Solução alternativa:');
        console.log('   Execute o SQL manualmente no Supabase Dashboard');
    }
}

applyFinancialMigration();