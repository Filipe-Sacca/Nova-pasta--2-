"""
iFood Merchant Service
Converts N8N workflow [MERCHANT] to Python code
Fetches merchant data from iFood API and stores in Supabase
"""

import requests
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import os
from dataclasses import dataclass
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class MerchantData:
    """Data structure for merchant information"""
    merchant_id: str
    name: str
    corporate_name: str
    user_id: str
    client_id: str
    status: bool = True  # True = available, False = unavailable/closed

class IFoodMerchantService:
    """
    iFood Merchant Service
    Based on the N8N flow [MERCHANT]:
    - Fetches merchant list from iFood API
    - Checks for existing merchants in database
    - Stores new merchants in Supabase
    """
    
    IFOOD_MERCHANT_URL = "https://merchant-api.ifood.com.br/merchant/v1.0/merchants"
    
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
    
    def get_token_from_db(self, user_id: str) -> Optional[Dict]:
        """
        Get access token from database for a specific user
        
        Args:
            user_id: The user ID to fetch token for
            
        Returns:
            Token data if found, None otherwise
        """
        try:
            # Query Supabase for token
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_tokens",
                headers=self.headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "*"
                }
            )
            response.raise_for_status()
            
            tokens = response.json()
            if tokens:
                logger.info(f"Token found for user_id: {user_id}")
                return tokens[0]
            else:
                logger.warning(f"No token found for user_id: {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching token: {str(e)}")
            return None
    
    def fetch_merchants_from_ifood(self, access_token: str) -> Tuple[bool, List[Dict]]:
        """
        Fetch merchant list from iFood API
        
        Args:
            access_token: Valid iFood access token
            
        Returns:
            Tuple of (success: bool, merchants: List[Dict])
        """
        try:
            headers = {
                "accept": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            logger.info("Fetching merchants from iFood API...")
            response = requests.get(
                self.IFOOD_MERCHANT_URL,
                headers=headers
            )
            
            if response.status_code == 200:
                merchants = response.json()
                logger.info(f"Successfully fetched {len(merchants)} merchants")
                return True, merchants
            else:
                error_msg = f"iFood API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return False, [{"error": error_msg}]
                
        except Exception as e:
            error_msg = f"Error fetching merchants: {str(e)}"
            logger.error(error_msg)
            return False, [{"error": error_msg}]
    
    def check_merchant_exists(self, merchant_id: str) -> bool:
        """
        Check if merchant already exists in database
        
        Args:
            merchant_id: The merchant ID to check
            
        Returns:
            True if merchant exists, False otherwise
        """
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_merchants",
                headers=self.headers,
                params={
                    "merchant_id": f"eq.{merchant_id}",
                    "select": "merchant_id"
                }
            )
            response.raise_for_status()
            
            merchants = response.json()
            exists = len(merchants) > 0
            
            if exists:
                logger.info(f"Merchant {merchant_id} already exists in database")
            else:
                logger.info(f"Merchant {merchant_id} not found in database")
                
            return exists
            
        except Exception as e:
            logger.error(f"Error checking merchant existence: {str(e)}")
            return False
    
    def store_merchant(self, merchant: MerchantData) -> Tuple[bool, Dict]:
        """
        Store merchant in Supabase database
        
        Args:
            merchant: MerchantData object with merchant information
            
        Returns:
            Tuple of (success: bool, response: Dict)
        """
        try:
            merchant_dict = {
                "merchant_id": merchant.merchant_id,
                "name": merchant.name,
                "corporate_name": merchant.corporate_name,
                "user_id": merchant.user_id,
                "client_id": merchant.client_id,
                "status": merchant.status
            }
            
            logger.info(f"Storing merchant {merchant.merchant_id} in database...")
            
            response = requests.post(
                f"{self.supabase_url}/rest/v1/ifood_merchants",
                headers=self.headers,
                json=merchant_dict
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Merchant {merchant.merchant_id} stored successfully")
                return True, {"success": True, "merchant_id": merchant.merchant_id}
            else:
                error_msg = f"Database error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return False, {"error": error_msg}
                
        except Exception as e:
            error_msg = f"Error storing merchant: {str(e)}"
            logger.error(error_msg)
            return False, {"error": error_msg}
    
    def process_merchants(self, user_id: str, access_token: str = None) -> Dict:
        """
        Main method to process merchant synchronization
        Replicates the N8N workflow [MERCHANT]:
        1. Get access token (from parameter or database)
        2. Fetch merchants from iFood API
        3. Check each merchant against database
        4. Store new merchants
        5. Return results
        
        Args:
            user_id: User ID for the operation
            access_token: Optional access token (if not provided, fetches from DB)
            
        Returns:
            Dict with operation results
        """
        try:
            logger.info(f"Processing merchant synchronization for user: {user_id}")
            
            # Step 1: Get access token
            if not access_token:
                token_data = self.get_token_from_db(user_id)
                if not token_data:
                    return {
                        "success": False,
                        "error": "No valid token found for user"
                    }
                access_token = token_data.get('access_token')
                client_id = token_data.get('client_id')
            else:
                # If token provided directly, we need to get client_id from DB
                token_data = self.get_token_from_db(user_id)
                client_id = token_data.get('client_id') if token_data else None
            
            if not client_id:
                return {
                    "success": False,
                    "error": "Could not determine client_id"
                }
            
            # Step 2: Fetch merchants from iFood
            success, merchants = self.fetch_merchants_from_ifood(access_token)
            if not success:
                return {
                    "success": False,
                    "error": merchants[0].get('error', 'Failed to fetch merchants')
                }
            
            # Step 3 & 4: Process each merchant
            results = {
                "success": True,
                "total_merchants": len(merchants),
                "new_merchants": [],
                "existing_merchants": [],
                "errors": []
            }
            
            for merchant_data in merchants:
                try:
                    # Extract merchant information
                    merchant = MerchantData(
                        merchant_id=merchant_data.get('id'),
                        name=merchant_data.get('name'),
                        corporate_name=merchant_data.get('corporateName', ''),
                        user_id=user_id,
                        client_id=client_id,
                        status=True  # True = available
                    )
                    
                    # Check if merchant exists
                    if self.check_merchant_exists(merchant.merchant_id):
                        results["existing_merchants"].append(merchant.merchant_id)
                    else:
                        # Store new merchant
                        stored, response = self.store_merchant(merchant)
                        if stored:
                            results["new_merchants"].append(merchant.merchant_id)
                        else:
                            results["errors"].append({
                                "merchant_id": merchant.merchant_id,
                                "error": response.get('error')
                            })
                            
                except Exception as e:
                    logger.error(f"Error processing merchant {merchant_data.get('id')}: {str(e)}")
                    results["errors"].append({
                        "merchant_id": merchant_data.get('id'),
                        "error": str(e)
                    })
            
            # Step 5: Return results
            results["message"] = f"Processed {len(merchants)} merchants: {len(results['new_merchants'])} new, {len(results['existing_merchants'])} existing"
            
            return results
            
        except Exception as e:
            error_msg = f"Error in merchant processing: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }


# Flask API Implementation (optional - for standalone service)
if __name__ == "__main__":
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)
    
    # Initialize service
    service = IFoodMerchantService()
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            "status": "healthy",
            "service": "ifood-merchant-service",
            "timestamp": datetime.now().isoformat()
        })
    
    @app.route('/merchant', methods=['POST'])
    def sync_merchants():
        """
        Webhook endpoint to sync merchants
        Expects: {"user_id": "xxx", "access_token": "xxx"} (access_token optional)
        """
        try:
            data = request.json
            user_id = data.get('user_id')
            access_token = data.get('access_token')
            
            if not user_id:
                return jsonify({"error": "user_id is required"}), 400
            
            result = service.process_merchants(user_id, access_token)
            
            if result.get('success'):
                return jsonify(result), 200
            else:
                return jsonify(result), 500
                
        except Exception as e:
            logger.error(f"API error: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/merchant/check/<merchant_id>', methods=['GET'])
    def check_merchant(merchant_id):
        """Check if a specific merchant exists"""
        try:
            exists = service.check_merchant_exists(merchant_id)
            return jsonify({
                "merchant_id": merchant_id,
                "exists": exists
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    # Run the Flask app
    port = int(os.getenv('MERCHANT_SERVICE_PORT', 9002))
    logger.info(f"Starting iFood Merchant Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)