from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ifood_token_service import IFoodTokenService
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="iFood Token Service API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TokenRequest(BaseModel):
    clientId: str
    clientSecret: str
    user_id: str

@app.post("/token")
async def create_token(request: TokenRequest):
    """
    Create or retrieve iFood access token
    Replicates the N8N webhook functionality
    """
    try:
        # Get Supabase configuration
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            raise HTTPException(
                status_code=500, 
                detail="Missing Supabase configuration"
            )
        
        # Initialize service and process request
        service = IFoodTokenService(supabase_url, supabase_key)
        result = service.process_token_request(
            request.clientId,
            request.clientSecret,
            request.user_id
        )
        
        if result['success']:
            return result
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get('error', 'Failed to process token request')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ifood-token-service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api_server:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    )