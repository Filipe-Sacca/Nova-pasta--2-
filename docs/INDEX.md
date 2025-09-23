# 📚 Índice da Documentação - Plano Certo Hub

## 🏠 Documentação Principal
- [README.md](./README.md) - Visão geral do projeto
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura completa do sistema
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Guia de instalação e configuração

## 📦 Módulos do Sistema
Documentação detalhada de cada módulo implementado:

### [/modules/merchant/](./modules/merchant/)
- Gestão do estabelecimento
- Status e horários de funcionamento
- Configurações financeiras

### [/modules/catalog/](./modules/catalog/)
- Gestão de produtos e cardápio
- Categorias e modificadores
- Controle de preços e disponibilidade

### [/modules/events/](./modules/events/)
- Sistema de eventos e polling
- Processamento e deduplicação
- Handlers especializados

## 🚀 Homologação iFood
Documentação do processo de homologação:

### [/homologation/](./homologation/)
- Status de implementação dos módulos core do sistema

## 🔧 Implementação Técnica
Guias técnicos e implementações específicas:

### [/implementation/](./implementation/)
- [OPENING_HOURS_IMPLEMENTATION_SUMMARY.md](./implementation/OPENING_HOURS_IMPLEMENTATION_SUMMARY.md) - Implementação de horários
- [VIRTUAL_BAG_IMPLEMENTATION.md](./implementation/VIRTUAL_BAG_IMPLEMENTATION.md) - Virtual Bag para Groceries
- [LOG_CLEANUP_SETUP.md](./implementation/LOG_CLEANUP_SETUP.md) - Configuração de limpeza de logs

## 🗄️ Banco de Dados
Documentação do banco de dados:

### [/database/](./database/)
- [supabasedocs.md](./database/supabasedocs.md) - Documentação do Supabase

## 📁 Estrutura de Pastas

```
docs/
├── README.md                 # Visão geral
├── ARCHITECTURE.md           # Arquitetura
├── SETUP_GUIDE.md           # Instalação
├── INDEX.md                 # Este arquivo
│
├── modules/                 # Módulos principais
│   ├── merchant/
│   ├── catalog/
│   └── events/
│
├── homologation/           # Processo de homologação
│   └── HOMOLOGACAO_IFOOD_STATUS.md  # Documento único consolidado
│
├── implementation/         # Guias técnicos
│   ├── OPENING_HOURS_IMPLEMENTATION_SUMMARY.md
│   ├── VIRTUAL_BAG_IMPLEMENTATION.md
│   └── LOG_CLEANUP_SETUP.md
│
├── database/              # Banco de dados
│   └── supabasedocs.md
│
└── _archive/             # Documentos arquivados
    └── [documentos obsoletos]
```

## 🔍 Como Navegar

### Por Funcionalidade
- **Começando**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **Entendendo o Sistema**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Módulos Específicos**: [/modules/](./modules/)

### Por Fase do Projeto
1. **Instalação**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. **Desenvolvimento**: [/modules/](./modules/) e [/implementation/](./implementation/)
3. **Homologação**: [/homologation/](./homologation/)
4. **Produção**: [README.md](./README.md#deploy-em-produção)

### Por Tipo de Usuário
- **Desenvolvedor**: Foque em [/modules/](./modules/) e [/implementation/](./implementation/)
- **DevOps**: Veja [SETUP_GUIDE.md](./SETUP_GUIDE.md) e [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Gerente de Projeto**: Consulte [/homologation/](./homologation/) e [README.md](./README.md)
- **Novo na Equipe**: Comece com [README.md](./README.md) → [ARCHITECTURE.md](./ARCHITECTURE.md) → [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## 📝 Convenções de Documentação

- **README.md**: Visão geral e introdução de cada módulo
- **Detalhes Técnicos**: Especificações de API, schemas de banco
- **Guias Práticos**: Passo-a-passo para implementações
- **Status**: Documentos de acompanhamento e checklist

## 🔄 Manutenção da Documentação

- Documentação atualizada em: **Setembro 2024**
- Versão: **2.0.0**
- Próxima revisão: **Outubro 2024**

---

💡 **Dica**: Use `Ctrl+F` para buscar rapidamente por palavras-chave neste índice.