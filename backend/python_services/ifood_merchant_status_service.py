"""
iFood Merchant Status Service
Converts N8N workflow [MERCHANT-STATUS] to Python code
Checks if stores are open and updates their status in the database
"""

import requests
import json
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Tuple
import os
from dataclasses import dataclass
import logging
from dotenv import load_dotenv
import schedule
import time as time_module
import threading

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class OpeningHours:
    """Data structure for opening hours"""
    id: str
    day_of_week: str
    start: str  # HH:MM:SS
    end: str    # HH:MM:SS
    duration_minutes: int

@dataclass
class MerchantStatus:
    """Data structure for merchant status"""
    merchant_id: str
    is_open: bool
    status_message: str
    current_time: str
    opening_time: str
    closing_time: str

class IFoodMerchantStatusService:
    """
    iFood Merchant Status Service
    Based on the N8N flow [MERCHANT-STATUS]:
    - Fetches merchant status from iFood API
    - Checks opening hours
    - Calculates if store is currently open
    - Updates status in Supabase
    """
    
    IFOOD_STATUS_URL = "https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchant_id}/status"
    IFOOD_HOURS_URL = "https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchant_id}/opening-hours"
    
    # Day mapping
    DAY_MAP = {
        'MONDAY': 0,
        'TUESDAY': 1,
        'WEDNESDAY': 2,
        'THURSDAY': 3,
        'FRIDAY': 4,
        'SATURDAY': 5,
        'SUNDAY': 6
    }
    
    def __init__(self, supabase_url: str = None, supabase_key: str = None):
        """Initialize the service with Supabase credentials"""
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase credentials not provided")
        
        self.headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
    
    def get_all_merchants(self) -> List[Dict]:
        """
        Get all merchants from database
        
        Returns:
            List of merchant data
        """
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_merchants",
                headers=self.headers,
                params={"select": "*"}
            )
            response.raise_for_status()
            
            merchants = response.json()
            logger.info(f"Found {len(merchants)} merchants in database")
            return merchants
            
        except Exception as e:
            logger.error(f"Error fetching merchants: {str(e)}")
            return []
    
    def get_token_for_merchant(self, user_id: str) -> Optional[str]:
        """
        Get access token for a merchant's user
        
        Args:
            user_id: User ID associated with the merchant
            
        Returns:
            Access token if found, None otherwise
        """
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_tokens",
                headers=self.headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "access_token"
                }
            )
            response.raise_for_status()
            
            tokens = response.json()
            if tokens:
                return tokens[0].get('access_token')
            return None
            
        except Exception as e:
            logger.error(f"Error fetching token: {str(e)}")
            return None
    
    def fetch_merchant_status(self, merchant_id: str, access_token: str) -> Tuple[bool, Dict]:
        """
        Fetch merchant status from iFood API
        
        Args:
            merchant_id: Merchant ID
            access_token: Valid iFood access token
            
        Returns:
            Tuple of (success: bool, status_data: Dict)
        """
        try:
            headers = {
                "accept": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            response = requests.get(
                self.IFOOD_STATUS_URL.format(merchant_id=merchant_id),
                headers=headers
            )
            
            if response.status_code == 200:
                return True, response.json()
            else:
                logger.error(f"iFood API error: {response.status_code}")
                return False, {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error fetching merchant status: {str(e)}")
            return False, {"error": str(e)}
    
    def fetch_opening_hours(self, merchant_id: str, access_token: str) -> Tuple[bool, List[Dict]]:
        """
        Fetch opening hours from iFood API
        
        Args:
            merchant_id: Merchant ID
            access_token: Valid iFood access token
            
        Returns:
            Tuple of (success: bool, opening_hours: List[Dict])
        """
        try:
            headers = {
                "accept": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            response = requests.get(
                self.IFOOD_HOURS_URL.format(merchant_id=merchant_id),
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                # Extract shifts/periods from response
                if 'shifts' in data:
                    return True, data['shifts']
                elif 'periods' in data:
                    return True, data['periods']
                elif isinstance(data, list):
                    return True, data
                else:
                    logger.warning(f"Unknown opening hours format: {data.keys()}")
                    return True, []
            else:
                logger.error(f"iFood API error: {response.status_code}")
                return False, []
                
        except Exception as e:
            logger.error(f"Error fetching opening hours: {str(e)}")
            return False, []
    
    def parse_time(self, time_str: str) -> time:
        """Convert time string to time object"""
        try:
            return datetime.strptime(time_str, "%H:%M:%S").time()
        except:
            return datetime.strptime(time_str, "%H:%M").time()
    
    def add_minutes_to_time(self, start_time: str, duration_minutes: int) -> str:
        """
        Add minutes to a time string
        
        Args:
            start_time: Time in HH:MM:SS format
            duration_minutes: Minutes to add
            
        Returns:
            End time in HH:MM:SS format
        """
        start = self.parse_time(start_time)
        start_datetime = datetime.combine(datetime.today(), start)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        return end_datetime.strftime("%H:%M:%S")
    
    def calculate_if_open(self, opening_hours: List[Dict]) -> MerchantStatus:
        """
        Calculate if merchant is currently open based on opening hours
        
        Args:
            opening_hours: List of opening hour periods
            
        Returns:
            MerchantStatus object
        """
        now = datetime.now()
        current_time = now.time()
        current_day = now.weekday()  # 0 = Monday, 6 = Sunday
        
        # Find today's schedule
        today_schedule = None
        for period in opening_hours:
            day_of_week = period.get('dayOfWeek', '')
            if self.DAY_MAP.get(day_of_week) == current_day:
                today_schedule = period
                break
        
        if not today_schedule:
            return MerchantStatus(
                merchant_id="",
                is_open=False,
                status_message="Não há funcionamento hoje",
                current_time=current_time.strftime("%H:%M:%S"),
                opening_time="",
                closing_time=""
            )
        
        # Calculate opening and closing times
        start_time = today_schedule.get('start', '00:00:00')
        duration = today_schedule.get('duration', 0)
        end_time = self.add_minutes_to_time(start_time, duration)
        
        start = self.parse_time(start_time)
        end = self.parse_time(end_time)
        
        # Check if currently open
        is_open = False
        status_message = ""
        
        if start <= end:
            # Normal hours (doesn't cross midnight)
            is_open = start <= current_time <= end
            if is_open:
                status_message = f"Aberto até {end_time}"
            elif current_time < start:
                status_message = f"Abrirá às {start_time}"
            else:
                status_message = f"Fechou às {end_time}"
        else:
            # Crosses midnight
            is_open = current_time >= start or current_time <= end
            if is_open:
                status_message = f"Aberto até {end_time}"
            else:
                status_message = f"Abrirá às {start_time}"
        
        return MerchantStatus(
            merchant_id="",
            is_open=is_open,
            status_message=status_message,
            current_time=current_time.strftime("%H:%M:%S"),
            opening_time=start_time,
            closing_time=end_time
        )
    
    def update_merchant_status(self, merchant_id: str, is_open: bool) -> bool:
        """
        Update merchant status in database
        
        Args:
            merchant_id: Merchant ID
            is_open: Whether the merchant is open
            
        Returns:
            True if update successful, False otherwise
        """
        try:
            # First get the record ID
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_merchants",
                headers=self.headers,
                params={
                    "merchant_id": f"eq.{merchant_id}",
                    "select": "id"
                }
            )
            response.raise_for_status()
            
            records = response.json()
            if not records:
                logger.error(f"Merchant {merchant_id} not found in database")
                return False
            
            # Update the status
            update_data = {"status": is_open}
            
            response = requests.patch(
                f"{self.supabase_url}/rest/v1/ifood_merchants",
                headers=self.headers,
                params={"merchant_id": f"eq.{merchant_id}"},
                json=update_data
            )
            
            if response.status_code in [200, 204]:
                logger.info(f"Updated merchant {merchant_id} status to {is_open}")
                return True
            else:
                logger.error(f"Failed to update status: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating merchant status: {str(e)}")
            return False
    
    def check_all_merchant_statuses(self) -> Dict:
        """
        Main method to check all merchant statuses
        Replicates the N8N workflow [MERCHANT-STATUS]:
        1. Get all merchants from database
        2. For each merchant with status=false:
           - Fetch opening hours from iFood
           - Calculate if currently open
           - Update status in database
        
        Returns:
            Dict with results
        """
        try:
            logger.info("Starting merchant status check...")
            
            # Get all merchants
            merchants = self.get_all_merchants()
            if not merchants:
                return {
                    "success": False,
                    "error": "No merchants found"
                }
            
            results = {
                "success": True,
                "total_merchants": len(merchants),
                "checked": 0,
                "updated": 0,
                "errors": []
            }
            
            for merchant in merchants:
                try:
                    merchant_id = merchant.get('merchant_id')
                    user_id = merchant.get('user_id')
                    current_status = merchant.get('status', True)
                    
                    # Skip if no merchant_id or user_id
                    if not merchant_id or not user_id:
                        continue
                    
                    # Only check merchants that are marked as closed
                    # (In production, you might want to check all)
                    if current_status:
                        continue
                    
                    results["checked"] += 1
                    
                    # Get token for this merchant's user
                    access_token = self.get_token_for_merchant(user_id)
                    if not access_token:
                        logger.warning(f"No token found for merchant {merchant_id}")
                        results["errors"].append({
                            "merchant_id": merchant_id,
                            "error": "No access token"
                        })
                        continue
                    
                    # Fetch opening hours
                    success, opening_hours = self.fetch_opening_hours(merchant_id, access_token)
                    if not success or not opening_hours:
                        logger.warning(f"Could not fetch opening hours for {merchant_id}")
                        continue
                    
                    # Calculate if open
                    status = self.calculate_if_open(opening_hours)
                    status.merchant_id = merchant_id
                    
                    # Update if status changed
                    if status.is_open != current_status:
                        if self.update_merchant_status(merchant_id, status.is_open):
                            results["updated"] += 1
                            logger.info(f"Merchant {merchant_id}: {status.status_message}")
                    
                except Exception as e:
                    logger.error(f"Error processing merchant {merchant.get('merchant_id')}: {str(e)}")
                    results["errors"].append({
                        "merchant_id": merchant.get('merchant_id'),
                        "error": str(e)
                    })
            
            logger.info(f"Status check complete: {results['checked']} checked, {results['updated']} updated")
            return results
            
        except Exception as e:
            error_msg = f"Error in status check: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
    
    def start_scheduler(self, interval_minutes: int = 1):
        """
        Start scheduled status checks
        
        Args:
            interval_minutes: Interval between checks in minutes
        """
        logger.info(f"Starting scheduler with {interval_minutes} minute interval")
        
        # Schedule the job
        schedule.every(interval_minutes).minutes.do(self.check_all_merchant_statuses)
        
        # Run the scheduler
        while True:
            schedule.run_pending()
            time_module.sleep(1)


# Flask API Implementation (optional - for manual trigger)
if __name__ == "__main__":
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)
    
    # Initialize service
    service = IFoodMerchantStatusService()
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            "status": "healthy",
            "service": "ifood-merchant-status-service",
            "timestamp": datetime.now().isoformat()
        })
    
    @app.route('/merchant-status/check', methods=['POST'])
    def check_statuses():
        """
        Manually trigger status check for all merchants
        """
        try:
            result = service.check_all_merchant_statuses()
            
            if result.get('success'):
                return jsonify(result), 200
            else:
                return jsonify(result), 500
                
        except Exception as e:
            logger.error(f"API error: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/merchant-status/<merchant_id>', methods=['GET'])
    def check_single_merchant(merchant_id):
        """Check status of a single merchant"""
        try:
            # Get merchant data
            merchants = service.get_all_merchants()
            merchant = next((m for m in merchants if m['merchant_id'] == merchant_id), None)
            
            if not merchant:
                return jsonify({"error": "Merchant not found"}), 404
            
            # Get token
            access_token = service.get_token_for_merchant(merchant['user_id'])
            if not access_token:
                return jsonify({"error": "No access token"}), 401
            
            # Fetch opening hours
            success, opening_hours = service.fetch_opening_hours(merchant_id, access_token)
            if not success:
                return jsonify({"error": "Could not fetch opening hours"}), 500
            
            # Calculate status
            status = service.calculate_if_open(opening_hours)
            
            return jsonify({
                "merchant_id": merchant_id,
                "is_open": status.is_open,
                "message": status.status_message,
                "current_time": status.current_time,
                "opening_time": status.opening_time,
                "closing_time": status.closing_time
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/merchant-status/start-scheduler', methods=['POST'])
    def start_scheduler():
        """Start the automatic scheduler in a background thread"""
        try:
            interval = request.json.get('interval_minutes', 1)
            
            # Start scheduler in background thread
            thread = threading.Thread(
                target=service.start_scheduler,
                args=(interval,),
                daemon=True
            )
            thread.start()
            
            return jsonify({
                "success": True,
                "message": f"Scheduler started with {interval} minute interval"
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    # Run the Flask app
    port = int(os.getenv('STATUS_SERVICE_PORT', 9004))
    logger.info(f"Starting iFood Merchant Status Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)