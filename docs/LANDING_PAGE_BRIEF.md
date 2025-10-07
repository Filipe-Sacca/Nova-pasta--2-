# 🚀 Landing Page iFood Integration Hub - Brief Completo

## 📋 CONTEXTO DO PROJETO

**Projeto**: iFood Integration Hub (Plano Certo Hub)
**Descrição**: Sistema completo de integração com iFood que oferece renovação automática de tokens OAuth2, sincronização de pedidos em tempo real, gestão de cardápio e analytics.

**Stats do Projeto**:
- 12.243 linhas de código backend (Node.js/TypeScript)
- 12.461 linhas de código frontend (React/TypeScript)
- 5.905 arquivos de código
- 21 tabelas especializadas no banco de dados
- Renovação automática de tokens a cada 3 horas
- Polling de pedidos a cada 30 segundos

---

## 🎯 OBJETIVO DA LANDING PAGE

Criar uma landing page moderna e otimizada para **conversão** que apresente o sistema de forma clara e convincente para restaurantes que usam iFood.

**Metas**:
- Taxa de conversão: 3-5%
- Lighthouse Score: 95+
- Load time: < 3 segundos
- Mobile-first e totalmente responsivo

**Público-Alvo**:
- Donos de restaurantes que usam iFood
- Gestores de delivery
- Dark kitchens
- Desenvolvedores buscando API de integração

---

## 🛠️ STACK TECNOLÓGICA

```json
{
  "framework": "React 18.3.1",
  "language": "TypeScript 5.5.3",
  "bundler": "Vite 5.4.1",
  "styling": "Tailwind CSS 3.4.11",
  "animations": "Framer Motion 11.x",
  "icons": "Lucide React",
  "seo": "React Helmet Async"
}
```

**Setup**:
```bash
npm create vite@latest landing-page -- --template react-ts
cd landing-page
npm install tailwindcss framer-motion lucide-react react-helmet-async react-router-dom
npm install -D autoprefixer postcss @types/react @types/react-dom
```

---

## 🎨 DESIGN SYSTEM

### Paleta de Cores
```css
/* Primary (iFood Brand) */
--primary-50:  #fff1f0
--primary-100: #ffe1df
--primary-500: #ff6b35  /* MAIN */
--primary-600: #e84a1a
--primary-900: #863318

/* Secondary (Trust) */
--secondary-500: #004B87  /* MAIN */
--secondary-600: #003a6a

/* Semantic */
--success: #10B981
--warning: #F59E0B
--error: #EF4444

/* Neutrals */
--gray-50:  #F9FAFB
--gray-100: #F3F4F6
--gray-500: #6B7280
--gray-900: #111827
```

### Tipografia
```css
Font: 'Inter', sans-serif

/* Scale */
text-sm:   14px
text-base: 16px
text-lg:   18px
text-xl:   20px
text-2xl:  24px
text-3xl:  30px
text-4xl:  36px
text-5xl:  48px
text-6xl:  60px
text-7xl:  72px

/* Weights */
font-normal:    400
font-medium:    500
font-semibold:  600
font-bold:      700
font-extrabold: 800
```

### Tailwind Config
```typescript
// tailwind.config.ts
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff1f0',
          100: '#ffe1df',
          500: '#ff6b35',
          600: '#e84a1a',
        },
        secondary: {
          500: '#004B87',
          600: '#003a6a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
}
```

---

## 📄 ESTRUTURA E CONTEÚDO DA LANDING

### 1️⃣ HEADER/NAVBAR

**Layout**: Logo + Menu + CTAs

**Conteúdo**:
```
[Logo] iFood Hub

Menu Desktop:
- Recursos
- Como Funciona
- Tecnologia
- Entrar
[Botão] Começar Grátis

Menu Mobile:
☰ Hamburger → Expand com todos os itens
```

**Links**:
- "Recursos" → `#recursos` (scroll suave)
- "Como Funciona" → `#como-funciona`
- "Tecnologia" → `#tecnologia`
- "Entrar" → `https://app.planocertohub.com/auth`
- "Começar Grátis" → `https://app.planocertohub.com/auth/cadastro`

