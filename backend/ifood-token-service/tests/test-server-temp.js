// Updated server with all endpoints including interruptions
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const app = express();
const PORT = 8082;

app.use(cors());
app.use(express.json());

// Import our service (we'll simulate it)
const axios = require('axios');

// Simulate the updateOpeningHours method
async function updateOpeningHours(merchantId, dayOfWeek, startTime, endTime, accessToken) {
  try {
    console.log(`🔄 Updating opening hours for ${merchantId} - ${dayOfWeek}: ${startTime} to ${endTime}`);

    // 1. Get stored opening hours with IDs from database
    const { data: merchant, error: merchantError } = await supabase
      .from('ifood_merchants')
      .select('operating_hours')
      .eq('merchant_id', merchantId)
      .single();

    if (merchantError || !merchant?.operating_hours?.by_day) {
      return {
        success: false,
        message: 'Merchant not found or no opening hours data available. Run polling first.'
      };
    }

    // 2. Get the specific day ID
    const dayId = merchant.operating_hours.by_day[dayOfWeek];
    if (!dayId) {
      return {
        success: false,
        message: `No ID found for ${dayOfWeek}. Available days: ${Object.keys(merchant.operating_hours.by_day).join(', ')}`
      };
    }

    // 3. Calculate duration in minutes
    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
      return {
        success: false,
        message: 'Invalid time range. End time must be after start time.'
      };
    }

    // 4. Prepare PUT request body
    const putBody = {
      shifts: [
        {
          id: dayId,
          dayOfWeek: dayOfWeek,
          start: startTime,
          duration: duration
        }
      ]
    };

    console.log(`📤 PUT body:`, JSON.stringify(putBody, null, 2));

    // 5. Make PUT request to iFood API
    const response = await axios.put(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/opening-hours`,
      putBody,
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log(`✅ iFood API response: ${response.status}`);

    return {
      success: true,
      message: `Opening hours updated successfully for ${dayOfWeek}. Changes will be reflected in next polling cycle.`
    };

  } catch (error) {
    console.error(`❌ Error updating opening hours:`, error.response?.data || error.message);
    return {
      success: false,
      message: `Failed to update opening hours: ${error.response?.data?.message || error.message}`
    };
  }
}

function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = (startHour * 60) + startMin;
  const endMinutes = (endHour * 60) + endMin;
  
  // Handle times that cross midnight
  let duration = endMinutes - startMinutes;
  if (duration < 0) {
    duration += (24 * 60); // Add 24 hours if crosses midnight
  }
  
  return duration;
}

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

// PUT endpoint
app.put('/merchants/:merchantId/opening-hours', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { dayOfWeek, startTime, endTime, userId } = req.body;

    console.log(`🔄 PUT opening hours request for merchant: ${merchantId}`);
    console.log(`📅 Day: ${dayOfWeek}, Time: ${startTime} - ${endTime}`);

    // Validate required fields
    if (!dayOfWeek || !startTime || !endTime || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: dayOfWeek, startTime, endTime, userId'
      });
    }

    // Get access token for the user
    const tokenData = await getTokenForUser(userId);
    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({
        success: false,
        message: 'No valid access token found for user'
      });
    }

    // Update opening hours
    const result = await updateOpeningHours(
      merchantId,
      dayOfWeek,
      startTime,
      endTime,
      tokenData.access_token
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ Error updating opening hours:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', port: PORT });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🕒 PUT http://localhost:${PORT}/merchants/:merchantId/opening-hours`);
});