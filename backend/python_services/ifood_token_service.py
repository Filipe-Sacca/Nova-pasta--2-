import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import os
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TokenRequest:
    """Data structure for token request"""
    client_id: str
    client_secret: str
    user_id: str

@dataclass
class TokenResponse:
    """Data structure for token response"""
    access_token: str
    expires_in: int
    created_at: datetime
    expires_at: datetime
    
class IFoodTokenService:
    """
    iFood Token Service for OAuth2 Client Credentials Flow
    
    Based on the N8N flow analysis:
    - Implements OAuth2 Client Credentials flow
    - Stores tokens in Supabase ifood_tokens table
    - Handles token validation and refresh
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
    
    def check_existing_token(self, client_id: str) -> Optional[Dict]:
        """
        Check if a valid token already exists for the client
        
        Returns:
            Dict with token data if valid token exists, None otherwise
        """
        try:
            # Query Supabase for existing token
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ifood_tokens",
                headers=self.headers,
                params={
                    "client_id": f"eq.{client_id}",
                    "select": "*"
                }
            )
            response.raise_for_status()
            
            tokens = response.json()
            if not tokens:
                logger.info(f"No existing token found for client_id: {client_id}")
                return None
            
            # Check if token is still valid
            token = tokens[0]  # Get the most recent token
            expires_at = datetime.fromisoformat(token['expires_at'].replace('Z', '+00:00'))
            
            if expires_at > datetime.now():
                logger.info(f"Valid token found for client_id: {client_id}")
                return token
            else:
                logger.info(f"Token expired for client_id: {client_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error checking existing token: {str(e)}")
            return None
    
    def generate_token(self, request: TokenRequest) -> Tuple[bool, Dict]:
        """
        Generate new access token from iFood API
        
        Args:
            request: TokenRequest with client credentials
            
        Returns:
            Tuple of (success: bool, response: Dict)
        """
        try:
            # Prepare request data
            token_data = {
                "grantType": self.GRANT_TYPE,
                "clientId": request.client_id,
                "clientSecret": request.client_secret
            }
            
            # Headers for iFood API
            ifood_headers = {
                "accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            logger.info(f"Requesting token for client_id: {request.client_id}")
            
            # Make request to iFood API
            response = requests.post(
                self.IFOOD_TOKEN_URL,
                headers=ifood_headers,
                data=token_data
            )
            
            if response.status_code == 200:
                token_data = response.json()
                created_at = datetime.now()
                expires_at = created_at + timedelta(seconds=token_data['expiresIn'])
                
                token_response = TokenResponse(
                    access_token=token_data['accessToken'],
                    expires_in=token_data['expiresIn'],
                    created_at=created_at,
                    expires_at=expires_at
                )
                
                logger.info("Token generated successfully")
                return True, {
                    "access_token": token_response.access_token,
                    "expires_in": token_response.expires_in,
                    "created_at": token_response.created_at.isoformat(),
                    "expires_at": token_response.expires_at.isoformat()
                }
            else:
                error_msg = f"iFood API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return False, {"error": error_msg}
                
        except Exception as e:
            error_msg = f"Error generating token: {str(e)}"
            logger.error(error_msg)
            return False, {"error": error_msg}
    
    def store_token(self, request: TokenRequest, token_data: Dict) -> Tuple[bool, Dict]:
        """
        Store token in Supabase ifood_tokens table
        
        Args:
            request: Original token request
            token_data: Token data from iFood API
            
        Returns:
            Tuple of (success: bool, response: Dict)
        """
        try:
            # Prepare data for Supabase
            supabase_data = {
                "client_id": request.client_id,
                "client_secret": request.client_secret,
                "access_token": token_data["access_token"],
                "expires_at": token_data["expires_at"],
                "created_at": token_data["created_at"],
                "user_id": request.user_id
            }
            
            # Upsert token (insert or update if exists)
            response = requests.post(
                f"{self.supabase_url}/rest/v1/ifood_tokens",
                headers=self.headers,
                json=supabase_data
            )
            
            if response.status_code in [200, 201]:
                logger.info("Token stored successfully in Supabase")
                return True, supabase_data
            else:
                error_msg = f"Supabase error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return False, {"error": error_msg}
                
        except Exception as e:
            error_msg = f"Error storing token: {str(e)}"
            logger.error(error_msg)
            return False, {"error": error_msg}
    
    def process_token_request(self, client_id: str, client_secret: str, user_id: str) -> Dict:
        """
        Main method to process complete token request flow
        
        This replicates the N8N workflow:
        1. Check if token exists and is valid
        2. If not, generate new token from iFood
        3. Store token in Supabase
        4. Return response
        
        Args:
            client_id: iFood client ID
            client_secret: iFood client secret
            user_id: User identifier
            
        Returns:
            Dict with success status and data/error
        """
        try:
            # Step 1: Check existing token
            existing_token = self.check_existing_token(client_id)
            if existing_token:
                return {
                    "success": True,
                    "message": "Valid token already exists",
                    "data": existing_token
                }
            
            # Step 2: Generate new token
            request = TokenRequest(
                client_id=client_id,
                client_secret=client_secret,
                user_id=user_id
            )
            
            success, token_data = self.generate_token(request)
            if not success:
                return {
                    "success": False,
                    "error": token_data.get("error", "Failed to generate token")
                }
            
            # Step 3: Store token
            success, stored_data = self.store_token(request, token_data)
            if not success:
                return {
                    "success": False,
                    "error": stored_data.get("error", "Failed to store token")
                }
            
            return {
                "success": True,
                "message": "Token generated and stored successfully",
                "data": stored_data
            }
            
        except Exception as e:
            error_msg = f"Error processing token request: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }

def lambda_handler(event, context):
    """
    AWS Lambda handler function
    Can be adapted for other serverless platforms
    """
    try:
        # Get environment variables
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'error': 'Missing Supabase configuration'
                })
            }
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        required_fields = ['clientId', 'clientSecret', 'user_id']
        for field in required_fields:
            if field not in body:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': f'Missing required field: {field}'
                    })
                }
        
        # Initialize service and process request
        service = IFoodTokenService(supabase_url, supabase_key)
        result = service.process_token_request(
            body['clientId'],
            body['clientSecret'],
            body['user_id']
        )
        
        status_code = 200 if result['success'] else 400
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error'
            })
        }

if __name__ == "__main__":
    # Test the service locally
    from dotenv import load_dotenv
    load_dotenv()
    
    # Test credentials (use your actual test credentials)
    test_client_id = "f133bf28-ff34-47c3-827d-dd2b662f0363"
    test_client_secret = "rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3"
    test_user_id = "4bd7433f-bc74-471f-ac0d-7d631bd5038c"
    
    # Initialize service
    service = IFoodTokenService(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_ANON_KEY')
    )
    
    # Test the flow
    result = service.process_token_request(
        test_client_id,
        test_client_secret,
        test_user_id
    )
    
    print("Test Result:")
    print(json.dumps(result, indent=2, default=str))