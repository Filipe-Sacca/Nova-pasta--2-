import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

interface Product {
  client_id: string;
  item_id: string;
  name: string;
  category: string | null;
  price: number | null;
  is_active: boolean;
  merchant_id: string;
  imagePath: string | null;
  product_id: string;
  ifood_category_id: string | null;
  ifood_category_name: string | null;
  description: string | null;
  updated_at: string;
}

interface ApiProduct {
  id: string;
  name: string;
  description: string;
  status: string;
  productId: string;
  imagePath: string;
  price: {
    value: number;
  };
  categoryName?: string;  // Adicionado pela nossa lógica
  categoryId?: string;    // ID da categoria
}

interface ServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  total_products?: number;
  new_products?: number;
  updated_products?: number;
}

interface CreateCategoryRequest {
  id: string;
  name: string;
  externalCode: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  index: number;
  template: 'DEFAULT' | 'PIZZA' | 'COMBO';
}

interface CreateCategoryResponse {
  success: boolean;
  data?: {
    categoryId: string;
    merchantId: string;
    catalogId: string;
    name?: string;
  };
  error?: string;
}

export class IFoodProductService {
  private supabase: SupabaseClient;
  private readonly IFOOD_API_BASE_URL = 'https://merchant-api.ifood.com.br';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Sincronizar produtos seguindo o fluxo especificado:
   * 1. Buscar token no banco
   * 2. Buscar merchant_id no banco
   * 3. Buscar catalog_id da API do iFood
   * 4. Buscar produtos da API do iFood
   * 5. Salvar produtos no banco
   */
  async syncProducts(userId: string, accessToken?: string): Promise<ServiceResponse> {
    try {
      console.log(`🛍️ [PRODUCT SYNC] Iniciando sincronização de produtos para usuário: ${userId}`);

      // 1. Buscar token de acesso no banco de dados
      let token = accessToken;
      if (!token) {
        console.log('🔍 [STEP 1] Buscando token de acesso no banco de dados...');
        console.log('🔍 [TOKEN QUERY] user_id procurado:', userId);
        
        const { data: tokenData, error: tokenError } = await this.supabase
          .from('ifood_tokens')
          .select('access_token, client_id, created_at, token_updated_at')
          .eq('user_id', userId)
          .single();

        console.log('📊 [TOKEN RESULT] Token encontrado:', !!tokenData);
        console.log('📊 [TOKEN RESULT] Client ID:', tokenData?.client_id || 'N/A');
        console.log('❌ [TOKEN ERROR] Erro:', tokenError?.message || 'Nenhum');
        
        if (tokenError || !tokenData?.access_token) {
          console.error('❌ [TOKEN FAILURE] Token não encontrado para user_id:', userId);
          console.error('❌ [TOKEN FAILURE] Erro detalhado:', tokenError);
          return {
            success: false,
            error: 'Token de acesso não encontrado. Faça login no iFood primeiro.'
          };
        }

        token = tokenData.access_token;
        console.log('✅ [TOKEN SUCCESS] Token obtido, tamanho:', token?.length || 0);
        console.log('✅ [STEP 1] Token encontrado no banco de dados');
      }

      // 2. Buscar merchant_id no banco de dados
      console.log('🔍 [STEP 2] Buscando merchants no banco de dados...');
      const { data: merchants, error: merchantsError } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id, name, client_id')
        .eq('user_id', userId);

      if (merchantsError || !merchants || merchants.length === 0) {
        return {
          success: false,
          error: 'Nenhum merchant encontrado. Sincronize as lojas primeiro.'
        };
      }

      console.log(`✅ [STEP 2] ${merchants.length} merchants encontrados no banco`);

      let totalProducts = 0;
      let newProducts = 0;
      let updatedProducts = 0;

      // Processar cada merchant
      for (const merchant of merchants) {
        try {
          console.log(`🔄 [PROCESSING] Merchant: ${merchant.name} (${merchant.merchant_id})`);
          
          const result = await this.processMerchantProducts(
            merchant.merchant_id, 
            merchant.client_id,
            token!
          );

          totalProducts += result.total || 0;
          newProducts += result.new || 0;
          updatedProducts += result.updated || 0;

        } catch (error) {
          console.error(`❌ [ERROR] Merchant ${merchant.merchant_id}:`, error);
          continue;
        }
      }

      console.log(`✅ [PRODUCT SYNC] Sincronização concluída:`, {
        totalProducts,
        newProducts,
        updatedProducts
      });

      return {
        success: true,
        data: {
          merchants_processed: merchants.length,
          total_products: totalProducts,
          new_products: newProducts,
          updated_products: updatedProducts
        },
        total_products: totalProducts,
        new_products: newProducts,
        updated_products: updatedProducts
      };

    } catch (error: any) {
      console.error('❌ [PRODUCT SYNC] Erro geral na sincronização:', error);
      return {
        success: false,
        error: error.message || 'Erro interno ao sincronizar produtos'
      };
    }
  }

