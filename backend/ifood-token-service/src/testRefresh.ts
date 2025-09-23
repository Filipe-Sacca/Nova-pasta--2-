import dotenv from 'dotenv';
import { IFoodTokenRefreshService } from './tokenRefreshService';

// Load environment variables
dotenv.config();

async function testRefreshService() {
  console.log('🧪 TESTE DO SERVIÇO DE RENOVAÇÃO DE TOKENS iFood');
  console.log('=' .repeat(60));
  console.log('');

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Environment variables not configured');
    console.error('Please check your .env file');
    process.exit(1);
  }

  console.log('✅ Environment configured:');
  console.log(`  - Supabase URL: ${supabaseUrl}`);
  console.log(`  - Supabase Key: ${'*'.repeat(10)}${supabaseKey.slice(-10)}`);
  console.log('');

  try {
    // Initialize service
    const service = new IFoodTokenRefreshService(supabaseUrl, supabaseKey);

    // Test 1: Get all tokens
    console.log('📊 TESTE 1: Buscando tokens no banco de dados...');
    const tokens = await service.getAllTokens();

    if (tokens.length === 0) {
      console.log('📭 Nenhum token encontrado no banco de dados');
      console.log('💡 Execute o serviço de criação de tokens primeiro');
      process.exit(1);
    }

    console.log(`✅ Encontrados ${tokens.length} tokens:`);
    tokens.forEach((token, index) => {
      console.log(`  ${index + 1}. Client ID: ${token.client_id.substring(0, 8)}...`);
      console.log(`     User ID: ${token.user_id}`);
      console.log(`     Expires at: ${token.expires_at}`);
    });
    console.log('');

    // Test 2: Refresh tokens
    console.log('🔄 TESTE 2: Executando renovação de todos os tokens...');
    const stats = await service.refreshAllTokens();

    console.log('\n📈 RESULTADOS:');
    console.log(`  Total de tokens: ${stats.total}`);
    console.log(`  Renovações bem-sucedidas: ${stats.successful}`);
    console.log(`  Falhas: ${stats.failed}`);
    console.log(`  Taxa de sucesso: ${(stats.successful / stats.total * 100).toFixed(1)}%`);

    if (stats.successful > 0) {
      console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
      console.log('O serviço de renovação está funcionando corretamente');
    } else {
      console.log('\n⚠️ TESTE CONCLUÍDO COM PROBLEMAS');
      console.log('Verifique os logs para mais detalhes');
    }

    // Show schedule info
    console.log('\n📅 INFORMAÇÕES DO AGENDAMENTO:');
    console.log('  - Frequência: A cada 2 horas');
    console.log('  - Horário: No minuto 50 (xx:50)');
    console.log('  - Próximas execuções:');
    console.log('    - 00:50, 02:50, 04:50, 06:50...');
    console.log('    - 08:50, 10:50, 12:50, 14:50...');
    console.log('    - 16:50, 18:50, 20:50, 22:50...');
    console.log('');
    console.log('🎯 Para executar o serviço continuamente:');
    console.log('  npm run refresh');

  } catch (error: any) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    process.exit(1);
  }
}

// Run the test
testRefreshService();