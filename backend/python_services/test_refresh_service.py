#!/usr/bin/env python3
"""
Test script for iFood Token Refresh Service
This script tests the refresh functionality without running the full scheduler
"""

import os
import sys
from dotenv import load_dotenv
from ifood_token_refresh_service import IFoodTokenRefreshService

def test_token_refresh():
    """Test the token refresh service manually"""
    
    print("🧪 TESTE DO SERVIÇO DE RENOVAÇÃO DE TOKENS iFood")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Environment variables not configured")
        print("Please check your .env file")
        return False
    
    print(f"✅ Environment configured:")
    print(f"  - Supabase URL: {supabase_url}")
    print(f"  - Supabase Key: {'*' * 10}{supabase_key[-10:]}")
    print()
    
    try:
        # Initialize service
        service = IFoodTokenRefreshService(supabase_url, supabase_key)
        
        # Test 1: Get all tokens
        print("📊 TESTE 1: Buscando tokens no banco de dados...")
        tokens = service.get_all_tokens()
        
        if not tokens:
            print("📭 Nenhum token encontrado no banco de dados")
            print("💡 Execute o serviço de criação de tokens primeiro")
            return False
        
        print(f"✅ Encontrados {len(tokens)} tokens:")
        for i, token in enumerate(tokens, 1):
            print(f"  {i}. Client ID: {token.client_id[:8]}...")
            print(f"     User ID: {token.user_id}")
            print(f"     Expires at: {token.expires_at}")
        print()
        
        # Test 2: Refresh tokens
        print("🔄 TESTE 2: Executando renovação de todos os tokens...")
        stats = service.refresh_all_tokens()
        
        print("\n📈 RESULTADOS:")
        print(f"  Total de tokens: {stats['total']}")
        print(f"  Renovações bem-sucedidas: {stats['successful']}")
        print(f"  Falhas: {stats['failed']}")
        print(f"  Taxa de sucesso: {(stats['successful']/stats['total']*100):.1f}%")
        
        if stats['successful'] > 0:
            print("\n✅ TESTE CONCLUÍDO COM SUCESSO!")
            print("O serviço de renovação está funcionando corretamente")
            return True
        else:
            print("\n⚠️ TESTE CONCLUÍDO COM PROBLEMAS")
            print("Verifique os logs para mais detalhes")
            return False
            
    except Exception as e:
        print(f"\n❌ ERRO NO TESTE: {str(e)}")
        return False

def show_schedule_info():
    """Show information about the scheduled service"""
    print("\n📅 INFORMAÇÕES DO AGENDAMENTO:")
    print("  - Frequência: A cada 2 horas")
    print("  - Horário: No minuto 50 (xx:50)")
    print("  - Próximas execuções:")
    print("    - 00:50, 02:50, 04:50, 06:50...")
    print("    - 08:50, 10:50, 12:50, 14:50...")
    print("    - 16:50, 18:50, 20:50, 22:50...")
    print()
    print("🎯 Para executar o serviço continuamente:")
    print("  python ifood_token_refresh_service.py")

if __name__ == "__main__":
    print("🚀 iFood Token Refresh Service - Teste Manual")
    print()
    
    # Run test
    success = test_token_refresh()
    
    # Show additional info
    show_schedule_info()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)