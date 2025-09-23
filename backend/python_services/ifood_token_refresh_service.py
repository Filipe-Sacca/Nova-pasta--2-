import requests
import json
import time
import schedule
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import os
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class TokenRecord:
    """Data structure for token record from database"""
    id: int
    client_id: str
    client_secret: str
    access_token: str
    expires_at: int
    user_id: str
    created_at: str
    updated_at: str

@dataclass
class RefreshResult:
    """Result of token refresh operation"""
    success: bool
    client_id: str
    new_token: Optional[str] = None
    error: Optional[str] = None
    updated_at: Optional[str] = None

class IFoodTokenRefreshService:
    """
    iFood Token Refresh Service
    
    Replicates the N8N workflow that runs every 2 hours to refresh all tokens:
    1. Schedule Trigger (every 2 hours at minute 50)
    2. Get all rows from ifood_tokens table
    3. For each token, call iFood API to get new access_token
    4. Update the token in the database
    """
    
    IFOOD_TOKEN_URL = "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token"
    GRANT_TYPE = "client_credentials"
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize the service with Supabase credentials"""
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
    
    def get_all_tokens(self) -> List[TokenRecord]:
        """
        Get all tokens from ifood_tokens table
        Replicates: "Get many rows" node
        """
        try:
            logger.info("📊 Fetching all tokens from database...")
            
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_tokens",
                headers=self.headers,
                params={"select": "*"}
            )
            response.raise_for_status()
            
            tokens_data = response.json()
            logger.info(f"✅ Found {len(tokens_data)} tokens in database")
            
            tokens = []
            for token_data in tokens_data:
                tokens.append(TokenRecord(
                    id=token_data['id'],
                    client_id=token_data['client_id'],
                    client_secret=token_data['client_secret'],
                    access_token=token_data['access_token'],
                    expires_at=token_data['expires_at'],
                    user_id=token_data['user_id'],
                    created_at=token_data.get('created_at', ''),
                    updated_at=token_data.get('token_updated_at', '')
                ))
            
            return tokens
            
        except Exception as e:
            logger.error(f"❌ Error fetching tokens from database: {str(e)}")
            return []
    
    def refresh_single_token(self, token: TokenRecord) -> RefreshResult:
        """
        Refresh a single token via iFood API
        Replicates: "[Client Credentials]" node
        """
        try:
            logger.info(f"🔄 Refreshing token for client_id: {token.client_id[:8]}...")
            
            # Prepare request data (same as N8N flow)
            token_data = {
                "grantType": self.GRANT_TYPE,
                "clientId": token.client_id,
                "clientSecret": token.client_secret
            }
            
            # Headers for iFood API
            ifood_headers = {
                "accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            # Make request to iFood API
            response = requests.post(
                self.IFOOD_TOKEN_URL,
                headers=ifood_headers,
                data=token_data
            )
            
            if response.status_code == 200:
                api_response = response.json()
                new_access_token = api_response['accessToken']
                updated_at = datetime.now().isoformat()
                
                logger.info(f"✅ New token generated for {token.client_id[:8]}")
                return RefreshResult(
                    success=True,
                    client_id=token.client_id,
                    new_token=new_access_token,
                    updated_at=updated_at
                )
            else:
                error_msg = f"iFood API error: {response.status_code} - {response.text}"
                logger.error(f"❌ {error_msg}")
                return RefreshResult(
                    success=False,
                    client_id=token.client_id,
                    error=error_msg
                )
                
        except Exception as e:
            error_msg = f"Error refreshing token: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return RefreshResult(
                success=False,
                client_id=token.client_id,
                error=error_msg
            )
    
    def update_token_in_database(self, result: RefreshResult) -> bool:
        """
        Update token in database
        Replicates: "Atualiza Token de Acesso" node
        """
        if not result.success:
            return False
            
        try:
            logger.info(f"💾 Updating token in database for {result.client_id[:8]}...")
            
            # Prepare update data (same fields as N8N flow)
            update_data = {
                "access_token": result.new_token,
                "token_updated_at": result.updated_at
            }
            
            # Update token in Supabase
            response = requests.patch(
                f"{self.supabase_url}/rest/v1/ifood_tokens",
                headers=self.headers,
                params={"client_id": f"eq.{result.client_id}"},
                json=update_data
            )
            
            if response.status_code in [200, 204]:
                logger.info(f"✅ Token updated successfully in database")
                return True
            else:
                logger.error(f"❌ Database update error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error updating token in database: {str(e)}")
            return False
    
    def refresh_all_tokens(self) -> Dict[str, int]:
        """
        Main method to refresh all tokens
        Replicates the complete N8N workflow
        """
        logger.info("🚀 Starting token refresh job...")
        
        # Statistics
        stats = {
            "total": 0,
            "successful": 0,
            "failed": 0
        }
        
        try:
            # Step 1: Get all tokens from database
            tokens = self.get_all_tokens()
            stats["total"] = len(tokens)
            
            if not tokens:
                logger.info("📭 No tokens found in database")
                return stats
            
            # Step 2: Refresh each token
            for token in tokens:
                logger.info(f"Processing token {stats['successful'] + stats['failed'] + 1}/{stats['total']}")
                
                # Step 2a: Refresh token via iFood API
                refresh_result = self.refresh_single_token(token)
                
                if refresh_result.success:
                    # Step 2b: Update token in database
                    if self.update_token_in_database(refresh_result):
                        stats["successful"] += 1
                    else:
                        stats["failed"] += 1
                else:
                    stats["failed"] += 1
                
                # Small delay between requests to respect rate limits
                time.sleep(0.5)
            
            # Final statistics
            logger.info("📊 Token refresh job completed:")
            logger.info(f"  Total tokens: {stats['total']}")
            logger.info(f"  Successful: {stats['successful']}")
            logger.info(f"  Failed: {stats['failed']}")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error in refresh job: {str(e)}")
            stats["failed"] = stats["total"]
            return stats
    
    def start_scheduler(self):
        """
        Start the scheduled token refresh service
        Replicates: Schedule Trigger (every 2 hours at minute 50)
        """
        logger.info("⏰ Starting iFood Token Refresh Scheduler...")
        logger.info("📅 Schedule: Every 2 hours at minute 50")
        
        # Schedule job every 2 hours at minute 50
        # This replicates the N8N schedule exactly
        schedule.every(2).hours.at(":50").do(self.refresh_all_tokens)
        
        # Also run immediately for testing (optional)
        logger.info("🧪 Running initial refresh job...")
        self.refresh_all_tokens()
        
        logger.info("🔄 Scheduler started. Press Ctrl+C to stop.")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("🛑 Scheduler stopped by user")

def run_refresh_service():
    """Run the token refresh service"""
    try:
        # Get environment variables
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.error('❌ Missing Supabase configuration')
            return
        
        # Initialize and start service
        service = IFoodTokenRefreshService(supabase_url, supabase_key)
        service.start_scheduler()
        
    except Exception as e:
        logger.error(f"❌ Service error: {str(e)}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    # Run the service
    run_refresh_service()