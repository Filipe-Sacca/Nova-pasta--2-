
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  UtensilsCrossed, 
  Edit, 
  Image,
  DollarSign,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Store,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Upload,
  ToggleLeft,
  ToggleRight,
  XCircle,
  TrendingDown
} from 'lucide-react';
// Removido useClients - agora usa merchants diretamente
import { FilterBar } from '@/components/ui/filter-bar';
import { useMerchantProducts, useAvailableMerchants } from '@/hooks/useMerchantProducts';
import { useIfoodTokens } from '@/hooks/useIfoodTokens';
import { useAuth } from '@/App';

// Helper function to normalize status
const isProductActive = (status: any): boolean => {
  if (typeof status === 'boolean') return status;
  if (typeof status === 'string') {
    return status === 'AVAILABLE' || status === 'true';
  }
  return false;
};

export const MenuManagement = () => {
  // Agora usa merchants disponíveis em vez de clients baseados em user_id
  const { user } = useAuth();
  const { tokens, getTokenForUser } = useIfoodTokens();

  // DEBUG: Teste direto do Supabase
  useEffect(() => {
    const testSupabaseConnection = async () => {
      console.log('🧪 [DEBUG] Testando conexão direta com Supabase...');

      try {
        const { data, error } = await supabase
          .from('ifood_tokens')
          .select('*')
          .limit(5);

        console.log('🧪 [DEBUG] Teste direto do Supabase:', {
          data,
          error,
          dataLength: data?.length || 0,
          user: user
        });

        if (data && data.length > 0) {
          console.log('🧪 [DEBUG] Primeiro token encontrado:', data[0]);
        }
      } catch (err) {
        console.error('🧪 [DEBUG] Erro no teste direto:', err);
      }
    };

    // Executar teste apenas uma vez após componente montar
    if (user) {
      testSupabaseConnection();
    }
  }, [user]);
  const [selectedClient, setSelectedClient] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // Estados para criação de categoria
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    externalCode: '',
    status: 'AVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE',
    index: 0,
    template: 'DEFAULT' as 'DEFAULT' | 'PIZZA' | 'COMBO'
  });

  // Estados para gerenciar categorias existentes
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [selectedMerchantForCategories, setSelectedMerchantForCategories] = useState('');
  
  // Estados para gerenciar itens do cardápio
  const [isCreateItemOpen, setIsCreateItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    price: '',
    originalPrice: '',
    status: 'AVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE',
    externalCode: '',
    imagePath: ''
  });
  
  // Estado para gerenciar produtos vinculados à categoria
  const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState<any>(null);
  const [isProductManagementOpen, setIsProductManagementOpen] = useState(false);
  const [categoryItems, setCategoryItems] = useState<any[]>([]);
  
  // Estados para upload de imagem
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // Estado para o modal de adicionar/editar produto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Estado para imagens dos produtos
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  
  // Estados para grupos de complementos
  const [optionGroups, setOptionGroups] = useState<any[]>([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    name: '',
    min: 0,
    max: 1,
    type: 'RADIO' as 'RADIO' | 'CHECKBOX'
  });

  // Estado para modal de atualização de preço
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceUpdateData, setPriceUpdateData] = useState({
    itemId: '',
    itemName: '',
    currentPrice: '',
    newPrice: ''
  });

  // Estado para aba de edição individual de produto
  const [isEditSingleProductOpen, setIsEditSingleProductOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<any>(null);
  const [editProductForm, setEditProductForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    status: 'AVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE'
  });
  
  // Usar o novo hook para buscar produtos das lojas do usuário
  // selectedClient agora ativa o smart-sync sob demanda
  // Usar novo hook baseado em merchant_id
  const { products, stats, isLoading, error, forceRefresh, lastUpdated, isRefetching, sync } = useMerchantProducts(selectedClient);

  // Buscar merchants disponíveis
  const { data: availableMerchants } = useAvailableMerchants();

  // Função simplificada para processar imagens dos produtos
  const processProductImages = () => {
    console.log('🖼️ Processando imagens dos produtos...');
    const imageMap: Record<string, string> = {};

    products.forEach((product) => {
      const imagePath = product.imagePath || (product as any).image_path || (product as any).imageUrl;

      if (imagePath) {
        // Se já é uma URL completa, usar diretamente
        if (imagePath.startsWith('http')) {
          imageMap[product.id] = imagePath;
        } else {
          // Se é um path do iFood, montar a URL completa
          imageMap[product.id] = `https://static-images.ifood.com.br/image/upload/${imagePath}`;
        }
        console.log(`✅ Imagem configurada para ${product.name}: ${imageMap[product.id]}`);
      } else {
        console.log(`⚠️ Sem imagem para ${product.name} (id: ${product.id})`);
      }
    });

    console.log('🖼️ Total de imagens processadas:', Object.keys(imageMap).length);
    setProductImages(imageMap);
  };

  // Buscar categorias quando merchant for selecionado
  useEffect(() => {
    if (selectedClient) {
      fetchCategories(selectedClient);
      setSelectedMerchantForCategories(selectedClient);
    }
  }, [selectedClient]);

  // Atualizar imagens quando produtos mudarem
  useEffect(() => {
    if (products.length > 0) {
      processProductImages();
    }
  }, [products]);

  // Remover dados mock
  // const menuItems = [
  //   {
  //     id: '1',
  //     name: 'Pizza Margherita Grande',
  //     category: 'Pizzas',
  //     price: 32.90,
  //     originalPrice: 32.90,
  //     description: 'Pizza tradicional com molho de tomate, mussarela e manjericão fresco',
  //     isActive: true,
  //     hasPhoto: true,
  //     lastUpdate: '2024-01-15',
  //     status: 'published'
  //   },
  //   {
  //     id: '2',
  //     name: 'Hambúrguer Especial',
  //     category: 'Hambúrgueres',
  //     price: 28.50,
  //     originalPrice: 28.50,
  //     description: 'Hambúrguer artesanal com carne 180g, queijo, alface, tomate',
  //     isActive: true,
  //     hasPhoto: false,
  //     lastUpdate: '2024-01-14',
  //     status: 'draft'
  //   },
  //   {
  //     id: '3',
  //     name: 'Lasanha Bolonhesa',
  //     category: 'Massas',
  //     price: 42.00,
  //     originalPrice: 39.90,
  //     description: 'Lasanha tradicional com molho bolonhesa e queijo gratinado',
  //     isActive: false,
  //     hasPhoto: true,
  //     lastUpdate: '2024-01-13',
  //     status: 'published'
  //   }
  // ];

  // const categories = [
  //   { name: 'Pizzas', items: 12, active: 10 },
  //   { name: 'Hambúrgueres', items: 8, active: 7 },
  //   { name: 'Massas', items: 6, active: 5 },
  //   { name: 'Bebidas', items: 15, active: 15 },
  //   { name: 'Sobremesas', items: 4, active: 3 }
  // ];

  // Remover handleSyncWithIfood simulado
  // const handleSyncWithIfood = async () => {
  //   setSyncStatus('syncing');
  //   // Simular sincronização
  //   setTimeout(() => {
  //     setSyncStatus('success');
  //     setTimeout(() => setSyncStatus('idle'), 2000);
  //   }, 2000);
  // };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-800">Publicado</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Rascunho</Badge>;
      case 'inactive':
        return <Badge variant="outline">Inativo</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const filteredClients = availableMerchants || [];

  // Determinar o user_id correto
  const getCurrentUserId = () => {
    // Usar sempre o user_id correto do token disponível
    if (tokens && tokens.length > 0) {
      const firstToken = tokens[0];
      console.log('🎯 Usando user_id correto do token:', firstToken.user_id);
      return firstToken.user_id;
    }
    
    // Se não tem tokens, usar o user_id correto conhecido
    console.warn('⚠️ Nenhum token encontrado, usando user_id conhecido');
    return 'c1488646-aca8-4220-aacc-00e7ae3d6490'; // user_id correto baseado no check
  };

  // Função auxiliar para obter o token de acesso do iFood
  const getIfoodAccessToken = () => {
    // Client Secret configurado para busca de token
    const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

    // DEBUG: Verificar o estado dos tokens
    console.log('🔍 [DEBUG] Estado dos tokens:', {
      tokensArray: tokens,
      tokensLength: tokens?.length || 0,
      hasTokens: !!tokens && tokens.length > 0
    });

    // DEBUG: Log de todos os client_secrets disponíveis
    if (tokens && tokens.length > 0) {
      console.log('🔍 [DEBUG] Client secrets disponíveis:');
      tokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.client_secret} (user: ${token.user_id})`);
      });
    }

    // Buscar token por client_secret específico
    const tokenByClientSecret = tokens?.find(t => t.client_secret === TARGET_CLIENT_SECRET);
    if (tokenByClientSecret?.access_token && TARGET_CLIENT_SECRET) {
      console.log('🔑 Token do iFood encontrado por client_secret:', TARGET_CLIENT_SECRET);
      return tokenByClientSecret.access_token;
    }

    console.log('⚠️ [DEBUG] Token por client_secret não encontrado. Tentando fallbacks...');

    // Fallback: buscar por user_id (comportamento anterior)
    const userToken = tokens?.find(t => t.user_id === user?.id);
    if (userToken?.access_token) {
      console.log('🔑 Token do iFood encontrado para o usuário (fallback)');
      return userToken.access_token;
    }

    // Se não encontrar por user_id, pegar o primeiro token disponível
    const firstToken = tokens?.[0];
    if (firstToken?.access_token) {
      console.log('🔑 Usando primeiro token do iFood disponível (fallback)');
      console.log('🔍 Client secrets disponíveis:', tokens?.map(t => t.client_secret));
      return firstToken.access_token;
    }

    console.warn('⚠️ Nenhum token do iFood encontrado');
    console.warn('🔍 Tokens disponíveis:', tokens?.length || 0);
    return '';
  };

  // Função para buscar categorias existentes
  const fetchCategories = async (merchantId: string) => {
    if (!merchantId) return;

    setIsLoadingCategories(true);
    try {
      const accessToken = getIfoodAccessToken();
      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCategories(result.data || []);
        console.log(`✅ ${result.count || 0} categorias encontradas para merchant: ${merchantId}`);
      } else {
        console.error('❌ Erro ao buscar categorias:', result.error);
        setCategories([]);
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar categorias:', error);
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // Função para buscar itens de uma categoria específica
  const fetchCategoryItems = async (categoryId: string, forceSync: boolean = false) => {
    if (!selectedClient) return;

    try {
      const accessToken = getIfoodAccessToken();

      // Na primeira vez que abre o dialog, sincronizar com iFood
      const syncParam = forceSync || categoryItems.length === 0 ? '&sync=true' : '';

      const response = await fetch(
        `http://localhost:8093/merchants/${selectedClient}/items?category_id=${categoryId}${syncParam}`, 
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setCategoryItems(result.data || []);
        if (result.synced) {
          console.log(`🔄 Sincronizado com iFood: ${result.data?.length || 0} itens`);
          toast.success(`✅ Sincronizado ${result.data?.length || 0} itens do iFood`);
        } else {
          console.log(`✅ ${result.data?.length || 0} itens encontrados localmente`);
        }
      } else {
        console.error('❌ Erro ao buscar itens da categoria:', result.error);
        setCategoryItems([]);
        toast.error('Erro ao buscar produtos da categoria');
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar itens da categoria:', error);
      setCategoryItems([]);
      toast.error('Erro ao conectar com o servidor');
    }
  };

  // Função para criar categoria no iFood
  const handleCreateCategory = async () => {
    if (!selectedClient) {
      toast.error('Selecione uma loja primeiro');
      return;
    }

    if (!categoryForm.name.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    setIsCreatingCategory(true);

    try {
      console.log('🔍 Buscando dados do cliente selecionado:', selectedClient);
      console.log('📋 Lista de merchants disponíveis:', availableMerchants);
      
      // Buscar cliente por ID ou usar o selectedClient diretamente se for um merchantId
      let merchantId: string | null = null;
      
      // Primeiro tentar encontrar o merchant pelo ID
      const merchant = availableMerchants?.find(m => m.merchant_id === selectedClient);
      if (merchant) {
        merchantId = merchant.merchant_id;
        console.log('🏪 Merchant encontrado:', merchant);
        console.log('🏷️ Merchant ID encontrado:', merchantId);
      } else {
        // Usar diretamente o selectedClient como merchantId se não foi encontrado na lista
        merchantId = selectedClient;
        if (merchant) {
          merchantId = merchant.merchant_id;
          console.log('🏪 Merchant encontrado:', merchant);
          console.log('🏷️ Merchant ID encontrado via merchants:', merchantId);
        } else {
          // Como último recurso, tentar usar diretamente se parecer um ID válido
          if (selectedClient && selectedClient !== 'all' && selectedClient.length > 5) {
            merchantId = selectedClient;
            console.log('🏷️ Usando selectedClient diretamente como Merchant ID:', merchantId);
          }
        }
      }

      if (!merchantId) {
        console.error('❌ Dados do cliente:', {
          selectedClient,
          client,
          merchantId,
          merchants: availableMerchants?.map(m => ({ id: m.merchant_id, name: m.name }))
        });
        toast.error(`Não foi possível encontrar o ID do merchant para este cliente.\n\nSelectedClient: ${selectedClient}\nVerifique se:\n1. O cliente tem ID do iFood configurado na aba Clientes\n2. O merchant está sincronizado com o iFood\n3. Tente recarregar a página`);
        return;
      }

      // Buscar token de acesso do usuário
      console.log('🔐 Buscando token de acesso...');

      const accessToken = getIfoodAccessToken();

      if (!accessToken) {
        toast.error(`❌ Nenhum token de acesso válido encontrado.

⚠️ AÇÃO NECESSÁRIA:
1. 🔐 Faça login no iFood primeiro (Página de Tokens)
2. ✅ Certifique-se de que o token foi salvo
3. 🔄 Atualize a página e tente novamente`);
        return;
      }

      console.log('✅ Token obtido, fazendo requisição para criar categoria...');

      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: categoryForm.name,
          externalCode: categoryForm.externalCode || undefined,
          status: categoryForm.status,
          index: categoryForm.index,
          template: categoryForm.template
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('✅ Categoria criada com sucesso no iFood!');
        
        // Resetar formulário
        setCategoryForm({
          name: '',
          externalCode: '',
          status: 'AVAILABLE',
          index: 0,
          template: 'DEFAULT'
        });

        // Fechar modal
        setIsCreateCategoryOpen(false);

        // Atualizar produtos para refletir mudanças
        forceRefresh();
        
        // Atualizar lista de categorias
        fetchCategories(merchantId);
        
      } else {
        // Melhor tratamento de erros específicos
        if (response.status === 400) {
          if (result.error?.includes('catálogo')) {
            toast.error(`❌ Erro no catálogo do merchant:

${result.error}

💡 Possíveis soluções:
1. 🔄 Verifique se o merchant está ativo no iFood
2. 📋 Confirme se há catálogos criados no merchant
3. 🔐 Token pode estar expirado - renove na página de Tokens`);
          } else if (result.error?.includes('Conflict') || result.error?.includes('already exists')) {
            toast.error(`❌ Categoria já existe no iFood!

📦 Nome: "${categoryForm.name}"

💡 Soluções:
• 🔄 Use um nome diferente
• 📋 Verifique as categorias existentes
• ✏️ Modifique o nome e tente novamente`);
          } else {
            toast.error(`❌ Erro de validação: ${result.error || 'Dados inválidos'}`);
          }
        } else if (response.status === 401) {
          toast.error(`❌ Token expirado ou inválido.

🔄 AÇÃO NECESSÁRIA: 
Renove o token na página de Tokens do iFood`);
        } else {
          toast.error(`❌ Erro ao criar categoria (${response.status}): ${result.error || 'Erro desconhecido'}`);
        }
      }

    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      
      if (error.message?.includes('Failed to fetch')) {
        toast.error(`❌ Erro de conexão:

🔗 Não foi possível conectar ao serviço iFood.

💡 Verifique se:
1. 🖥️ O serviço está rodando (porta 8083)
2. 🌐 Sua conexão com a internet
3. 🔄 Tente novamente em alguns segundos`);
      } else {
        toast.error(`❌ Erro inesperado ao criar categoria: ${error.message}`);
      }
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Função para criar/atualizar item
  const handleCreateOrUpdateItem = async () => {
    if (!selectedClient) {
      toast.error('Selecione uma loja primeiro');
      return;
    }

    if (!itemForm.name.trim() || !itemForm.price) {
      toast.error('Nome e preço são obrigatórios');
      return;
    }

    setIsCreatingItem(true);

    try {
      const accessToken = getIfoodAccessToken();

      if (!accessToken) {
        toast.error('❌ Token de acesso não encontrado ou expirado');
        setIsCreatingItem(false);
        return;
      }
      
      const merchantId = selectedClient;

      // Se houver imagem para upload, fazer primeiro
      let imagePath = itemForm.imagePath;
      if (imageFile) {
        const reader = new FileReader();
        const base64Image = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });

        const uploadResponse = await fetch(`http://localhost:8093/merchants/${merchantId}/image/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            image: base64Image
          })
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          imagePath = uploadResult.data?.imagePath || imagePath;
        }
      }

      // Gerar IDs únicos para novo produto ou usar existentes para edição
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 9);
      
      const itemId = editingProduct?.item_id || `item_${timestamp}_${randomString}`;
      const productId = editingProduct?.product_id || `prod_${timestamp}_${randomString}`;

      // Função utilitária para remover campos vazios/undefined
      const removeEmptyFields = (obj: any): any => {
        const cleaned: any = {};
        
        for (const [key, value] of Object.entries(obj)) {
          if (value === null || value === undefined) {
            continue; // Pula campos null/undefined
          }
          
          if (typeof value === 'string' && value.trim() === '') {
            continue; // Pula strings vazias
          }
          
          if (typeof value === 'object' && !Array.isArray(value)) {
            const cleanedObj = removeEmptyFields(value);
            if (Object.keys(cleanedObj).length > 0) {
              cleaned[key] = cleanedObj;
            }
          } else if (Array.isArray(value) && value.length > 0) {
            cleaned[key] = value.map(item => 
              typeof item === 'object' ? removeEmptyFields(item) : item
            );
          } else if (typeof value !== 'object') {
            cleaned[key] = value;
          }
        }
        
        return cleaned;
      };

      // Preparar dados do item conforme estrutura do iFood
      const rawItemData = {
        item: {
          id: itemId,
          productId: productId,
          // Agora category_id JÁ É o ID do iFood!
          categoryId: itemForm.categoryId || selectedCategoryForProducts?.category_id,
          status: itemForm.status,
          price: {
            value: parseFloat(itemForm.price),
            originalValue: parseFloat(itemForm.originalPrice || itemForm.price)
          },
          externalCode: itemForm.externalCode || undefined
        },
        products: [{
          name: itemForm.name,
          description: itemForm.description || '',
          imagePath: imagePath || ''
        }],
        optionGroups: optionGroups // Adicionar os grupos de opções/complementos
      };

      // Filtrar apenas campos preenchidos
      const itemData = removeEmptyFields(rawItemData);

      console.log('📤 Enviando para iFood:', itemData);
      console.log('🔑 Token sendo usado:', accessToken?.substring(0, 20) + '...');
      console.log('🏪 Merchant ID:', merchantId);

      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(itemData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ Erro na resposta:', result);
        console.error('❌ Status:', response.status);
        console.error('❌ Headers:', response.headers);
      }

      if (response.ok && result.success) {
        toast.success(editingProduct ? '✅ Produto atualizado com sucesso!' : '✅ Produto adicionado com sucesso!');
        
        // Resetar formulário
        setItemForm({
          name: '',
          description: '',
          categoryId: selectedCategoryForProducts?.category_id || '',
          price: '',
          originalPrice: '',
          status: 'AVAILABLE',
          externalCode: '',
          imagePath: ''
        });
        setImageFile(null);
        setImagePreview('');
        setEditingProduct(null);
        setOptionGroups([]); // Resetar grupos de opções
        
        // Fechar modal de produto
        setIsProductModalOpen(false);
        setIsCreateItemOpen(false);
        setIsEditItemOpen(false);
        setSelectedItem(null);
        
        // Atualizar lista de produtos da categoria
        if (selectedCategoryForProducts) {
          await fetchCategoryItems(selectedCategoryForProducts.category_id, false);
        }
        
        // Atualizar lista geral
        forceRefresh();
      } else {
        toast.error(`❌ Erro ao ${editingProduct ? 'atualizar' : 'adicionar'} produto: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('Erro ao criar/atualizar produto:', error);
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setIsCreatingItem(false);
    }
  };

  // Função para abrir modal de atualização de preço
  const openPriceModal = (itemId: string, itemName: string, currentPrice: string) => {
    setPriceUpdateData({
      itemId,
      itemName,
      currentPrice,
      newPrice: currentPrice
    });
    setIsPriceModalOpen(true);
  };

  // Função para atualizar preço do item
  const handleUpdateItemPrice = async (itemId: string, newPrice: string) => {
    if (!selectedClient) return;

    try {
      const accessToken = getIfoodAccessToken();
      const merchantId = selectedClient;

      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/items/price`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          itemId: itemId,
          price: {
            value: parseFloat(newPrice)
          }
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('✅ Preço atualizado com sucesso!');
        forceRefresh();
      } else {
        toast.error(`❌ Erro ao atualizar preço: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`❌ Erro: ${error.message}`);
    }
  };

  // Função para atualizar status do item
  const handleUpdateItemStatus = async (itemId: string, newStatus: 'AVAILABLE' | 'UNAVAILABLE') => {
    console.log('🔧 handleUpdateItemStatus chamada:', { itemId, newStatus, selectedClient });

    if (!selectedClient) {
      console.error('❌ Nenhum merchant selecionado');
      toast.error('❌ Nenhum merchant selecionado');
      return;
    }

    try {
      
      const accessToken = getIfoodAccessToken();
      const merchantId = selectedClient;

      console.log('📡 Fazendo requisição para:', `http://localhost:8093/merchants/${merchantId}/items/status`);
      console.log('📦 Payload:', {
        
        itemId: itemId,
        status: newStatus
      });

      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/items/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          
          itemId: itemId,
          status: newStatus
        })
      });

      const result = await response.json();
      console.log('📨 Resposta da API:', { status: response.status, result });

      if (response.ok && result.success) {
        toast.success('✅ Status atualizado com sucesso!');
        forceRefresh();
      } else {
        console.error('❌ Erro na resposta:', result);
        toast.error(`❌ Erro ao atualizar status: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('❌ Erro na requisição:', error);
      toast.error(`❌ Erro: ${error.message}`);
    }
  };

  // Função para lidar com seleção de imagem
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para fazer upload rápido de imagem direto da tabela (usando novo workflow duas etapas separadas)
  const handleQuickImageUpload = async (productId: string, base64Image: string) => {
    if (!selectedClient) return;

    try {
      
      const merchantId = selectedClient;

      // ETAPA 1: Upload da imagem para iFood e armazenamento do path
      toast.loading('📸 Fazendo upload da imagem para iFood...');

      const uploadResponse = await fetch(`http://localhost:8093/merchants/${merchantId}/products/${productId}/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          
          image: base64Image
        })
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao fazer upload da imagem');
      }

      const uploadResult = await uploadResponse.json();

      toast.dismiss();
      toast.loading('🔄 Atualizando produto com a imagem...');

      // ETAPA 2: Atualizar o produto usando o path da imagem armazenado
      const updateResponse = await fetch(`http://localhost:8093/merchants/${merchantId}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Não enviamos a imagem nem user_id aqui, o endpoint PUT irá buscar automaticamente
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao atualizar produto');
      }

      const updateResult = await updateResponse.json();

      toast.dismiss();

      if (updateResult.workflow === 'database-image-path') {
        toast.success('✅ Imagem enviada para iFood e produto atualizado com sucesso!');
        console.log('🎯 Two-step workflow completed:', {
          step1_upload: uploadResult,
          step2_update: updateResult,
          image_path: updateResult.image_path
        });
      } else {
        toast.success('Processo concluído com sucesso!');
      }

      // Recarregar produtos e imagens
      await forceRefresh();
      if (selectedClient) {
        await fetchProductImages(selectedClient);
      }

    } catch (error: any) {
      toast.dismiss();
      toast.error(`Erro ao fazer upload: ${error.message}`);
    }
  };

  // Função para fazer upload de imagem
  const handleUploadImage = async (itemId: string, base64Image: string) => {
    if (!selectedClient) return;

    try {
      
      const accessToken = getIfoodAccessToken();
      const merchantId = selectedClient;

      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          
          item_id: itemId,
          image: base64Image
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('✅ Imagem enviada com sucesso!');
        // Atualizar lista de itens
        if (selectedCategoryForProducts) {
          fetchCategoryItems(selectedCategoryForProducts.category_id);
        }
      } else {
        toast.error(`❌ Erro ao enviar imagem: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`❌ Erro: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6 pt-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 mt-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Gerenciamento de Cardápios
          </h1>
          <p className="text-gray-600">
            Gerencie cardápios das lojas conectadas ao iFood
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => forceRefresh()}
            disabled={isRefetching}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>{isRefetching ? 'Atualizando...' : 'Atualizar Produtos'}</span>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <FilterBar
        selectedClient={selectedClient}
        onClientChange={setSelectedClient}
        selectedPeriod="30d"
        onPeriodChange={() => {}}
        showPeriodFilter={false}
      />

      {selectedClient && (
        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="items">Itens do Cardápio</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Itens do Cardápio</span>
                    <Badge variant="outline" className="text-xs">
                      Auto-sync 5min
                    </Badge>
                  </div>
                  <Dialog open={isCreateItemOpen} onOpenChange={setIsCreateItemOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Criar Novo Item</DialogTitle>
                        <DialogDescription>
                          Adicione um novo item ao cardápio do iFood
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-name">Nome do Item *</Label>
                            <Input
                              id="item-name"
                              value={itemForm.name}
                              onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                              placeholder="Ex: Pizza Margherita"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-category">Categoria *</Label>
                            <Select 
                              value={itemForm.categoryId} 
                              onValueChange={(value) => setItemForm({...itemForm, categoryId: value})}
                            >
                              <SelectTrigger id="item-category">
                                <SelectValue placeholder="Selecione uma categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.category_id} value={cat.category_id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="item-description">Descrição</Label>
                          <Input
                            id="item-description"
                            value={itemForm.description}
                            onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                            placeholder="Descrição detalhada do item"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-price">Preço *</Label>
                            <Input
                              id="item-price"
                              type="number"
                              step="0.01"
                              value={itemForm.price}
                              onChange={(e) => setItemForm({...itemForm, price: e.target.value})}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-original-price">Preço Original</Label>
                            <Input
                              id="item-original-price"
                              type="number"
                              step="0.01"
                              value={itemForm.originalPrice}
                              onChange={(e) => setItemForm({...itemForm, originalPrice: e.target.value})}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-status">Status</Label>
                            <Select 
                              value={itemForm.status} 
                              onValueChange={(value: 'AVAILABLE' | 'UNAVAILABLE') => setItemForm({...itemForm, status: value})}
                            >
                              <SelectTrigger id="item-status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AVAILABLE">Disponível</SelectItem>
                                <SelectItem value="UNAVAILABLE">Indisponível</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-code">Código Externo</Label>
                            <Input
                              id="item-code"
                              value={itemForm.externalCode}
                              onChange={(e) => setItemForm({...itemForm, externalCode: e.target.value})}
                              placeholder="SKU ou código interno"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="item-image">Imagem do Produto</Label>
                          <Input
                            id="item-image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                          />
                          {imagePreview && (
                            <div className="mt-2">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className={`w-32 h-32 object-cover rounded-lg transition-all duration-300 ${
                                  itemForm.status === 'UNAVAILABLE'
                                    ? 'filter grayscale opacity-70'
                                    : ''
                                }`}
                              />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsCreateItemOpen(false);
                              setItemForm({
                                name: '',
                                description: '',
                                categoryId: '',
                                price: '',
                                originalPrice: '',
                                status: 'AVAILABLE',
                                externalCode: '',
                                imagePath: ''
                              });
                              setImageFile(null);
                              setImagePreview('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleCreateOrUpdateItem}
                            disabled={isCreatingItem}
                          >
                            {isCreatingItem ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Criar Item
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <CardDescription>
                  Visualização e gestão do cardápio atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead>Última Atualização</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex items-center justify-center space-x-2">
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            <span>Carregando produtos...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <div className="text-gray-600">Nenhum produto encontrado</div>
                          <p className="text-sm text-gray-500 mt-2">
                            Os produtos das suas lojas aparecerão aqui automaticamente
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <TableCell>
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                              {productImages[product.id] ? (
                                <img
                                  src={productImages[product.id]}
                                  alt={product.name}
                                  className={`w-full h-full object-cover transition-all duration-300 ${
                                    !isProductActive(product.is_active)
                                      ? 'filter grayscale opacity-70'
                                      : ''
                                  }`}
                                  onLoad={() => {
                                    console.log(`✅ Imagem carregada: ${product.name} - ${productImages[product.id]}`);
                                  }}
                                  onError={(e) => {
                                    console.error(`❌ Erro ao carregar imagem: ${product.name} - ${productImages[product.id]}`);
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Image className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500 max-w-xs truncate">
                                {product.description || 'Sem descrição'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {product.category || 'Sem categoria'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <DollarSign className="h-4 w-4 text-gray-500" />
                              <span>
                                {product.price ? `R$ ${product.price.toFixed(2)}` : 'Não informado'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {isProductActive(product.is_active) ? (
                                <Eye className="h-4 w-4 text-green-500" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              )}
                              <Badge 
                                className={
                                  isProductActive(product.is_active) 
                                    ? "bg-green-100 text-green-800" 
                                    : "bg-red-100 text-red-800"
                                }
                              >
                                {isProductActive(product.is_active) ? 'Disponível' : 'Indisponível'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 hover:bg-gray-100"
                                    onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/jpeg,image/jpg,image/png,image/heic';
                                input.onchange = async (e: any) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    // Validações do iFood para PRODUTOS
                                    // 1. Tamanho máximo: 10MB
                                    if (file.size > 10 * 1024 * 1024) {
                                      const fileSizeKB = Math.round(file.size / 1024);
                                      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                                      toast.error(`⚠️ Arquivo muito grande! Seu arquivo tem ${fileSizeMB}MB. Máximo permitido: 10MB`);
                                      return;
                                    }
                                    
                                    // 2. Formato permitido (JPG, JPEG, PNG, HEIC)
                                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
                                    if (!allowedTypes.includes(file.type.toLowerCase())) {
                                      toast.error('❌ Formato inválido! Use apenas JPG, JPEG, PNG ou HEIC');
                                      return;
                                    }
                                    
                                    // 3. Validar dimensões mínimas (300x275px)
                                    const img = document.createElement('img');
                                    img.onload = async () => {
                                      if (img.width < 300 || img.height < 275) {
                                        toast.error(`📏 Imagem muito pequena! Sua imagem tem ${img.width}x${img.height}px. Mínimo: 300x275px`);
                                        URL.revokeObjectURL(img.src);
                                        return;
                                      }
                                      
                                      URL.revokeObjectURL(img.src);
                                      
                                      // Se passou todas as validações, faz o upload
                                      const reader = new FileReader();
                                      reader.onloadend = async () => {
                                        const base64 = reader.result as string;
                                        toast.info('📤 Enviando imagem...');
                                        await handleQuickImageUpload(product.product_id, base64);
                                      };
                                      reader.readAsDataURL(file);
                                    };
                                    
                                    img.onerror = () => {
                                      toast.error('❌ Erro ao processar imagem');
                                      URL.revokeObjectURL(img.src);
                                    };
                                    
                                    // Criar URL temporária para validar dimensões
                                    img.src = URL.createObjectURL(file);
                                  }
                                };
                                input.click();
                              }}
                                  >
                                    <div className="flex items-center space-x-2">
                                      {product.imagePath ? (
                                        <>
                                          <Image className="h-4 w-4 text-green-500" />
                                          <span className="text-sm text-green-600">Sim</span>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="h-4 w-4 text-gray-400" />
                                          <span className="text-sm text-gray-500">Adicionar</span>
                                        </>
                                      )}
                                    </div>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <div className="space-y-2">
                                    <p className="font-semibold text-sm">📸 Especificações iFood - Produtos</p>
                                    <div className="text-xs space-y-1">
                                      <p>✅ Formatos: JPG, JPEG, PNG ou HEIC</p>
                                      <p>📦 Tamanho máximo: 10 MB</p>
                                      <p>📐 Resolução mínima: 300x275 px</p>
                                      <p className="text-green-600 mt-2">✨ Dica: Use imagens de alta qualidade</p>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {new Date(product.updated_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {/* Botões sempre disponíveis */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 hover:border-blue-400 min-w-[80px]"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('🔧 [EDIT] Abrindo edição individual para produto:', product.name);
                                  
                                  setSelectedProductForEdit(product);
                                  setEditProductForm({
                                    name: product.name,
                                    description: product.description || '',
                                    price: product.price?.toString() || '',
                                    categoryId: product.ifood_category_id || '',
                                    status: isProductActive(product.is_active) ? 'AVAILABLE' : 'UNAVAILABLE'
                                  });
                                  setIsEditSingleProductOpen(true);
                                }}
                                title="Gerenciar produtos desta categoria"
                              >
                                <Edit className="h-4 w-4" />
                                <span className="ml-1 text-xs font-medium">Editar</span>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className={
                                  isProductActive(product.is_active) 
                                    ? "bg-white text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                                    : "bg-white text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 hover:border-green-400"
                                }
                                onClick={() => {
                                  console.log('🔘 Botão clicado para produto:', product.name);
                                  console.log('📋 Dados do produto:', {
                                    id: product.id,
                                    item_id: product.item_id,
                                    is_active: product.is_active
                                  });

                                  if (!product.item_id) {
                                    toast.error('❌ Produto não possui item_id válido');
                                    return;
                                  }

                                  const newStatus = isProductActive(product.is_active) ? 'UNAVAILABLE' : 'AVAILABLE';
                                  console.log('🔄 Alterando status para:', newStatus);
                                  handleUpdateItemStatus(product.item_id, newStatus);
                                }}
                                title={isProductActive(product.is_active) ? "Pausar produto" : "Ativar produto"}
                              >
                                {isProductActive(product.is_active) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                <span className="ml-1 text-xs">
                                  {isProductActive(product.is_active) ? 'Pausar' : 'Ativar'}
                                </span>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 hover:border-blue-400"
                                onClick={() => {
                                  openPriceModal(product.item_id, product.name, product.price?.toString() || '0');
                                }}
                                title="Atualizar preço"
                              >
                                <DollarSign className="h-3 w-3" />
                                <span className="ml-1 text-xs">Preço</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Categorias do Cardápio</CardTitle>
                    <CardDescription>
                      Organize os itens do seu cardápio por categorias
                    </CardDescription>
                  </div>
                  
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        console.log('🔍 DEBUG INFO:', {
                          selectedClient,
                          merchants: availableMerchants?.map(m => ({ id: m.merchant_id, name: m.name })),
                          filteredClients: filteredClients?.map(c => ({ id: c.id, name: c.name, ifood_merchant_id: c.ifood_merchant_id }))
                        });
                      }}
                    >
                      Debug Info
                    </Button>
                  )}
                  
                  {/* Botão Nova Categoria */}
                  <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        disabled={!selectedClient || selectedClient === 'all'}
                        className="flex items-center space-x-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Nova Categoria</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Criar Nova Categoria no iFood</DialogTitle>
                        <DialogDescription>
                          Preencha os dados para criar uma nova categoria no seu catálogo do iFood
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid gap-4 py-4">
                        {/* Nome da Categoria */}
                        <div className="grid gap-2">
                          <Label htmlFor="categoryName">Nome da Categoria *</Label>
                          <Input
                            id="categoryName"
                            placeholder="Ex: Pizzas, Bebidas, Sobremesas..."
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                            disabled={isCreatingCategory}
                          />
                        </div>

                        {/* Código Externo */}
                        <div className="grid gap-2">
                          <Label htmlFor="externalCode">Código Externo</Label>
                          <Input
                            id="externalCode"
                            placeholder="Código interno (opcional)"
                            value={categoryForm.externalCode}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, externalCode: e.target.value }))}
                            disabled={isCreatingCategory}
                          />
                          <p className="text-sm text-muted-foreground">
                            Se não informado, será gerado automaticamente
                          </p>
                        </div>

                        {/* Status */}
                        <div className="grid gap-2">
                          <Label htmlFor="status">Status</Label>
                          <Select 
                            value={categoryForm.status} 
                            onValueChange={(value: 'AVAILABLE' | 'UNAVAILABLE') => 
                              setCategoryForm(prev => ({ ...prev, status: value }))
                            }
                            disabled={isCreatingCategory}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AVAILABLE">Disponível</SelectItem>
                              <SelectItem value="UNAVAILABLE">Indisponível</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Índice */}
                        <div className="grid gap-2">
                          <Label htmlFor="index">Ordem de Exibição</Label>
                          <Input
                            id="index"
                            type="number"
                            placeholder="0"
                            value={categoryForm.index}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, index: parseInt(e.target.value) || 0 }))}
                            disabled={isCreatingCategory}
                          />
                          <p className="text-sm text-muted-foreground">
                            Ordem de exibição no cardápio (0 = primeiro)
                          </p>
                        </div>

                        {/* Template */}
                        <div className="grid gap-2">
                          <Label htmlFor="template">Tipo de Template</Label>
                          <Select 
                            value={categoryForm.template} 
                            onValueChange={(value: 'DEFAULT' | 'PIZZA' | 'COMBO') => 
                              setCategoryForm(prev => ({ ...prev, template: value }))
                            }
                            disabled={isCreatingCategory}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DEFAULT">Padrão</SelectItem>
                              <SelectItem value="PIZZA">Pizza</SelectItem>
                              <SelectItem value="COMBO">Combo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateCategoryOpen(false)}
                          disabled={isCreatingCategory}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleCreateCategory}
                          disabled={isCreatingCategory || !categoryForm.name.trim()}
                        >
                          {isCreatingCategory ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Criar Categoria
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {/* Seção de Categorias Existentes */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Categorias do iFood</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!selectedClient) return;
                          
                          setIsLoadingCategories(true);
                          try {
                            
                            const response = await fetch(`http://localhost:8093/merchants/${selectedClient}/categories/sync`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({})
                            });
                            const result = await response.json();
                            
                            if (result.success) {
                              toast.success(`✅ Sincronização concluída!
                              
📊 Resultado:
• Total: ${result.data?.total || 0}
• Novas: ${result.data?.new || 0}
• Atualizadas: ${result.data?.updated || 0}`);
                              fetchCategories(selectedClient);
                            } else {
                              toast.error(`❌ Erro na sincronização: ${result.error}`);
                            }
                          } catch (error: any) {
                            toast.error(`❌ Erro: ${error.message}`);
                          } finally {
                            setIsLoadingCategories(false);
                          }
                        }}
                        disabled={isLoadingCategories || !selectedClient}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingCategories ? 'animate-spin' : ''}`} />
                        Sincronizar iFood
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectedClient && fetchCategories(selectedClient)}
                        disabled={isLoadingCategories || !selectedClient}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingCategories ? 'animate-spin' : ''}`} />
                        Atualizar Lista
                      </Button>
                    </div>
                  </div>

                  {isLoadingCategories ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                      <span>Carregando categorias...</span>
                    </div>
                  ) : categories.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {categories.map((category) => (
                        <Card key={category.id} className="border border-green-200 bg-green-50">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base font-bold text-black">
                                {category.name}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-100">
                                  iFood
                                </Badge>
                                <Badge variant="outline" className="bg-gray-100 text-black font-bold">
                                  {(() => {
                                    const categoryProducts = products.filter(product => {
                                      // Tenta vários campos para compatibilidade
                                      return product.category === category.category_id || 
                                             product.category === category.name ||
                                             product.ifood_category_id === category.category_id ||
                                             product.ifood_category_name === category.name;
                                    });
                                    // Debug log
                                    console.log(`[${category.name}] Category ID: ${category.category_id}, Total products:`, products.length, 'Category products:', categoryProducts.length);
                                    return categoryProducts.length;
                                  })()} itens
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Ativos:</span>
                                  <span className="font-medium text-green-600">
                                    {(() => {
                                      const categoryProducts = products.filter(product => {
                                        return product.category === category.category_id || 
                                               product.category === category.name ||
                                               product.ifood_category_id === category.category_id ||
                                               product.ifood_category_name === category.name;
                                      });
                                      return categoryProducts.filter(product => isProductActive(product.is_active)).length;
                                    })()}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Inativos:</span>
                                  <span className="font-medium text-red-600">
                                    {(() => {
                                      const categoryProducts = products.filter(product => {
                                        return product.category === category.category_id || 
                                               product.category === category.name ||
                                               product.ifood_category_id === category.category_id ||
                                               product.ifood_category_name === category.name;
                                      });
                                      const totalProducts = categoryProducts.length;
                                      const activeProducts = categoryProducts.filter(product => isProductActive(product.is_active)).length;
                                      return totalProducts - activeProducts;
                                    })()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-blue-600">
                                Categoria oficial do iFood
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-green-200">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-white bg-orange-600 border-orange-300 hover:bg-orange-700"
                                  onClick={() => {
                                    setSelectedCategoryForProducts(category);
                                    setIsProductManagementOpen(true);
                                    // Definir a categoria no formulário de item
                                    setItemForm(prev => ({
                                      ...prev,
                                      categoryId: category.category_id
                                    }));
                                    // Buscar itens existentes na categoria
                                    fetchCategoryItems(category.category_id);
                                  }}
                                >
                                  <Package className="h-4 w-4 mr-2" />
                                  Vincular Produtos
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-white bg-orange-600 border-orange-300 hover:bg-orange-700"
                                  onClick={() => {
                                    toast.info(`📊 Detalhes da Categoria

📦 Nome: ${category.name}
📅 Criado: ${new Date(category.created_at).toLocaleDateString('pt-BR')}`);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      {selectedClient ? (
                        <div>
                          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <p>Nenhuma categoria criada ainda</p>
                          <p className="text-sm">Use o botão "Nova Categoria" para começar</p>
                        </div>
                      ) : (
                        <div>
                          <Store className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <p>Selecione uma loja primeiro</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Cardápio</CardTitle>
                <CardDescription>
                  Configure as opções de sincronização e exibição
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ Funcionalidade em Desenvolvimento</h4>
                    <p className="text-sm text-yellow-700">
                      A integração completa com a API Catalog do iFood está sendo desenvolvida. 
                      Em breve você poderá editar preços, descrições, fotos e todas as informações 
                      do cardápio diretamente aqui e sincronizar com o iFood automaticamente.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Sincronização Automática</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">Preços</span>
                          <Badge variant="outline">Em breve</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">Descrições</span>
                          <Badge variant="outline">Em breve</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">Fotos</span>
                          <Badge variant="outline">Em breve</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Recursos Disponíveis</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">Visualização do Cardápio</span>
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">Análise por Categorias</span>
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">Status dos Itens</span>
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!selectedClient && (
        <Card>
          <CardContent className="p-8 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Selecione uma Loja
            </h3>
            <p className="text-muted-foreground mb-4">
              Escolha uma loja conectada ao iFood para gerenciar seu cardápio
            </p>
            {filteredClients.length === 0 && (
              <p className="text-sm text-orange-600">
                Nenhuma loja com iFood conectado encontrada. 
                Verifique as configurações de API na aba "Clientes".
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Gerenciamento de Produtos da Categoria */}
      <Dialog open={isProductManagementOpen} onOpenChange={setIsProductManagementOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Gerenciar Produtos - {selectedCategoryForProducts?.name}
            </DialogTitle>
            <DialogDescription>
              Adicione, edite e gerencie os produtos desta categoria
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Botão para adicionar novo item */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Produtos da Categoria</h3>
              <Button
                onClick={() => {
                  // Resetar o formulário para novo produto
                  setEditingProduct(null);
                  setItemForm({
                    name: '',
                    description: '',
                    categoryId: selectedCategoryForProducts?.category_id || '',
                    price: '',
                    originalPrice: '',
                    status: 'AVAILABLE',
                    externalCode: '',
                    imagePath: ''
                  });
                  setImageFile(null);
                  setImagePreview('');
                  setOptionGroups([]);
                  setShowAddGroup(false);
                  setIsProductModalOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>

            {/* Lista de produtos existentes */}
            <div className="space-y-4">
              {categoryItems.length > 0 ? (
                categoryItems.map((item: any) => (
                  <Card key={item.item_id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{item.name}</h4>
                          <Badge variant={isProductActive(item.is_active) ? 'default' : 'secondary'}>
                            {isProductActive(item.is_active) ? 'Disponível' : 'Indisponível'}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-medium">
                            R$ {parseFloat(item.price || '0').toFixed(2)}
                          </span>
                          {item.original_price && item.original_price !== item.price && (
                            <span className="text-gray-500 line-through">
                              R$ {parseFloat(item.original_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações do item */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProduct(item);
                            setItemForm({
                              name: item.name || '',
                              description: item.description || '',
                              categoryId: selectedCategoryForProducts?.category_id || '',
                              price: item.price || '',
                              originalPrice: item.original_price || item.price || '',
                              status: isProductActive(item.is_active) ? 'AVAILABLE' : 'UNAVAILABLE',
                              externalCode: item.external_code || '',
                              imagePath: item.imagePath || ''
                            });
                            setImageFile(null);
                            setImagePreview('');
                            setIsProductModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 hover:border-blue-400"
                          onClick={() => {
                            openPriceModal(item.item_id, item.name, item.price || '0');
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                          <span className="ml-2">Atualizar Preço</span>
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className={
                            isProductActive(item.is_active)
                              ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                              : "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 hover:border-green-400"
                          }
                          onClick={() => handleUpdateItemStatus(
                            item.item_id, 
                            isProductActive(item.is_active) ? 'UNAVAILABLE' : 'AVAILABLE'
                          )}
                        >
                          {isProductActive(item.is_active) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          <span className="ml-2">
                            {isProductActive(item.is_active) ? 'Pausar' : 'Ativar'}
                          </span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64 = reader.result as string;
                                  handleUploadImage(item.item_id, base64);
                                };
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-8">
                  <div className="text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum produto vinculado a esta categoria</p>
                    <p className="text-sm mt-2">Clique em "Adicionar Produto" para começar</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Ações em lote */}
            {categoryItems.length > 0 && (
              <Card className="p-4 bg-gray-50">
                <h4 className="font-semibold mb-3 dark:text-black">Ações em Lote</h4>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 hover:text-green-800 border-green-600 hover:border-green-700"
                    onClick={() => {
                      if (confirm('Deseja marcar todos os produtos como disponíveis?')) {
                        categoryItems.forEach(item => {
                          if (!isProductActive(item.is_active)) {
                            handleUpdateItemStatus(item.item_id, 'AVAILABLE');
                          }
                        });
                      }
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Disponibilizar Todos
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-700 hover:text-red-800 border-red-600 hover:border-red-700"
                    onClick={() => {
                      if (confirm('Deseja marcar todos os produtos como indisponíveis?')) {
                        categoryItems.forEach(item => {
                          if (isProductActive(item.is_active)) {
                            handleUpdateItemStatus(item.item_id, 'UNAVAILABLE');
                          }
                        });
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Indisponibilizar Todos
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-700 hover:text-blue-800 border-blue-600 hover:border-blue-700"
                    onClick={() => {
                      const percentage = prompt('Aplicar desconto de quantos % em todos os produtos?');
                      if (percentage) {
                        const discount = parseFloat(percentage) / 100;
                        categoryItems.forEach(item => {
                          const currentPrice = parseFloat(item.price || '0');
                          const newPrice = (currentPrice * (1 - discount)).toFixed(2);
                          handleUpdateItemPrice(item.item_id, newPrice);
                        });
                      }
                    }}
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Aplicar Desconto
                  </Button>
                </div>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductManagementOpen(false)}>
              Fechar
            </Button>
            <Button 
              variant="outline"
              onClick={() => fetchCategoryItems(selectedCategoryForProducts?.category_id, false)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Local
            </Button>
            <Button 
              onClick={() => fetchCategoryItems(selectedCategoryForProducts?.category_id, true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar com iFood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Adicionar/Editar Produto */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? 'Atualize as informações do produto no catálogo do iFood' 
                : 'Preencha as informações do novo produto para adicionar ao catálogo do iFood'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                Informações Básicas
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-name">
                    Nome do Produto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="product-name"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                    placeholder="Ex: Pizza Margherita"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-code">
                    Código Externo (SKU)
                  </Label>
                  <Input
                    id="product-code"
                    value={itemForm.externalCode}
                    onChange={(e) => setItemForm({...itemForm, externalCode: e.target.value})}
                    placeholder="Ex: PIZ-001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">
                  Descrição Completa
                </Label>
                <Textarea
                  id="product-description"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                  placeholder="Descreva o produto em detalhes. Ex: Pizza tradicional com molho de tomate fresco, mussarela de búfala e manjericão..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Preços e Disponibilidade */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                Preços e Disponibilidade
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-price">
                    Preço de Venda <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <Input
                      id="product-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({...itemForm, price: e.target.value})}
                      placeholder="0,00"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-original-price">
                    Preço Original (Antes do Desconto)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <Input
                      id="product-original-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.originalPrice}
                      onChange={(e) => setItemForm({...itemForm, originalPrice: e.target.value})}
                      placeholder="0,00"
                      className="pl-10"
                    />
                  </div>
                  {itemForm.originalPrice && itemForm.price && parseFloat(itemForm.originalPrice) > parseFloat(itemForm.price) && (
                    <p className="text-xs text-green-600">
                      Desconto de {((1 - parseFloat(itemForm.price) / parseFloat(itemForm.originalPrice)) * 100).toFixed(0)}%
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-status">
                    Status do Produto
                  </Label>
                  <Select 
                    value={itemForm.status} 
                    onValueChange={(value: 'AVAILABLE' | 'UNAVAILABLE') => setItemForm({...itemForm, status: value})}
                  >
                    <SelectTrigger id="product-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Disponível
                        </div>
                      </SelectItem>
                      <SelectItem value="UNAVAILABLE">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Indisponível
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Ações Rápidas */}
            {editingProduct && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
                  Ações Rápidas
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Botão Atualizar Preço */}
                  <Button
                    type="button"
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 hover:border-blue-400 h-12"
                    onClick={() => {
                      openPriceModal(editingProduct.item_id, editingProduct.name, editingProduct.price?.toString() || '0');
                    }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Atualizar Preço
                  </Button>

                  {/* Botão Ativar/Pausar */}
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-12 ${
                      isProductActive(editingProduct.is_active)
                        ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                        : "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 hover:border-green-400"
                    }`}
                    onClick={() => {
                      const newStatus = isProductActive(editingProduct.is_active) ? 'UNAVAILABLE' : 'AVAILABLE';
                      handleUpdateItemStatus(editingProduct.item_id, newStatus);
                      // Atualizar o estado local para refletir a mudança
                      setEditingProduct(prev => ({
                        ...prev,
                        is_active: newStatus
                      }));
                    }}
                  >
                    {isProductActive(editingProduct.is_active) ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Pausar Produto
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Ativar Produto
                      </>
                    )}
                  </Button>
                </div>

                {/* Status Visual */}
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Status Atual:</span>
                    <Badge 
                      className={
                        isProductActive(editingProduct.is_active)
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }
                    >
                      {isProductActive(editingProduct.is_active) ? (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Disponível
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Pausado
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Preço:</span>
                    <span className="font-semibold text-lg">
                      R$ {editingProduct.price?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Imagem do Produto */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
                Imagem do Produto
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="product-image">
                  Upload de Imagem
                </Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Input
                      id="product-image"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 5MB. Proporção recomendada: 1:1
                    </p>
                  </div>
                  
                  {(imagePreview || itemForm.imagePath) && (
                    <div className="relative">
                      <img
                        src={imagePreview || itemForm.imagePath}
                        alt="Preview"
                        className={`w-24 h-24 object-cover rounded-lg border transition-all duration-300 ${
                          itemForm.status === 'UNAVAILABLE'
                            ? 'filter grayscale opacity-70'
                            : ''
                        }`}
                      />
                      {imagePreview && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview('');
                          }}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* URL da Imagem (alternativa) */}
              <div className="space-y-2">
                <Label htmlFor="product-image-url">
                  Ou URL da Imagem
                </Label>
                <Input
                  id="product-image-url"
                  type="url"
                  value={itemForm.imagePath}
                  onChange={(e) => setItemForm({...itemForm, imagePath: e.target.value})}
                  placeholder="https://exemplo.com/imagem-produto.jpg"
                  disabled={!!imageFile}
                />
              </div>
            </div>

            {/* Grupos de Complementos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                Grupos de Complementos (Opcional)
              </h3>
              
              {/* Lista de grupos existentes */}
              {optionGroups.length > 0 && (
                <div className="space-y-3">
                  {optionGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{group.name}</h4>
                          <p className="text-xs text-gray-500">
                            {group.type === 'RADIO' ? 'Escolha única' : 'Múltipla escolha'} 
                            {group.min > 0 && ` • Mín: ${group.min}`}
                            {group.max > 1 && ` • Máx: ${group.max}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setOptionGroups(optionGroups.filter((_, i) => i !== groupIndex));
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Opções do grupo */}
                      <div className="space-y-2">
                        {group.options?.map((option: any, optionIndex: number) => (
                          <div key={optionIndex} className="flex items-center gap-2 pl-4">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="text-sm">{option.name}</span>
                              {option.price > 0 && (
                                <span className="text-xs text-green-600">
                                  +R$ {parseFloat(option.price).toFixed(2)}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const newGroups = [...optionGroups];
                                newGroups[groupIndex].options = group.options.filter((_: any, i: number) => i !== optionIndex);
                                setOptionGroups(newGroups);
                              }}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                        
                        {/* Adicionar nova opção */}
                        <div className="flex items-center gap-2 pl-4">
                          <Input
                            placeholder="Nome da opção"
                            className="flex-1"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                const [name, price] = input.value.split(',');
                                if (name) {
                                  const newGroups = [...optionGroups];
                                  if (!newGroups[groupIndex].options) {
                                    newGroups[groupIndex].options = [];
                                  }
                                  newGroups[groupIndex].options.push({
                                    name: name.trim(),
                                    price: parseFloat(price?.trim() || '0')
                                  });
                                  setOptionGroups(newGroups);
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <p className="text-xs text-gray-500">Ex: Bacon, 5.00</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Adicionar novo grupo */}
              {!showAddGroup ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddGroup(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Grupo de Complementos
                </Button>
              ) : (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nome do Grupo</Label>
                      <Input
                        placeholder="Ex: Tamanhos, Adicionais"
                        value={newGroupForm.name}
                        onChange={(e) => setNewGroupForm({...newGroupForm, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Seleção</Label>
                      <Select
                        value={newGroupForm.type}
                        onValueChange={(value: 'RADIO' | 'CHECKBOX') => 
                          setNewGroupForm({...newGroupForm, type: value})
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RADIO">Escolha Única</SelectItem>
                          <SelectItem value="CHECKBOX">Múltipla Escolha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Mínimo de Seleções</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newGroupForm.min}
                        onChange={(e) => setNewGroupForm({...newGroupForm, min: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Máximo de Seleções</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newGroupForm.max}
                        onChange={(e) => setNewGroupForm({...newGroupForm, max: parseInt(e.target.value) || 1})}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddGroup(false);
                        setNewGroupForm({ name: '', min: 0, max: 1, type: 'RADIO' });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (newGroupForm.name) {
                          setOptionGroups([...optionGroups, { ...newGroupForm, options: [] }]);
                          setNewGroupForm({ name: '', min: 0, max: 1, type: 'RADIO' });
                          setShowAddGroup(false);
                        }
                      }}
                      disabled={!newGroupForm.name}
                    >
                      Adicionar Grupo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Categoria (não editável após criar) */}
            {selectedCategoryForProducts && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                  Categoria
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Este produto será adicionado à categoria:
                  </p>
                  <p className="font-medium mt-1">{selectedCategoryForProducts.name}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsProductModalOpen(false);
                setEditingProduct(null);
                setItemForm({
                  name: '',
                  description: '',
                  categoryId: selectedCategoryForProducts?.category_id || '',
                  price: '',
                  originalPrice: '',
                  status: 'AVAILABLE',
                  externalCode: '',
                  imagePath: ''
                });
                setImageFile(null);
                setImagePreview('');
                setOptionGroups([]);
                setShowAddGroup(false);
              }}
            >
              Cancelar
            </Button>
            
            <Button 
              onClick={handleCreateOrUpdateItem}
              disabled={isCreatingItem || !itemForm.name || !itemForm.price}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isCreatingItem ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {editingProduct ? 'Atualizando...' : 'Adicionando...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingProduct ? 'Atualizar Produto' : 'Adicionar Produto'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Atualização de Preço */}
      <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Atualizar Preço
            </DialogTitle>
            <DialogDescription>
              Defina o novo preço para <strong>{priceUpdateData.itemName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Preço Atual</Label>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-600 dark:text-gray-300">R$</span>
                <Input
                  id="currentPrice"
                  value={priceUpdateData.currentPrice}
                  disabled
                  className="text-lg font-semibold bg-gray-100 dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newPrice">Novo Preço</Label>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-blue-600">R$</span>
                <Input
                  id="newPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceUpdateData.newPrice}
                  onChange={(e) => setPriceUpdateData(prev => ({
                    ...prev,
                    newPrice: e.target.value
                  }))}
                  className="text-lg font-semibold border-blue-300 focus:border-blue-500"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            {priceUpdateData.newPrice && priceUpdateData.currentPrice !== priceUpdateData.newPrice && (
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Diferença:</span>
                  <span className={`font-semibold ${
                    parseFloat(priceUpdateData.newPrice) > parseFloat(priceUpdateData.currentPrice) 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {parseFloat(priceUpdateData.newPrice) > parseFloat(priceUpdateData.currentPrice) ? '+' : ''}
                    R$ {(parseFloat(priceUpdateData.newPrice) - parseFloat(priceUpdateData.currentPrice)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPriceModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (priceUpdateData.newPrice && !isNaN(parseFloat(priceUpdateData.newPrice))) {
                  handleUpdateItemPrice(priceUpdateData.itemId, priceUpdateData.newPrice);
                  setIsPriceModalOpen(false);
                } else {
                  toast.error('Preço deve ser um número válido');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!priceUpdateData.newPrice || isNaN(parseFloat(priceUpdateData.newPrice))}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Atualizar Preço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aba de Edição Individual de Produto */}
      <Dialog open={isEditSingleProductOpen} onOpenChange={setIsEditSingleProductOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Produto - {selectedProductForEdit?.name}
            </DialogTitle>
            <DialogDescription>
              Edite as informações do produto e altere sua categoria se necessário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
                Informações Básicas
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome do Produto *</Label>
                  <Input
                    id="edit-name"
                    value={editProductForm.name}
                    onChange={(e) => setEditProductForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Digite o nome do produto"
                    className="font-medium"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Preço de Venda *</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-blue-600">R$</span>
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editProductForm.price}
                      onChange={(e) => setEditProductForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                      className="font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição Completa</Label>
                <Textarea
                  id="edit-description"
                  value={editProductForm.description}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o produto detalhadamente"
                  className="min-h-[100px]"
                />
              </div>
            </div>

            {/* Categoria e Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
                Categoria e Disponibilidade
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Categoria *</Label>
                  <Select
                    value={editProductForm.categoryId}
                    onValueChange={(value) => setEditProductForm(prev => ({ ...prev, categoryId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.category_id} value={category.category_id}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status do Produto</Label>
                  <Select
                    value={editProductForm.status}
                    onValueChange={(value) => setEditProductForm(prev => ({ ...prev, status: value as 'AVAILABLE' | 'UNAVAILABLE' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green-500" />
                          Disponível
                        </div>
                      </SelectItem>
                      <SelectItem value="UNAVAILABLE">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4 text-red-500" />
                          Indisponível
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Preview do Status Atual */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
              <h4 className="font-medium mb-3 text-gray-700 dark:text-gray-300">Preview das Alterações</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Nome:</span>
                    <span className="font-medium">{editProductForm.name || 'Não informado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Preço:</span>
                    <span className="font-medium text-blue-600">
                      R$ {editProductForm.price ? parseFloat(editProductForm.price).toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Categoria:</span>
                    <span className="font-medium">
                      {categories.find(cat => cat.category_id === editProductForm.categoryId)?.name || 'Não selecionada'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <Badge className={
                      editProductForm.status === 'AVAILABLE' 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }>
                      {editProductForm.status === 'AVAILABLE' ? 'Disponível' : 'Indisponível'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
                Ações Rápidas
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 hover:border-blue-400 h-12"
                  onClick={() => {
                    if (selectedProductForEdit) {
                      openPriceModal(selectedProductForEdit.item_id, selectedProductForEdit.name, editProductForm.price);
                    }
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Atualizar Preço
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={`h-12 ${
                    editProductForm.status === 'AVAILABLE'
                      ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                      : "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 hover:border-green-400"
                  }`}
                  onClick={() => {
                    const newStatus = editProductForm.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
                    setEditProductForm(prev => ({ ...prev, status: newStatus }));
                    if (selectedProductForEdit) {
                      handleUpdateItemStatus(selectedProductForEdit.item_id, newStatus);
                    }
                  }}
                >
                  {editProductForm.status === 'AVAILABLE' ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Ativar
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-300 hover:border-purple-400 h-12"
                  onClick={() => {
                    if (selectedProductForEdit && editProductForm.categoryId !== selectedProductForEdit.ifood_category_id) {
                      const newCategoryName = categories.find(cat => cat.category_id === editProductForm.categoryId)?.name;
                      if (confirm(`Mover produto "${selectedProductForEdit.name}" para categoria "${newCategoryName}"?`)) {
                        // Implementar mudança de categoria aqui
                        toast.info('Funcionalidade de mudança de categoria será implementada');
                      }
                    }
                  }}
                  disabled={editProductForm.categoryId === selectedProductForEdit?.ifood_category_id}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Mover Categoria
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditSingleProductOpen(false)}
            >
              Cancelar
            </Button>
            
            <Button
              onClick={async () => {
                if (!selectedProductForEdit) return;
                
                try {
                  // Atualizar informações básicas do produto
                  const updateData = {
                    item: {
                      id: selectedProductForEdit.item_id,
                      productId: selectedProductForEdit.product_id,
                      categoryId: editProductForm.categoryId,
                      status: editProductForm.status,
                      price: {
                        value: parseFloat(editProductForm.price),
                        originalValue: parseFloat(editProductForm.price)
                      }
                    },
                    products: [{
                      name: editProductForm.name,
                      description: editProductForm.description
                    }],
                    
                  };

                  const response = await fetch(`http://localhost:8093/merchants/${selectedClient}/items`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData)
                  });

                  if (response.ok) {
                    toast.success('Produto atualizado com sucesso!');
                    setIsEditSingleProductOpen(false);
                    forceRefresh(); // Atualizar lista de produtos
                  } else {
                    toast.error('Erro ao atualizar produto');
                  }
                } catch (error) {
                  toast.error('Erro ao atualizar produto');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!editProductForm.name || !editProductForm.price || !editProductForm.categoryId}
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
