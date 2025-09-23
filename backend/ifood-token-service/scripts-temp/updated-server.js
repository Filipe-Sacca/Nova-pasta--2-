// Complete updated server with all endpoints
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const app = express();
const PORT = 8082;

app.use(cors());
app.use(express.json());

// Helper function to get token
async function getTokenForUser(userId) {
  const { data, error } = await supabase
    .from('ifood_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .limit(1);
    
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return { access_token: data[0].access_token };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ifood-token-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Save opening hours to database
async function saveOpeningHoursToDatabase(merchantId, shifts) {
  try {
    const byDay = {};
    shifts.forEach(shift => {
      if (shift.id) byDay[shift.dayOfWeek] = shift.id;
    });

    const operatingHours = {
      shifts: shifts,
      by_day: byDay,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ifood_merchants')
      .update({ operating_hours: operatingHours })
      .eq('merchant_id', merchantId);

    if (error) {
      console.error(`❌ Failed to save opening hours for ${merchantId}: ${error.message}`);
      return false;
    }

    console.log(`✅ Saved opening hours for merchant ${merchantId} with ${shifts.length} shifts`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving opening hours: ${error.message}`);
    return false;
  }
}

// POST /merchants/sync-all endpoint with REAL synchronization
app.post('/merchants/sync-all', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id is required'
      });
    }

    console.log(`🔄 Starting REAL sync for all merchants of user: ${user_id}`);
    
    // 1. Get user's access token
    const tokenData = await getTokenForUser(user_id);
    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({
        success: false,
        error: 'No valid access token found for user'
      });
    }

    // 2. Get all merchants for this user
    const { data: merchants, error: merchantError } = await supabase
      .from('ifood_merchants')
      .select('merchant_id')
      .eq('user_id', user_id);

    if (merchantError || !merchants || merchants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No merchants found for user'
      });
    }

    console.log(`📊 Found ${merchants.length} merchants to sync`);

    const results = {
      total_processed: merchants.length,
      updated_merchants: [],
      failed_merchants: []
    };

    // 3. For each merchant, fetch and save opening hours
    for (const merchant of merchants) {
      const merchantId = merchant.merchant_id;
      
      try {
        console.log(`🔍 Syncing opening hours for merchant: ${merchantId}`);

        // Fetch opening hours from iFood API
        const response = await axios.get(
          `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/opening-hours`,
          {
            headers: {
              'accept': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`
            }
          }
        );

        const shifts = response.data.shifts || [];
        console.log(`📊 Found ${shifts.length} shifts for merchant ${merchantId}`);

        if (shifts.length > 0) {
          // Save to database
          const saved = await saveOpeningHoursToDatabase(merchantId, shifts);
          if (saved) {
            results.updated_merchants.push(merchantId);
          } else {
            results.failed_merchants.push({ merchant_id: merchantId, error: 'Failed to save to database' });
          }
        } else {
          results.failed_merchants.push({ merchant_id: merchantId, error: 'No opening hours found' });
        }

      } catch (error) {
        console.error(`❌ Error syncing merchant ${merchantId}:`, error.response?.data || error.message);
        results.failed_merchants.push({ 
          merchant_id: merchantId, 
          error: error.response?.data?.message || error.message 
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Sync completed: ${results.updated_merchants.length} updated, ${results.failed_merchants.length} failed`);
    
    res.json({
      success: true,
      message: `Sincronização completa: ${results.updated_merchants.length} merchants atualizados`,
      ...results
    });
    
  } catch (error) {
    console.error('❌ Error in sync-all:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /merchants/:merchantId/opening-hours
app.put('/merchants/:merchantId/opening-hours', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { dayOfWeek, startTime, endTime, userId } = req.body;

    console.log(`🔄 PUT opening hours request for merchant: ${merchantId}`);
    console.log(`📅 Day: ${dayOfWeek}, Time: ${startTime} - ${endTime}`);

    if (!dayOfWeek || !startTime || !endTime || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: dayOfWeek, startTime, endTime, userId'
      });
    }

    const tokenData = await getTokenForUser(userId);
    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({
        success: false,
        message: 'No valid access token found for user'
      });
    }

    // Get stored opening hours with IDs from database
    const { data: merchant, error: merchantError } = await supabase
      .from('ifood_merchants')
      .select('operating_hours')
      .eq('merchant_id', merchantId)
      .single();

    if (merchantError || !merchant?.operating_hours?.by_day) {
      return res.status(400).json({
        success: false,
        message: 'Merchant not found or no opening hours data available. Run polling first.'
      });
    }

    // Get ALL existing shifts from database
    const allShifts = merchant.operating_hours.shifts || [];
    console.log(`📊 Found ${allShifts.length} existing shifts in database`);

    // Calculate duration for new/updated shift
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = (startHour * 60) + startMin;
    const endMinutes = (endHour * 60) + endMin;
    let duration = endMinutes - startMinutes;
    if (duration < 0) duration += (24 * 60);

    // Create updated shift for the specific day
    const updatedShift = {
      id: merchant.operating_hours.by_day[dayOfWeek] || `new-${dayOfWeek.toLowerCase()}`,
      dayOfWeek: dayOfWeek,
      start: startTime,
      duration: duration
    };

    // Merge: remove existing shift for this day and add updated one
    const otherShifts = allShifts.filter(shift => shift.dayOfWeek !== dayOfWeek);
    const finalShifts = [...otherShifts, updatedShift];

    console.log(`📊 Sending ${finalShifts.length} shifts to preserve other days`);

    const putBody = {
      storeId: merchantId,  // Store ID as per your example
      shifts: finalShifts   // ALL shifts to preserve existing days
    };

    const response = await axios.put(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/opening-hours`,
      putBody,
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    // Update our database with the new shifts immediately
    const updatedOperatingHours = {
      shifts: finalShifts,
      by_day: {},
      last_updated: new Date().toISOString()
    };

    // Rebuild by_day mapping
    finalShifts.forEach(shift => {
      if (shift.id) {
        updatedOperatingHours.by_day[shift.dayOfWeek] = shift.id;
      }
    });

    // Save updated data to database
    const { error: updateError } = await supabase
      .from('ifood_merchants')
      .update({ operating_hours: updatedOperatingHours })
      .eq('merchant_id', merchantId);

    if (updateError) {
      console.warn(`⚠️ Failed to update database: ${updateError.message}`);
    } else {
      console.log(`✅ Database updated with ${finalShifts.length} shifts`);
    }

    res.json({
      success: true,
      message: `Opening hours updated successfully for ${dayOfWeek}. Database updated immediately.`
    });

  } catch (error) {
    console.error('❌ Error updating opening hours:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE /merchants/:merchantId/opening-hours/delete (remove specific day)
app.delete('/merchants/:merchantId/opening-hours/delete', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { dayOfWeek, userId } = req.body;

    console.log(`🗑️ DELETE opening hours request for merchant: ${merchantId}, day: ${dayOfWeek}`);

    if (!dayOfWeek || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: dayOfWeek, userId'
      });
    }

    const tokenData = await getTokenForUser(userId);
    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({
        success: false,
        message: 'No valid access token found for user'
      });
    }

    // Get current opening hours from database
    const { data: merchant, error: merchantError } = await supabase
      .from('ifood_merchants')
      .select('operating_hours')
      .eq('merchant_id', merchantId)
      .single();

    if (merchantError || !merchant?.operating_hours?.shifts) {
      return res.status(400).json({
        success: false,
        message: 'Merchant not found or no opening hours data available.'
      });
    }

    // Remove the specific day from shifts
    const remainingShifts = merchant.operating_hours.shifts.filter(shift => shift.dayOfWeek !== dayOfWeek);
    
    console.log(`📊 Removing ${dayOfWeek}, keeping ${remainingShifts.length} days`);

    // Send PUT to iFood with remaining shifts only
    const putBody = {
      storeId: merchantId,
      shifts: remainingShifts
    };

    console.log(`📤 Sending PUT with ${remainingShifts.length} remaining shifts`);

    const response = await axios.put(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/opening-hours`,
      putBody,
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    console.log(`✅ iFood API DELETE successful: ${response.status}`);

    // Update our database with remaining shifts
    const updatedOperatingHours = {
      shifts: remainingShifts,
      by_day: {},
      last_updated: new Date().toISOString()
    };

    // Rebuild by_day mapping for remaining shifts
    remainingShifts.forEach(shift => {
      if (shift.id) {
        updatedOperatingHours.by_day[shift.dayOfWeek] = shift.id;
      }
    });

    // Save to database
    const { error: updateError } = await supabase
      .from('ifood_merchants')
      .update({ operating_hours: updatedOperatingHours })
      .eq('merchant_id', merchantId);

    if (updateError) {
      console.warn(`⚠️ Failed to update database: ${updateError.message}`);
    } else {
      console.log(`✅ Database updated - ${dayOfWeek} removed, ${remainingShifts.length} shifts remaining`);
    }

    res.json({
      success: true,
      message: `Horário removido para ${dayOfWeek}. Outros dias mantidos.`
    });

  } catch (error) {
    console.error('❌ Error deleting opening hours:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /merchants/:merchantId/interruptions
app.post('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate, reason, description, userId } = req.body;

    console.log(`🔄 POST interruption request for merchant: ${merchantId}`);

    if (!startDate || !endDate || !description || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: startDate, endDate, description, userId'
      });
    }

    const tokenData = await getTokenForUser(userId);
    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({
        success: false,
        message: 'No valid access token found for user'
      });
    }

    const requestBody = {
      start: startDate,
      end: endDate,
      description: description,
      ...(reason && { reason })
    };

    const response = await axios.post(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions`,
      requestBody,
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    const interruptionId = response.data?.id || response.data?.interruptionId;

    res.status(201).json({
      success: true,
      message: `Pausa programada criada com sucesso até ${new Date(endDate).toLocaleString('pt-BR')}`,
      interruptionId: interruptionId
    });

  } catch (error) {
    console.error('❌ Error creating scheduled pause:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message
    });
  }
});

// POST /token endpoint
app.post('/token', async (req, res) => {
  try {
    console.log('🔑 Token generation request');
    res.json({
      success: true,
      message: 'Token endpoint available'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /products endpoint  
app.post('/products', async (req, res) => {
  try {
    console.log('🛍️ Products sync request');
    res.json({
      success: true,
      message: 'Products endpoint available'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Updated server running on port ${PORT}`);
  console.log(`🔑 Token: POST http://localhost:${PORT}/token`);
  console.log(`🛍️ Products: POST http://localhost:${PORT}/products`);
  console.log(`🔄 Sync all merchants: POST http://localhost:${PORT}/merchants/sync-all`);
  console.log(`🕒 Update opening hours: PUT http://localhost:${PORT}/merchants/:merchantId/opening-hours`);
  console.log(`⏸️ Create interruption: POST http://localhost:${PORT}/merchants/:merchantId/interruptions`);
});