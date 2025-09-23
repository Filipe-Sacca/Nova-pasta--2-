require('dotenv').config({ path: './services/ifood-token-service/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkOpeningHours() {
  console.log('Verificando opening hours no banco...\n');
  
  const { data, error } = await supabase
    .from('ifood_merchants')
    .select('merchant_id, name, operating_hours')
    .limit(5);
  
  if (error) {
    console.error('Erro:', error.message);
    return;
  }
  
  console.log(`Total merchants: ${data.length}\n`);
  
  data.forEach(merchant => {
    console.log(`Merchant: ${merchant.merchant_id}`);
    console.log(`Nome: ${merchant.name}`);
    
    if (merchant.operating_hours) {
      console.log('✅ Operating hours ENCONTRADO:');
      
      if (merchant.operating_hours.shifts) {
        console.log(`   Shifts: ${merchant.operating_hours.shifts.length} dias`);
        merchant.operating_hours.shifts.forEach(shift => {
          console.log(`   - ${shift.dayOfWeek}: ${shift.start} (ID: ${shift.id?.substring(0,8)}...)`);
        });
      }
      
      if (merchant.operating_hours.by_day) {
        console.log(`   Mapa by_day: ${Object.keys(merchant.operating_hours.by_day).length} dias`);
      }
      
      console.log(`   Ultima atualizacao: ${merchant.operating_hours.last_updated || 'N/A'}`);
    } else {
      console.log('❌ SEM operating hours');
    }
    console.log('');
  });
}

checkOpeningHours().catch(console.error);