  /**
   * Processar produtos de um merchant específico seguindo o fluxo:
   * 3. Buscar catalog_id da API do iFood v2.0
   * 4. Buscar categorias e produtos da API do iFood v2.0
   * 5. Salvar produtos no banco
   */
  private async processMerchantProducts(merchantId: string, clientId: string, accessToken: string): Promise<{
    total: number;
    new: number;
    updated: number;
  }> {
    try {
      // 3. Buscar catalog_id da API do iFood v2.0
      console.log(`🔍 [STEP 3] Buscando catálogos do merchant ${merchantId} (v2.0)...`);
      const catalogsUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs`;
      
      let catalogId: string;
      
      try {
        const catalogsResponse = await axios.get(catalogsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        const catalogsData = catalogsResponse.data;
        
        // A API retorna um array de catálogos
        if (!catalogsData || !Array.isArray(catalogsData) || catalogsData.length === 0) {
          console.log(`📭 [STEP 3] Nenhum catálogo encontrado para merchant ${merchantId}`);
          return { total: 0, new: 0, updated: 0 };
        }
        
        // Pegar o primeiro catálogo disponível (geralmente o principal)
        const catalog = catalogsData[0];
        catalogId = catalog.catalogId || catalog.id;
        console.log(`✅ [STEP 3] Catálogo encontrado: ${catalogId} de ${catalogsData.length} catálogo(s) disponível(is)`);
        
      } catch (error: any) {
        console.error(`❌ [STEP 3] Erro ao buscar catálogo v2.0:`, error.response?.data || error.message);
        return { total: 0, new: 0, updated: 0 };
      }

      let allProducts: ApiProduct[] = [];

      // 4. Buscar produtos da API do iFood v2.0 usando o catalogId obtido
      try {
        console.log(`🔍 [STEP 4] Buscando categorias e produtos do catálogo ${catalogId} (v2.0)...`);
        
        const productsUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories?includeItems=true&include_items=true`;
        
        const productsResponse = await axios.get(productsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        const categoriesData = productsResponse.data;
        
        // Extrair produtos de todas as categorias
        if (categoriesData && Array.isArray(categoriesData)) {
          for (const category of categoriesData) {
            if (category.items && category.items.length > 0) {
              // Adicionar categoria a cada produto
              const productsWithCategory = category.items.map((item: any) => ({
                ...item,
                categoryName: category.name || 'Sem categoria'
              }));
              allProducts = allProducts.concat(productsWithCategory);
              console.log(`  📦 Categoria "${category.name || 'Sem nome'}": ${category.items.length} produtos`);
            }
          }
        }

        console.log(`✅ [STEP 4] Total de produtos encontrados: ${allProducts.length}`);

      } catch (error: any) {
        console.error(`❌ [STEP 4] Erro ao buscar produtos do catálogo ${catalogId}:`, error.response?.data || error.message);
        return { total: 0, new: 0, updated: 0 };
      }

      if (allProducts.length === 0) {
        console.log(`📭 [STEP 4] Nenhum produto encontrado para merchant ${merchantId}`);
        return { total: 0, new: 0, updated: 0 };
      }

      console.log(`📦 [STEP 4] Total de produtos encontrados: ${allProducts.length}`);

      // 5. Salvar produtos no banco de dados
      console.log(`💾 [STEP 5] Salvando produtos no banco de dados...`);
      let newCount = 0;
      let updatedCount = 0;

      for (const apiProduct of allProducts) {
        try {
          const product = {
            client_id: clientId,
            item_id: apiProduct.id,
            name: apiProduct.name,
            category: apiProduct.categoryName || null,
            price: apiProduct.price?.value || null,
            is_active: apiProduct.status === 'AVAILABLE',
            merchant_id: merchantId,
            imagePath: apiProduct.imagePath || null,
            product_id: apiProduct.productId || apiProduct.id,
            ifood_category_id: apiProduct.categoryId || null,
            ifood_category_name: apiProduct.categoryName || null,
            description: apiProduct.description || null,
            updated_at: new Date().toISOString()
          };

          // Verificar se produto já existe
          const { data: existingProduct } = await this.supabase
            .from('products')
            .select('id, is_active, price, name, imagePath')
            .eq('item_id', product.item_id)
            .eq('merchant_id', merchantId)
            .single();

          if (existingProduct) {
            // Atualizar se houver mudanças
            if (existingProduct.is_active !== product.is_active || 
                existingProduct.price !== product.price ||
                existingProduct.name !== product.name) {
              
              const { error: updateError } = await this.supabase
                .from('products')
                .update({
                  is_active: product.is_active,
                  price: product.price,
                  name: product.name,
                  description: product.description,
                  imagePath: product.imagePath,
                  ifood_category_id: product.ifood_category_id,
                  ifood_category_name: product.ifood_category_name,
                  updated_at: new Date().toISOString()
                })
                .eq('item_id', product.item_id)
                .eq('merchant_id', merchantId);

              if (updateError) {
                console.error(`❌ [STEP 5] Erro ao atualizar produto ${product.name}:`, updateError);
              } else {
                updatedCount++;
                console.log(`🔄 [STEP 5] Produto atualizado: ${product.name}`);
              }
            }
          } else {
            // Criar novo produto
            const { error: insertError } = await this.supabase
              .from('products')
              .insert(product);

            if (insertError) {
              console.error(`❌ [STEP 5] Erro ao inserir produto ${product.name}:`, insertError);
            } else {
              newCount++;
              console.log(`➕ [STEP 5] Novo produto adicionado: ${product.name}`);
            }
          }

        } catch (error) {
          console.error(`❌ [STEP 5] Erro ao processar produto ${apiProduct.id}:`, error);
          continue;
        }
      }

      console.log(`✅ [STEP 5] Produtos salvos: ${newCount} novos, ${updatedCount} atualizados`);

      return {
        total: allProducts.length,
        new: newCount,
        updated: updatedCount
      };

    } catch (error: any) {
      console.error(`❌ [ERROR] Erro ao processar produtos do merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Criar uma nova categoria no catálogo do iFood
   * Endpoint: POST /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories
   */
  async createCategory(userId: string, merchantId: string, categoryData: Omit<CreateCategoryRequest, 'id'>, accessToken?: string): Promise<CreateCategoryResponse> {
    try {
      console.log(`🏪 [CREATE CATEGORY] Iniciando criação de categoria para merchant: ${merchantId}`);
      console.log(`📝 [CREATE CATEGORY] Dados da categoria:`, categoryData);

      // 1. Usar token fornecido ou buscar no banco
      let token = accessToken;
      
      if (!token) {
        console.log('🔍 [STEP 1] Buscando token de acesso no banco...');
        const { data: tokenData, error: tokenError } = await this.supabase
          .from('ifood_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .single();

        if (tokenError || !tokenData?.access_token) {
          console.error('❌ [TOKEN FAILURE] Token não encontrado para user_id:', userId);
          return {
            success: false,
            error: 'Token de acesso não encontrado. Faça login no iFood primeiro.'
          };
        }

        token = tokenData.access_token;
        console.log('✅ [STEP 1] Token obtido do banco com sucesso');
      } else {
        console.log('✅ [STEP 1] Usando token fornecido via parâmetro');
      }

      // 2. Buscar catalog_id via API do iFood
      console.log('🔍 [STEP 2] Buscando catalog_id do merchant...');
      const catalogsUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs`;
      
      let catalogId: string;
      try {
        const catalogsResponse = await axios.get(catalogsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        const catalogsData = catalogsResponse.data;
        if (!catalogsData || !Array.isArray(catalogsData) || catalogsData.length === 0) {
          return {
            success: false,
            error: 'Nenhum catálogo encontrado para este merchant'
          };
        }

        catalogId = catalogsData[0].catalogId || catalogsData[0].id;
        console.log(`✅ [STEP 2] Catalog ID encontrado: ${catalogId}`);
        
      } catch (error: any) {
        console.error('❌ [STEP 2] Erro ao buscar catálogo:', error.response?.data || error.message);
        return {
          success: false,
          error: 'Erro ao buscar catálogo do merchant'
        };
      }

      // 3. Criar categoria usando merchantId como ID da categoria
      console.log('📦 [STEP 3] Criando categoria no iFood...');
      const createCategoryUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;
      
      // Gerar ID único para a categoria
      const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Criar body com formato correto para a API do iFood
      const requestBody: any = {
        name: categoryData.name,
        status: categoryData.status, // iFood usa AVAILABLE/UNAVAILABLE
        index: categoryData.index,
        template: categoryData.template === 'PIZZA' ? 'PIZZA' : 'DEFAULT' // Apenas DEFAULT ou PIZZA
      };
      
      // Adicionar campos opcionais apenas se fornecidos
      if (categoryData.externalCode) {
        requestBody.externalCode = categoryData.externalCode;
      }

      console.log('🌐 [API REQUEST] URL:', createCategoryUrl);
      console.log('📤 [API REQUEST] Body:', requestBody);

      try {
        const createResponse = await axios.post(createCategoryUrl, requestBody, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        console.log('✅ [STEP 3] Categoria criada com sucesso');
        console.log('📥 [API RESPONSE] Status:', createResponse.status);
        console.log('📥 [API RESPONSE] Data:', createResponse.data);

        // 4. Salvar categoria local para referência futura (opcional)
        try {
          await this.supabase
            .from('ifood_categories')
            .insert({
              category_id: categoryId,
              ifood_category_id: createResponse.data.id, // ID retornado pela API do iFood
              merchant_id: merchantId,
              catalog_id: catalogId,
              name: requestBody.name,
              external_code: requestBody.externalCode,
              status: requestBody.status,
              index: requestBody.index,
              template: requestBody.template,
              sequence_number: createResponse.data.sequence || createResponse.data.index || requestBody.index,
              user_id: userId,
              created_at: new Date().toISOString()
            });

          console.log('💾 [STEP 4] Categoria salva localmente com ID do iFood:', createResponse.data.id);
        } catch (localError) {
          console.warn('⚠️ [STEP 4] Erro ao salvar categoria localmente:', localError);
          // Não falhar por erro local
        }

        return {
          success: true,
          data: {
            categoryId: categoryId,
            merchantId: merchantId,
            catalogId: catalogId,
            name: categoryData.name
          }
        };

      } catch (error: any) {
        console.error('❌ [STEP 3] Erro ao criar categoria:', error.response?.data || error.message);
        console.error('❌ [STEP 3] Detalhes completos do erro:', JSON.stringify(error.response?.data, null, 2));
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Erro ao criar categoria no iFood'
        };
      }

    } catch (error: any) {
      console.error('❌ [CREATE CATEGORY] Erro geral:', error);
      return {
        success: false,
        error: error.message || 'Erro interno ao criar categoria'
      };
    }
  }

  /**
   * Sincronizar todas as categorias do iFood para o banco de dados
   * Busca categorias existentes na API e salva localmente
   */
  async syncCategories(userId: string, merchantId: string, accessToken?: string): Promise<{success: boolean; data?: any; error?: string}> {
    try {
      console.log(`📂 [SYNC CATEGORIES] Iniciando sincronização de categorias para merchant: ${merchantId}`);

      // 1. Usar token fornecido ou buscar no banco
      let token = accessToken;
      if (!token) {
        console.log('🔍 [STEP 1] Buscando token de acesso no banco...');
        const { data: tokenData, error: tokenError } = await this.supabase
          .from('ifood_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .single();

        if (tokenError || !tokenData?.access_token) {
          console.error('❌ [TOKEN FAILURE] Token não encontrado para user_id:', userId);
          return {
            success: false,
            error: 'Token de acesso não encontrado. Faça login no iFood primeiro.'
          };
        }
        token = tokenData.access_token;
        console.log('✅ [STEP 1] Token obtido do banco com sucesso');
      }

      // 2. Buscar catalog_id via API do iFood
      console.log('🔍 [STEP 2] Buscando catalog_id do merchant...');
      const catalogsUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs`;
      
      let catalogId: string;
      try {
        const catalogsResponse = await axios.get(catalogsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        const catalogsData = catalogsResponse.data;
        if (!catalogsData || !Array.isArray(catalogsData) || catalogsData.length === 0) {
          return {
            success: false,
            error: 'Nenhum catálogo encontrado para este merchant'
          };
        }

        catalogId = catalogsData[0].catalogId || catalogsData[0].id;
        console.log(`✅ [STEP 2] Catalog ID encontrado: ${catalogId}`);
      } catch (error: any) {
        console.error('❌ [STEP 2] Erro ao buscar catálogo:', error.response?.data || error.message);
        return {
          success: false,
          error: 'Erro ao buscar catálogo do merchant'
        };
      }

      // 3. Buscar TODAS as categorias da API do iFood
      console.log('📂 [STEP 3] Buscando todas as categorias do catálogo...');
      const categoriesUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;
      
      let allCategories: any[] = [];
      try {
        const categoriesResponse = await axios.get(categoriesUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        allCategories = categoriesResponse.data || [];
        console.log(`✅ [STEP 3] ${allCategories.length} categorias encontradas na API do iFood`);
      } catch (error: any) {
        console.error('❌ [STEP 3] Erro ao buscar categorias:', error.response?.data || error.message);
        return {
          success: false,
          error: 'Erro ao buscar categorias da API do iFood'
        };
      }

      // 4. Sincronizar categorias no banco de dados
      console.log('💾 [STEP 4] Sincronizando categorias no banco de dados...');
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const apiCategory of allCategories) {
        try {
          // Verificar se categoria já existe no banco
          const { data: existingCategory } = await this.supabase
            .from('ifood_categories')
            .select('id, name, status')
            .eq('ifood_category_id', apiCategory.id)
            .eq('merchant_id', merchantId)
            .single();

          if (existingCategory) {
            // Atualizar categoria existente se houver mudanças
            if (existingCategory.name !== apiCategory.name || existingCategory.status !== apiCategory.status) {
              await this.supabase
                .from('ifood_categories')
                .update({
                  name: apiCategory.name,
                  status: apiCategory.status,
                  index: apiCategory.index || 0,
                  template: apiCategory.template || 'DEFAULT',
                  sequence_number: apiCategory.sequence || apiCategory.index || 0,
                  external_code: apiCategory.externalCode,
                  updated_at: new Date().toISOString()
                })
                .eq('ifood_category_id', apiCategory.id)
                .eq('merchant_id', merchantId);

              updatedCount++;
              console.log(`🔄 [STEP 4] Categoria atualizada: ${apiCategory.name}`);
            } else {
              skippedCount++;
              console.log(`⏭️ [STEP 4] Categoria inalterada: ${apiCategory.name}`);
            }
          } else {
            // Criar nova categoria no banco
            const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await this.supabase
              .from('ifood_categories')
              .insert({
                category_id: categoryId,
                ifood_category_id: apiCategory.id,
                merchant_id: merchantId,
                catalog_id: catalogId,
                name: apiCategory.name,
                external_code: apiCategory.externalCode,
                status: apiCategory.status || 'AVAILABLE',
                index: apiCategory.index || 0,
                template: apiCategory.template || 'DEFAULT',
                sequence_number: apiCategory.sequence || apiCategory.index || 0,
                user_id: userId,
                created_at: new Date().toISOString()
              });

            newCount++;
            console.log(`➕ [STEP 4] Nova categoria adicionada: ${apiCategory.name}`);
          }
        } catch (error: any) {
          console.error(`❌ [STEP 4] Erro ao processar categoria ${apiCategory.name}:`, error);
          continue;
        }
      }

      console.log(`✅ [SYNC CATEGORIES] Sincronização concluída:`);
      console.log(`  📊 Total na API: ${allCategories.length}`);
      console.log(`  ➕ Novas: ${newCount}`);
      console.log(`  🔄 Atualizadas: ${updatedCount}`);
      console.log(`  ⏭️ Inalteradas: ${skippedCount}`);

      return {
        success: true,
        data: {
          total: allCategories.length,
          new: newCount,
          updated: updatedCount,
          skipped: skippedCount,
          merchant_id: merchantId,
          catalog_id: catalogId
        }
      };

    } catch (error: any) {
      console.error('❌ [SYNC CATEGORIES] Erro geral:', error);
      return {
        success: false,
        error: error.message || 'Erro interno ao sincronizar categorias'
      };
    }
  }

  /**
   * Buscar itens do catálogo do iFood
   * GET /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/items
   */
  async getItemsFromIfood(userId: string, merchantId: string, categoryId?: string): Promise<ServiceResponse> {
    try {
      console.log(`📦 [GET ITEMS] Buscando itens do iFood para merchant: ${merchantId}`);

      // 1. Buscar token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)  // Corrigido para user_id
        .single();

      if (tokenError || !tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      const token = tokenData.access_token;

      // 2. Buscar catalog_id
      const catalogsUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs`;
      
      const catalogsResponse = await axios.get(catalogsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const catalogsData = catalogsResponse.data;
      if (!catalogsData || !Array.isArray(catalogsData) || catalogsData.length === 0) {
        return {
          success: false,
          error: 'Nenhum catálogo encontrado'
        };
      }

      const catalogId = catalogsData[0].catalogId || catalogsData[0].id;

      // 3. Buscar todos os itens através das categorias (método que funciona)
      const categoriesUrl = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories?includeItems=true&include_items=true`;
      console.log('🌐 [API REQUEST] URL (categories with items):', categoriesUrl);

      const categoriesResponse = await axios.get(categoriesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const categoriesData = categoriesResponse.data || [];
      
      // Extrair todos os itens de todas as categorias
      let allItems: any[] = [];
      for (const category of categoriesData) {
        if (category.items && category.items.length > 0) {
          // Adicionar categoryId e categoryName a cada item
          const itemsWithCategory = category.items.map((item: any) => ({
            ...item,
            categoryId: category.id,
            categoryName: category.name
          }));
          allItems = allItems.concat(itemsWithCategory);
        }
      }
      
      console.log(`✅ [GET ITEMS] ${allItems.length} itens encontrados na API do iFood`);

      // 4. Log detalhado das categorias e itens encontrados
      console.log(`📊 [CATEGORIES] ${categoriesData.length} categorias encontradas:`);
      categoriesData.forEach((cat: any, index: number) => {
        console.log(`  📂 Categoria ${index + 1}: "${cat.name}" (ID: ${cat.id}) - ${cat.items?.length || 0} itens`);
      });

      // 5. Filtrar por categoria se especificado
      let filteredItems = allItems;
      if (categoryId) {
        filteredItems = allItems.filter((item: any) => item.categoryId === categoryId);
        console.log(`📂 [FILTER] ${filteredItems.length} itens na categoria ${categoryId} de ${allItems.length} total`);
        
        // Log dos itens filtrados
        filteredItems.forEach((item: any, index: number) => {
          console.log(`  🍕 Item ${index + 1}: "${item.name}" (ID: ${item.id}) - Status: ${item.status} - CategoryID: ${item.categoryId} - R$ ${item.price?.value || 0}`);
        });
        
        // Debug: mostrar todos os itens e seus categoryIds
        console.log(`🔍 [DEBUG] Todos os itens e suas categorias:`);
        allItems.forEach((item: any, index: number) => {
          console.log(`  📦 Item ${index + 1}: "${item.name}" - CategoryID: ${item.categoryId} - Filtro: ${item.categoryId === categoryId ? 'PASSA' : 'NÃO PASSA'}`);
        });
      } else {
        console.log(`📂 [NO FILTER] Retornando todos os ${allItems.length} itens`);
      }

      // 5. Sincronizar com banco local
      let syncedCount = 0;
      for (const item of filteredItems) {
        try {
          const productData = {
            client_id: userId,
            item_id: item.id,
            name: item.name || item.description || 'Produto iFood',
            category: item.categoryName,
            price: item.price?.value || 0,
            is_active: item.status === 'AVAILABLE',
            merchant_id: merchantId,
            imagePath: item.imagePath || null,
            product_id: item.productId || item.id,
            ifood_category_id: item.categoryId,
            ifood_category_name: item.categoryName,
            description: item.description || '',
            updated_at: new Date().toISOString()
          };

          console.log(`💾 [SYNC ITEM ${syncedCount + 1}] Salvando "${item.name}" - Status iFood: ${item.status} → Local: ${item.status === 'AVAILABLE'}`);

          // Verificar se item já existe
          const { data: existingItem } = await this.supabase
            .from('products')
            .select('id')
            .eq('item_id', item.id)
            .eq('merchant_id', merchantId)
            .single();

          let dbError = null;
          if (existingItem) {
            // Atualizar item existente
            const result = await this.supabase
              .from('products')
              .update(productData)
              .eq('item_id', item.id)
              .eq('merchant_id', merchantId);
            dbError = result.error;
          } else {
            // Inserir novo item
            const result = await this.supabase
              .from('products')
              .insert(productData);
            dbError = result.error;
          }

          if (dbError) {
            console.error(`❌ [SYNC ITEM] Erro ao salvar ${item.name}:`, dbError);
          } else {
            syncedCount++;
            console.log(`✅ [SYNC ITEM] ${item.name} salvo com sucesso`);
          }
        } catch (dbError) {
          console.error(`❌ [SYNC ITEM] Exceção ao sincronizar item ${item.id}:`, dbError);
        }
      }
      
      console.log(`✅ [SYNC] ${syncedCount}/${filteredItems.length} itens sincronizados com sucesso`);

      return {
        success: true,
        data: filteredItems,
        total_products: filteredItems.length
      };

    } catch (error: any) {
      console.error('❌ [GET ITEMS] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erro ao buscar itens'
      };
    }
  }

  /**
   * Criar ou atualizar item - VERSÃO COM UPLOAD DE IMAGEM
   * Fluxo: 1. Upload imagem → 2. Criar/atualizar produto com imagePath
   */
  async createOrUpdateItem(userId: string, merchantId: string, itemData: any): Promise<ServiceResponse> {
    try {
      console.log('🍔 [PRODUTO COM IMAGEM] Recebendo dados:', itemData);

      // 1. Buscar token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData?.access_token) {
        return { success: false, error: 'Token não encontrado' };
      }

      // 2. PRIMEIRO: Upload da imagem se fornecida
      let imagePath = null;
      if (itemData.image && itemData.image.trim() !== '') {
        console.log('📸 [UPLOAD IMAGEM] Fazendo upload da imagem primeiro...');

        const uploadResult = await this.uploadImage(userId, merchantId, {
          image: itemData.image
        });

        if (uploadResult.success) {
          // Extrair o caminho da imagem da resposta do iFood
          imagePath = uploadResult.data?.imagePath || uploadResult.data?.path || uploadResult.data?.url;
          console.log('✅ [UPLOAD IMAGEM] Imagem enviada com sucesso. Caminho:', imagePath);
        } else {
          console.error('❌ [UPLOAD IMAGEM] Erro no upload:', uploadResult.error);
          return {
            success: false,
            error: `Erro no upload da imagem: ${uploadResult.error}`
          };
        }
      } else {
        console.log('📷 [SEM IMAGEM] Produto será criado sem imagem');
      }

      // 3. Validar UUID e forçar geração se necessário
      function isValidUUID(str: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      }

      // Sempre gerar UUID válido para criação, validar para atualização
      let productUuid: string;
      let isUpdate = false;

      if (itemData.item.id && itemData.item.productId && isValidUUID(itemData.item.productId)) {
        // Atualização com UUID válido
        productUuid = itemData.item.productId;
        isUpdate = true;
      } else {
        // Criação ou UUID inválido - sempre gerar novo UUID válido
        productUuid = randomUUID();
        isUpdate = false;
      }

      console.log(`🔍 [OPERATION] ${isUpdate ? 'ATUALIZAÇÃO' : 'CRIAÇÃO'} de produto`);
      console.log(`🔑 [UUID] Usando productId válido: ${productUuid}`);

      // 4. Montar payload com imagePath se disponível
      const ifoodPayload: any = {
        item: {
          productId: productUuid,
          status: itemData.item.status || 'AVAILABLE',
          price: {
            value: itemData.item.price.value
          },
          categoryId: itemData.item.categoryId && isValidUUID(itemData.item.categoryId)
            ? itemData.item.categoryId
            : randomUUID()
        },
        products: [
          {
            id: productUuid,
            name: itemData.products[0].name
          }
        ]
      };

      // Adicionar imagePath ao produto se disponível
      if (imagePath) {
        ifoodPayload.products[0].imagePath = imagePath;
        console.log('🖼️ [IMAGEM ADICIONADA] ImagePath adicionado ao produto:', imagePath);
      }

      // Se é atualização, adicionar o ID do item (validando UUID)
      if (isUpdate && itemData.item.id && isValidUUID(itemData.item.id)) {
        ifoodPayload.item.id = itemData.item.id;
        console.log(`🔄 [UPDATE] Atualizando item existente com ID válido: ${itemData.item.id}`);
      } else if (isUpdate) {
        // Para atualização sem ID válido, usar o próprio productUuid como ID
        ifoodPayload.item.id = productUuid;
        console.log(`🔄 [UPDATE] Usando productUuid como ID do item: ${productUuid}`);
      }

      // Adicionar campos opcionais APENAS se existirem
      if (itemData.item.price.originalValue) {
        ifoodPayload.item.price.originalValue = itemData.item.price.originalValue;
      }

      if (itemData.products[0].description) {
        ifoodPayload.products[0].description = itemData.products[0].description;
      }

      if (itemData.item.externalCode) {
        ifoodPayload.item.externalCode = itemData.item.externalCode;
      }

      console.log('📤 [PRODUTO] Enviando para iFood com imagem:', JSON.stringify(ifoodPayload, null, 2));

      // 5. Enviar para iFood API
      const url = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/items`;
      const response = await axios.put(url, ifoodPayload, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('✅ [PRODUTO] Produto criado/atualizado com sucesso:', response.data);

      // 4. Salvar no banco local
      if (response.data) {
        try {
          const productData = {
            client_id: userId,
            item_id: response.data.item.id, // ID retornado pelo iFood
            name: itemData.products[0].name.trim(),
            category: null, // Será preenchido posteriormente
            price: itemData.item.price.value,
            is_active: itemData.item.status === 'AVAILABLE',
            merchant_id: merchantId,
            imagePath: response.data.products[0]?.imagePath || null,
            product_id: response.data.item.productId, // ProductID retornado pelo iFood
            ifood_category_id: itemData.item.categoryId,
            ifood_category_name: null, // Será preenchido posteriormente
            description: itemData.products[0].description || '',
            updated_at: new Date().toISOString()
          };

          console.log('💾 [DATABASE] Dados para salvar:', JSON.stringify(productData, null, 2));

          let dbResult;
          
          if (isUpdate) {
            // Para atualizações, usar update baseado no item_id original
            dbResult = await this.supabase
              .from('products')
              .update(productData)
              .eq('item_id', itemData.item.id)
              .eq('merchant_id', merchantId);
            
            console.log(`🔄 [DATABASE] Atualizando produto existente com item_id: ${itemData.item.id}`);
          } else {
            // Para criações, usar insert normal
            dbResult = await this.supabase
              .from('products')
              .insert(productData);
            
            console.log(`➕ [DATABASE] Inserindo novo produto`);
          }

          const { data: insertedData, error: dbError } = dbResult;

          if (dbError) {
            console.error('❌ [DATABASE] Erro ao salvar:', dbError);
          } else {
            console.log('✅ [DATABASE] Produto salvo com sucesso no banco local');
            console.log('📊 [DATABASE] Dados inseridos:', insertedData);
          }
        } catch (dbError) {
          console.error('❌ [DATABASE] Exceção ao salvar:', dbError);
        }
      } else {
        console.warn('⚠️ [DATABASE] Nenhum dado retornado pelo iFood para salvar');
      }

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [SIMPLE] Erro:', error.response?.data || error.message);
      
      // Log detalhado do erro para debug
      if (error.response?.data?.error?.details) {
        console.error('❌ [SIMPLE] Detalhes:', error.response.data.error.details);
      }

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Erro interno'
      };
    }
  }

  /**
   * Atualizar preço de item
   * PATCH /catalog/v2.0/merchants/{merchantId}/items/price
   */
  async updateItemPrice(userId: string, merchantId: string, priceData: any): Promise<ServiceResponse> {
    try {
      console.log(`💰 [UPDATE PRICE] Atualizando preço do item: ${priceData.itemId}`);

      // 1. Buscar token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)  // Corrigido para user_id
        .single();

      if (tokenError || !tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      const token = tokenData.access_token;

      // 2. Fazer requisição
      const url = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/items/price`;
      
      const response = await axios.patch(url, priceData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ [UPDATE PRICE] Preço atualizado com sucesso');

      // 3. Atualizar banco local
      try {
        await this.supabase
          .from('products')
          .update({
            price: priceData.price?.value,
            original_price: priceData.price?.originalValue,
            updated_at: new Date().toISOString()
          })
          .eq('item_id', priceData.itemId)
          .eq('merchant_id', merchantId);
      } catch (dbError) {
        console.warn('⚠️ Erro ao atualizar preço localmente:', dbError);
      }

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [UPDATE PRICE] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erro ao atualizar preço'
      };
    }
  }

  /**
   * Atualizar status de item
   * PATCH /catalog/v2.0/merchants/{merchantId}/items/status
   */
  async updateItemStatus(userId: string, merchantId: string, statusData: any): Promise<ServiceResponse> {
    try {
      console.log(`🔄 [UPDATE STATUS] Atualizando status do item: ${statusData.itemId}`);

      // 1. Buscar token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)  // Corrigido para user_id
        .single();

      if (tokenError || !tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      const token = tokenData.access_token;

      // 2. Fazer requisição
      const url = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/items/status`;
      
      const response = await axios.patch(url, statusData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ [UPDATE STATUS] Status atualizado com sucesso');

      // 3. Atualizar banco local
      try {
        await this.supabase
          .from('products')
          .update({
            is_active: statusData.status === 'AVAILABLE',
            updated_at: new Date().toISOString()
          })
          .eq('item_id', statusData.itemId)
          .eq('merchant_id', merchantId);
      } catch (dbError) {
        console.warn('⚠️ Erro ao atualizar status localmente:', dbError);
      }

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [UPDATE STATUS] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erro ao atualizar status'
      };
    }
  }

  /**
   * Atualizar preço de opção
   * PATCH /catalog/v2.0/merchants/{merchantId}/options/price
   */
  async updateOptionPrice(userId: string, merchantId: string, priceData: any): Promise<ServiceResponse> {
    try {
      console.log(`💰 [UPDATE OPTION PRICE] Atualizando preço da opção: ${priceData.optionId}`);

      const { data: tokenData } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (!tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      const url = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/options/price`;
      
      const response = await axios.patch(url, priceData, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [UPDATE OPTION PRICE] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Atualizar status de opção
   * PATCH /catalog/v2.0/merchants/{merchantId}/options/status
   */
  async updateOptionStatus(userId: string, merchantId: string, statusData: any): Promise<ServiceResponse> {
    try {
      console.log(`🔄 [UPDATE OPTION STATUS] Atualizando status da opção: ${statusData.optionId}`);

      const { data: tokenData } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (!tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      const url = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/options/status`;
      
      const response = await axios.patch(url, statusData, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [UPDATE OPTION STATUS] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Upload de imagem
   * POST /catalog/v2.0/merchants/{merchantId}/image/upload
   */
  async uploadImage(userId: string, merchantId: string, imageData: { image: string }): Promise<ServiceResponse> {
    try {
      console.log(`📸 [UPLOAD IMAGE] Fazendo upload de imagem para merchant: ${merchantId}`);

      const { data: tokenData } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (!tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      // Validações do iFood para PRODUTOS
      // 1. Verificar se a imagem foi fornecida
      if (!imageData.image) {
        return {
          success: false,
          error: 'Imagem não fornecida'
        };
      }
      
      // 2. Extrair e validar o formato da imagem (JPG, JPEG, PNG, HEIC)
      let formattedImage = imageData.image;
      const matches = formattedImage.match(/^data:image\/(jpeg|jpg|png|heic);base64,(.+)$/i);
      
      if (!matches) {
        // Se não tem o prefixo data URI, adiciona com tipo padrão
        if (!formattedImage.startsWith('data:image')) {
          formattedImage = `data:image/jpeg;base64,${formattedImage}`;
        } else {
          return {
            success: false,
            error: 'Formato de imagem inválido. Use apenas JPG, JPEG, PNG ou HEIC'
          };
        }
      }
      
      // 3. Validar tamanho (máximo 10MB para produtos)
      try {
        const base64Data = formattedImage.split(',')[1] || formattedImage;
        const buffer = Buffer.from(base64Data, 'base64');
        
        if (buffer.length > 10 * 1024 * 1024) {
          const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
          return {
            success: false,
            error: `Imagem muito grande (${sizeMB}MB). Máximo 10MB para produtos do iFood`
          };
        }
        
        const sizeKB = (buffer.length / 1024).toFixed(2);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        console.log(`📸 [UPLOAD IMAGE] Tamanho da imagem: ${sizeKB}KB (${sizeMB}MB)`);
      } catch (err) {
        console.error('❌ [UPLOAD IMAGE] Erro ao validar tamanho:', err);
      }
      
      const url = `${this.IFOOD_API_BASE_URL}/catalog/v2.0/merchants/${merchantId}/image/upload`;

      const requestBody = { image: formattedImage };
      const requestHeaders = {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      };

      console.log('📤 [UPLOAD IMAGE] Requisição completa para iFood:');
      console.log('🌐 [URL]:', url);
      console.log('📋 [HEADERS]:', {
        'Authorization': `Bearer ${tokenData.access_token?.substring(0, 20)}...`,
        'Content-Type': requestHeaders['Content-Type']
      });
      console.log('📦 [BODY]:', {
        image: `${formattedImage.substring(0, 100)}... (${formattedImage.length} chars)`
      });

      const response = await axios.post(url, requestBody, {
        headers: requestHeaders
      });

      console.log('✅ [UPLOAD IMAGE] Imagem enviada com sucesso');

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [UPLOAD IMAGE] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erro ao fazer upload da imagem'
      };
    }
  }

  /**
   * Ingestão de itens em bulk
   * POST /item/v1.0/ingestion/{merchantId}?reset=false
   */
  async bulkItemIngestion(userId: string, merchantId: string, items: any[], reset: boolean = false): Promise<ServiceResponse> {
    try {
      console.log(`📦 [BULK INGESTION] Enviando ${items.length} itens para merchant: ${merchantId}`);

      const { data: tokenData } = await this.supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (!tokenData?.access_token) {
        return {
          success: false,
          error: 'Token de acesso não encontrado'
        };
      }

      const url = `${this.IFOOD_API_BASE_URL}/item/v1.0/ingestion/${merchantId}?reset=${reset}`;
      
      const response = await axios.post(url, items, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ [BULK INGESTION] ${items.length} itens enviados com sucesso`);

      // Salvar itens localmente
      try {
        const itemsToInsert = items.map(item => ({
          item_id: item.barcode || item.plu,
          merchant_id: merchantId,
          name: item.name,
          description: item.details?.description,
          price: item.prices?.price,
          original_price: item.prices?.promotionPrice,
          status: item.active ? 'AVAILABLE' : 'UNAVAILABLE',
          image_path: item.details?.imageUrl,
          user_id: userId,
          created_at: new Date().toISOString()
        }));

        await this.supabase
          .from('ifood_items')
          .upsert(itemsToInsert);

        console.log('💾 Itens salvos localmente');
      } catch (dbError) {
        console.warn('⚠️ Erro ao salvar itens localmente:', dbError);
      }

      return {
        success: true,
        data: {
          itemsProcessed: items.length,
          response: response.data
        }
      };

    } catch (error: any) {
      console.error('❌ [BULK INGESTION] Erro:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erro na ingestão em bulk'
      };
    }
  }

  /**
   * Get product images from database - method required by server.ts
   */
  async getProductImages(userId: string, merchantId: string): Promise<ServiceResponse> {
    try {
      console.log(`🖼️ [GET IMAGES] Buscando imagens para merchant: ${merchantId}, user: ${userId}`);

      // Buscar produtos com imagens do banco de dados
      const { data: products, error } = await this.supabase
        .from('products')
        .select('item_id, name, imagePath, product_id')
        .eq('client_id', userId)
        .eq('merchant_id', merchantId)
        .not('imagePath', 'is', null);

      if (error) {
        console.error('❌ Erro ao buscar imagens do banco:', error);
        throw error;
      }

      console.log(`📊 [GET IMAGES] Encontradas ${products?.length || 0} imagens no banco`);

      const imageResults = products?.map(product => ({
        item_id: product.item_id,
        product_id: product.product_id,
        name: product.name,
        imagePath: product.imagePath,
        imageUrl: product.imagePath // Compatibilidade com frontend
      })) || [];

      return {
        success: true,
        data: imageResults,
        message: `${imageResults.length} imagens encontradas`
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar product images:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar imagens dos produtos'
      };
    }
  }

}