---

### 2️⃣ HERO SECTION

**Badge**: 🚀 Renovação automática a cada 3 horas

**Headline**:
```
Gerencie seu iFood com
Automação Inteligente
```
(Destaque "Automação Inteligente" em laranja #ff6b35)

**Subheadline**:
```
Tokens renovados automaticamente. Pedidos sincronizados.
Cardápio sempre atualizado. Tudo em um único dashboard.
```

**CTAs**:
- Primário: "Começar Grátis" → `/auth/cadastro`
- Secundário: "Ver Demo" → `#demo`

**Trust Indicators**:
- ✅ Sem cartão de crédito
- ⚡ Setup em 5 minutos

**Visual**: Screenshot do dashboard (1920x1080px)

**Floating Cards**:
- Card inferior esquerdo: "Pedidos sincronizados: 100%"
- Card superior direito: "Tokens ativos: ●" (green dot)

---

### 3️⃣ PROBLEMA/SOLUÇÃO

**Título**:
```
Cansado de problemas com a integração iFood?
```

**Subtítulo**:
```
Nós resolvemos as dores mais comuns dos restaurantes
```

**Grid 2 Colunas** (Antes vs Depois):

**ANTES** ❌:
- Tokens expirando constantemente
- Gestão fragmentada em várias plataformas
- Pedidos perdidos por falha de sincronização
- Cardápio desatualizado entre sistemas

**DEPOIS** ✅:
- Renovação automática a cada 3h
- Dashboard unificado e intuitivo
- Sincronização em tempo real (30s)
- Atualização instantânea e automática

**Background**: Fundo cinza claro (#F9FAFB)

---

### 4️⃣ FEATURES (RECURSOS)

**Título**:
```
Recursos que fazem a diferença
```

**Subtítulo**:
```
Tudo que você precisa para gerenciar seu iFood de forma profissional
```

**Grid 3 Colunas** (6 features):

1. **🔄 Renovação Automática de Tokens**
   - Ícone: RefreshCw (azul #3B82F6)
   - Tokens OAuth2 renovados automaticamente a cada 3 horas. Nunca mais se preocupe com expiração.

2. **🛒 Gestão de Pedidos em Tempo Real**
   - Ícone: ShoppingCart (verde #10B981)
   - Polling de 30 segundos garante que nenhum pedido seja perdido. Sincronização perfeita com iFood.

3. **📋 Cardápio e Produtos Sincronizados**
   - Ícone: Menu (roxo #9333EA)
   - 21 tabelas especializadas. Gestão de imagens, complementos, grupos de opções e muito mais.

4. **📊 Analytics e Relatórios**
   - Ícone: BarChart3 (laranja #F97316)
   - Dashboards com métricas em tempo real. Vendas, produtos, desempenho e análises completas.

5. **🕐 Horários e Status**
   - Ícone: Clock (vermelho #EF4444)
   - Controle completo de horários de funcionamento, interrupções e status da loja em tempo real.

6. **⚡ API Completa**
   - Ícone: Zap (amarelo #EAB308)
   - Integração com N8N, webhooks personalizados e automações. Documentação completa disponível.

**Background**: Branco

---

### 5️⃣ COMO FUNCIONA

**Título**:
```
Como funciona?
```

**Subtítulo**:
```
3 passos simples para começar
```

**Layout**: Steps alternados (imagem esquerda/direita)

**Step 1** (imagem à direita):
- Número: 01
- Título: **Conecte**
- Descrição: Insira suas credenciais iFood (Client ID e Client Secret)
- Screenshot: Tela de configuração de credenciais

**Step 2** (imagem à esquerda):
- Número: 02
- Título: **Configure**
- Descrição: Defina suas preferências de sincronização e notificações
- Screenshot: Dashboard de configurações

**Step 3** (imagem à direita):
- Número: 03
- Título: **Automatize**
- Descrição: Deixe o sistema cuidar de tudo automaticamente
- Screenshot: Dashboard principal com dados sincronizados

**Background**: Gradient cinza (#F9FAFB → branco)

---

### 6️⃣ TECH STACK

**Título**:
```
Construído com tecnologias modernas
```

**Subtítulo**:
```
Stack enterprise-grade para máxima confiabilidade
```

**Stats** (grid 4 colunas):
- 📄 Arquivos: **5.905**
- 🖥️ Linhas Backend: **12.243**
- ⚡ Linhas Frontend: **12.461**
- 🗄️ Tabelas DB: **21**

**Grid 4 Colunas** (stack por categoria):

**Frontend**:
- ⚛️ React 18
- 📘 TypeScript
- ⚡ Vite
- 🎨 Tailwind CSS

**Backend**:
- 🟢 Node.js
- 🚂 Express
- 📘 TypeScript
- 🔐 OAuth2

**Database**:
- 🐘 PostgreSQL
- ⚡ Supabase
- 📊 21 Tabelas
- 🔄 Real-time

**Infrastructure**:
- 🌐 API REST
- 🪝 Webhooks
- 🤖 N8N
- 📡 Polling

**Background**: Escuro (#111827) com texto branco

---

### 7️⃣ CTA FINAL

**Background**: Gradient laranja (#ff6b35 → #e84a1a) com pattern de grid

**Título**:
```
Pronto para automatizar seu iFood?
```

**Subtítulo**:
```
Junte-se aos restaurantes que já economizam horas por semana
```

**Benefícios** (com checkmarks verdes):
- ✅ Sem cartão de crédito necessário
- ✅ Setup completo em 5 minutos
- ✅ Suporte por email e documentação
- ✅ Atualizações automáticas incluídas

**CTA**: Botão branco grande
```
Começar Grátis Agora →
```

**Link secundário**: "Ou entre aqui se já tem uma conta"

---

### 8️⃣ FOOTER

**Background**: Escuro (#111827)

**Grid 5 Colunas**:

**Coluna 1** (Logo + Descrição):
- [Logo Branco] iFood Hub
- Automação inteligente para restaurantes que usam iFood. Economize tempo e aumente a eficiência.
- Ícones sociais: GitHub | Twitter | LinkedIn | Email

**Coluna 2 - Produto**:
- Recursos
- Como Funciona
- Tecnologia
- Preços

**Coluna 3 - Recursos**:
- Documentação
- API Reference
- GitHub
- Status

**Coluna 4 - Empresa**:
- Sobre
- Blog
- Contato
- Carreiras

**Coluna 5 - Legal**:
- Privacidade
- Termos
- Cookies

**Bottom Bar**:
```
© 2025 Plano Certo Hub. Todos os direitos reservados.
Feito com ❤️ para restaurantes
```

---

## 🧩 COMPONENTES CÓDIGO

### Button Component
```typescript
// src/components/ui/Button.tsx
interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'white'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  href?: string
  fullWidth?: boolean
  onClick?: () => void
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  fullWidth,
  onClick
}: ButtonProps) {
  const baseClasses = 'font-semibold rounded-lg transition-all inline-flex items-center justify-center'

  const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-secondary-500 hover:bg-secondary-600 text-white',
    outline: 'border-2 border-gray-300 hover:border-primary-500 text-gray-700 hover:text-primary-500',
    white: 'bg-white hover:bg-gray-50 text-primary-600 shadow-lg',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl',
  }

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''}`

  if (href) {
    return <a href={href} className={classes}>{children}</a>
  }

  return <button onClick={onClick} className={classes}>{children}</button>
}
```

### Card Component
```typescript
// src/components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div className={`
      bg-white rounded-xl p-6 shadow-lg border border-gray-100
      ${hover ? 'hover:shadow-2xl transition-shadow duration-300' : ''}
      ${className}
    `}>
      {children}
    </div>
  )
}
```

### Badge Component
```typescript
// src/components/ui/Badge.tsx
interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'warning'
}

export function Badge({ children, variant = 'primary' }: BadgeProps) {
  const variants = {
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
```

### Hero Section
```typescript
// src/components/sections/Hero.tsx
import { ArrowRight, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50 -z-10" />

      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6">
              🚀 Renovação automática a cada 3 horas
            </Badge>

            <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
              Gerencie seu iFood com
              <span className="text-primary-500"> Automação Inteligente</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Tokens renovados automaticamente. Pedidos sincronizados.
              Cardápio sempre atualizado. <strong>Tudo em um único dashboard.</strong>
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" href="/auth/cadastro" className="group">
                Começar Grátis
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </Button>

              <Button size="lg" variant="outline" href="#demo">
                <Play size={20} className="mr-2" />
                Ver Demo
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
              <div>✅ Sem cartão de crédito</div>
              <div>⚡ Setup em 5 minutos</div>
            </div>
          </motion.div>

          {/* Screenshot */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <img
              src="/screenshots/dashboard-hero.png"
              alt="Dashboard"
              className="rounded-2xl shadow-2xl w-full"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
```

---

## 🔗 CONFIGURAÇÃO

### URLs e Links
```typescript
// src/config/constants.ts
const IS_PRODUCTION = import.meta.env.PROD

export const DASHBOARD_URL = IS_PRODUCTION
  ? 'https://app.planocertohub.com'
  : 'http://localhost:5173'

export const LINKS = {
  signup: `${DASHBOARD_URL}/auth/cadastro`,
  login: `${DASHBOARD_URL}/auth`,
  dashboard: DASHBOARD_URL,
  docs: '/docs',
  github: 'https://github.com/seu-repo/ifood-hub',
  support: 'mailto:suporte@planocertohub.com',
}
```

### SEO
```typescript
// src/config/seo.ts
export const SEO = {
  title: 'iFood Integration Hub - Automação Inteligente para Restaurantes',
  description: 'Gerencie seu iFood com automação completa. Tokens renovados automaticamente a cada 3h, pedidos sincronizados em tempo real, cardápio sempre atualizado. Setup em 5 minutos.',
  keywords: [
    'ifood',
    'integração ifood',
    'automação ifood',
    'api ifood',
    'gestão delivery',
    'dashboard restaurante',
    'token ifood',
    'sincronização pedidos',
  ],
  ogImage: '/og-image.png',
  siteUrl: 'https://planocertohub.com',
}
```

### Analytics
```typescript
// src/utils/analytics.ts
export function trackEvent(name: string, data?: any) {
  if (window.gtag) {
    window.gtag('event', name, data)
  }
  console.log('Event:', name, data)
}

export const EVENTS = {
  HERO_CTA: 'hero_cta_clicked',
  DEMO_REQUEST: 'demo_requested',
  FEATURE_CLICK: 'feature_clicked',
  SIGNUP: 'signup_initiated',
}
```

---

## 📦 ASSETS NECESSÁRIOS

### Screenshots (todas em alta resolução)
```
/public/screenshots/
├── dashboard-hero.png          # 1920x1080 - Dashboard principal (Hero)
├── orders-management.png       # 1920x1080 - Gestão de pedidos
├── products-sync.png           # 1920x1080 - Sincronização de produtos
├── analytics-dashboard.png     # 1920x1080 - Analytics
├── connect-credentials.png     # 1280x720  - Step 1: Conectar
├── configure-settings.png      # 1280x720  - Step 2: Configurar
└── automate-system.png         # 1280x720  - Step 3: Automatizar
```

### Logos e Ícones
```
/public/
├── logo.svg                    # Logo colorido (header)
├── logo-white.svg              # Logo branco (footer)
├── favicon.ico                 # 32x32px
├── og-image.png                # 1200x630px (Open Graph para redes sociais)
└── apple-touch-icon.png        # 180x180px
```

---

## 🚀 DEPLOY

### Vercel (Recomendado)
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Variáveis de Ambiente
```env
VITE_DASHBOARD_URL=https://app.planocertohub.com
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

### vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Setup (1 dia)
- [ ] Criar projeto: `npm create vite@latest landing-page -- --template react-ts`
- [ ] Instalar dependências: Tailwind, Framer Motion, Lucide React
- [ ] Configurar Tailwind com cores do projeto
- [ ] Criar estrutura de pastas

### Fase 2: Componentes Base (1 dia)
- [ ] Button (4 variants: primary, secondary, outline, white)
- [ ] Card (com hover effect)
- [ ] Badge (3 variants)
- [ ] Container (wrapper com max-width)

### Fase 3: Layout (1 dia)
- [ ] Header com menu responsivo
- [ ] Footer com links e social
- [ ] Testar navegação mobile

### Fase 4: Seções (3 dias)
- [ ] Hero Section (headline + CTAs + screenshot)
- [ ] Problema/Solução (grid 2 colunas)
- [ ] Features (grid 3 colunas, 6 cards)
- [ ] Como Funciona (3 steps alternados)
- [ ] Tech Stack (stats + grid tecnologias)
- [ ] CTA Final (gradient background)

### Fase 5: Assets (1 dia)
- [ ] Screenshots do dashboard
- [ ] Criar OG image
- [ ] Logo branco para footer
- [ ] Otimizar todas as imagens

### Fase 6: Finalizações (1 dia)
- [ ] SEO (meta tags, sitemap)
- [ ] Performance (lazy load, code splitting)
- [ ] Responsividade (testar 320px → 1920px)
- [ ] Analytics (Google Analytics)

### Fase 7: Deploy (1 dia)
- [ ] Deploy Vercel
- [ ] Configurar domínio
- [ ] Testar produção
- [ ] Validar Lighthouse (meta: 95+)

**Tempo Total Estimado**: 8-10 dias

---

## 📊 MÉTRICAS DE SUCESSO

### Performance
- Lighthouse Score: **95+**
- First Contentful Paint: **< 1.5s**
- Time to Interactive: **< 3s**
- Largest Contentful Paint: **< 2.5s**

### Conversão
- Taxa de conversão: **3-5%**
- Bounce rate: **< 40%**
- Tempo médio: **2-3 min**

### Eventos para Rastrear
- `hero_cta_clicked` - CTA principal
- `demo_requested` - Ver demo
- `feature_explored` - Scroll features
- `signup_initiated` - Click cadastro
- `scroll_depth_75` - Engajamento

---

## 🎯 INSTRUÇÕES PARA IA

**Tarefa**: Implementar landing page completa seguindo esta especificação

**Prioridades**:
1. ✅ Usar exatamente a stack definida (React 18 + TS + Vite + Tailwind)
2. ✅ Implementar todas as 8 seções na ordem correta
3. ✅ Usar as cores exatas do design system (#ff6b35, #004B87)
4. ✅ Garantir responsividade mobile-first (320px → 1920px)
5. ✅ Otimizar performance (lazy load, code splitting)
6. ✅ Adicionar animações suaves com Framer Motion
7. ✅ Implementar SEO correto (meta tags, sitemap)
8. ✅ Testar todos os CTAs e links

**Estrutura de Pastas Obrigatória**:
```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── ProblemSolution.tsx
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── TechStack.tsx
│   │   └── CTAFinal.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Badge.tsx
├── config/
│   ├── constants.ts
│   └── seo.ts
└── styles/
    └── globals.css
```

**Fluxo de Conversão**:
```
Landing → CTA "Começar Grátis" → /auth/cadastro (dashboard)
```

**Não esquecer**:
- [ ] Adicionar favicon
- [ ] Criar robots.txt
- [ ] Adicionar sitemap.xml
- [ ] Configurar og:image
- [ ] Testar em mobile/tablet/desktop

---

**Documento**: Landing Page Brief Completo
**Versão**: 1.0
**Data**: 2025-01-01
**Caracteres**: ~14.500
