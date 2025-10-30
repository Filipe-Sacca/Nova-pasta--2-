# 🎨 Guia de Design - Financial Plano Certo

Documentação completa do design visual da aplicação Financial Plano Certo para replicação em outros projetos.

---

## 📋 Índice
1. [Logos](#-1-logos)
2. [Login Page](#-2-login-page)
3. [Sidebar](#-3-sidebar)
4. [Header](#-4-header)
5. [Paleta de Cores](#-5-paleta-de-cores)
6. [Componentes Reutilizáveis](#-6-componentes-reutilizáveis)

---

## 🎨 1. Logos

### **Arquivos de Logo Disponíveis**

A aplicação possui **4 versões da logo** localizadas em `/public/`:

1. **`logo.png`** - Logo principal (ícone + texto)
2. **`logo-icon.png`** - Apenas ícone (para favicon, mobile)
3. **`logo-complete.png`** - Logo completa com tagline
4. **`logo-plano-certo.png`** - Logo específica para tela de login

### **Onde Usar Cada Logo**

```tsx
// 📱 Sidebar - Logo completa
<img
  src="/logo.png"
  alt="Plano Certo Logo"
  className="h-12 w-12 object-contain"
/>

// 🔐 Login Page - Logo com destaque
<img
  src="/logo-plano-certo.png"
  alt="Plano Certo"
  className="w-16 h-16 drop-shadow-lg"
/>

// 🌐 Favicon - Apenas ícone
<link rel="icon" type="image/png" href="/logo-icon.png" />

// 📧 Email/Marketing - Logo completa
<img src="/logo-complete.png" alt="Plano Certo" />
```

### **Filtros CSS para Modo Claro/Escuro**

A logo precisa de filtro CSS para se adaptar ao tema claro:

```tsx
<img
  src="/logo.png"
  alt="Plano Certo Logo"
  className="h-12 w-12"
  style={{
    filter: theme === 'light'
      ? 'brightness(0) saturate(100%) invert(27%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(87%)'
      : 'none'
  }}
/>
```

**Explicação do filtro:**
- **Modo claro**: Converte a logo para tons escuros (cinza escuro) para contraste
- **Modo escuro**: Mantém cores originais da logo

### **Tamanhos Recomendados**

| Local | Dimensão | Classe Tailwind |
|-------|----------|-----------------|
| Sidebar | 48x48px | `h-12 w-12` |
| Login Page | 64x64px | `w-16 h-16` |
| Header (se houver) | 40x40px | `h-10 w-10` |
| Favicon | 32x32px | - |
| Mobile Icon | 192x192px | - |

### **Exemplo Completo - Sidebar**

```tsx
<div className="flex items-center">
  {/* Logo com scale aumentado */}
  <img
    src="/logo.png"
    alt="Plano Certo Logo"
    className="h-12 w-12 object-contain flex-shrink-0 scale-[1.75] translate-y-1"
    style={{
      filter: theme === 'light'
        ? 'brightness(0) saturate(100%) invert(27%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(87%)'
        : 'none'
    }}
  />

  {/* Texto ao lado da logo */}
  <div className="flex flex-col">
    <h1 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
      Plano Certo
    </h1>
    <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium tracking-wider leading-none mt-0.5">
      DELIVERY HUB
    </p>
  </div>
</div>
```

### **Exemplo Completo - Login Page**

```tsx
<div className="flex justify-center mb-6">
  <div className="flex items-center gap-6 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl">
    {/* Logo com drop-shadow */}
    <img
      src="/logo-plano-certo.png"
      alt="Plano Certo"
      className="w-16 h-16 drop-shadow-lg"
    />

    {/* Texto da marca */}
    <span className="text-white text-2xl font-bold -ml-8 -mt-2 drop-shadow-lg">
      Plano Certo
    </span>
  </div>
</div>
```

### **Configuração do Favicon**

Adicione no `index.html` ou `public/index.html`:

```html
<head>
  <!-- Favicon padrão -->
  <link rel="icon" type="image/png" sizes="32x32" href="/logo-icon.png" />

  <!-- Apple Touch Icon -->
  <link rel="apple-touch-icon" sizes="180x180" href="/logo-icon.png" />

  <!-- Android Chrome -->
  <link rel="icon" type="image/png" sizes="192x192" href="/logo-icon.png" />

  <!-- Manifest -->
  <link rel="manifest" href="/manifest.json" />
</head>
```

### **Estrutura de Diretório**

```
public/
├── logo.png              # Logo principal (ícone + texto)
├── logo-icon.png         # Apenas ícone
├── logo-complete.png     # Logo completa com tagline
└── logo-plano-certo.png  # Logo para tela de login
```

### **Dica de Otimização**

Para melhor performance, converta logos para **WebP** quando possível:

```bash
# Converter PNG para WebP
cwebp logo.png -q 90 -o logo.webp
```

E use com fallback:

```tsx
<picture>
  <source srcSet="/logo.webp" type="image/webp" />
  <img src="/logo.png" alt="Plano Certo Logo" />
</picture>
```

---

## 🔐 2. Login Page

### **Design Visual**
- **Background**: Gradiente escuro com elementos decorativos blur
- **Card**: Glass morphism (fundo translúcido com backdrop-blur)
- **Cores**: Slate + Indigo/Purple gradient
- **Animações**: Fade-in, hover scale, shadow transitions

### **Estrutura HTML/JSX**

```tsx
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-6">
  {/* 🎨 Elementos Decorativos de Fundo */}
  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
  <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-transparent via-indigo-900/5 to-transparent"></div>

  {/* 🎯 Card de Login */}
  <div className="w-full max-w-md relative z-10">
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 space-y-6">

      {/* Logo centralizada */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-6 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl">
          <img src="/logo-plano-certo.png" alt="Plano Certo" className="w-16 h-16 drop-shadow-lg" />
          <span className="text-white text-2xl font-bold drop-shadow-lg">Plano Certo</span>
        </div>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Bem-vindo de volta
        </h1>
        <p className="text-gray-400 text-sm">Entre com suas credenciais para acessar sua conta</p>
      </div>

      {/* Formulário */}
      <form className="space-y-6">
        {/* Campo Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
          <input
            type="email"
            placeholder="seu@email.com"
            className="w-full px-4 py-3.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/80 transition-all duration-300 text-sm shadow-lg"
          />
        </div>

        {/* Campo Senha */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
          <input
            type="password"
            placeholder="••••••••••••"
            className="w-full px-4 py-3.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/80 transition-all duration-300 text-sm shadow-lg"
          />
        </div>

        {/* Lembrar-me & Esqueceu senha */}
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500" />
            <span className="text-gray-300">Lembrar-me</span>
          </label>
          <button className="text-indigo-400 hover:text-indigo-300 font-medium transition-all hover:underline">
            Esqueceu a senha?
          </button>
        </div>

        {/* Botão Entrar */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3.5 rounded-lg transition-all transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/50 text-sm"
        >
          ENTRAR
        </button>
      </form>

      {/* Footer - Criar conta */}
      <div className="text-center pt-4">
        <p className="text-gray-400 text-sm">
          Não tem uma conta?{' '}
          <button className="text-indigo-400 hover:text-indigo-300 font-semibold transition-all hover:underline">
            CRIAR CONTA
          </button>
        </p>
      </div>
    </div>
  </div>
</div>
```

### **Classes CSS Principais**

```css
/* Background com gradiente */
.bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900

/* Glass morphism card */
.bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10

/* Input com foco animado */
.focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/80 transition-all duration-300

/* Botão com gradiente e hover scale */
.bg-gradient-to-r from-indigo-600 to-purple-600
.hover:from-indigo-700 hover:to-purple-700
.transform hover:scale-[1.02]
.hover:shadow-2xl hover:shadow-indigo-500/50
```

---

## 📂 3. Sidebar

### **Design Visual**
- **Posição**: Fixed left, altura total
- **Background**: Light: `bg-slate-50` | Dark: `bg-gray-800`
- **Logo**: Integrada no topo sem divisória
- **Menu Items**: Botões com gradiente laranja quando ativo
- **Footer**: Border top com analytics badge

### **Estrutura HTML/JSX**

```tsx
<div className="w-64 bg-slate-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col fixed left-0 top-0 h-screen z-50">

  {/* 🎨 Logo integrada - sem divisória */}
  <div className="px-6 py-4">
    <div className="flex items-center">
      <img
        src="/logo.png"
        alt="Plano Certo Logo"
        className="h-12 w-12 object-contain flex-shrink-0 scale-[1.75] translate-y-1"
        style={{
          filter: theme === 'light'
            ? 'brightness(0) saturate(100%) invert(27%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(87%)'
            : 'none'
        }}
      />
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
          Plano Certo
        </h1>
        <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium tracking-wider leading-none mt-0.5">
          DELIVERY HUB
        </p>
      </div>
    </div>
  </div>

  {/* 📋 Menu de Navegação */}
  <nav className="flex-1 px-4 pb-4 space-y-2">
    {/* Item de menu ATIVO */}
    <button className="w-full justify-start items-center h-12 text-left px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg rounded-lg">
      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
      <span className="truncate">Financeiro</span>
    </button>

    {/* Item de menu INATIVO */}
    <button className="w-full justify-start items-center h-12 text-left px-4 text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 rounded-lg">
      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
      <span className="truncate">Sincronização iFood</span>
    </button>
  </nav>

  {/* 📊 Footer com Analytics Badge */}
  <div className="p-4 border-t border-gray-300 dark:border-gray-700">
    <div className="flex items-center justify-center space-x-2 mb-2">
      <BarChart className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      <span className="text-xs text-gray-500 dark:text-gray-400">Analytics Powered</span>
    </div>
    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
      © 2024 Plano Certo Financial
    </div>
  </div>
</div>
```

### **Classes CSS Principais**

```css
/* Sidebar container */
.w-64 fixed left-0 top-0 h-screen z-50

/* Menu item ativo (gradiente laranja) */
.bg-gradient-to-r from-orange-500 to-orange-600 text-white
.hover:from-orange-600 hover:to-orange-700 shadow-lg

/* Menu item inativo */
.text-gray-700 hover:text-gray-900 hover:bg-gray-100
.dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700

/* Logo filter para modo claro */
filter: brightness(0) saturate(100%) invert(27%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(87%)
```

---

## 🎯 4. Header

### **Design Visual**
- **Posição**: Fixed top, começa após sidebar (left-64)
- **Background**: White/Dark com border bottom
- **Elementos**: Theme toggle, notificações, dropdown de usuário
- **Altura**: 16 (64px)

### **Estrutura HTML/JSX**

```tsx
<header className="fixed top-0 left-64 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
  <div className="flex items-center justify-between h-16 px-4">

    {/* Espaçador para manter layout */}
    <div className="flex-1"></div>

    {/* 🔧 Utilitários - Theme, Notificações e Usuário */}
    <div className="flex items-center space-x-4">

      {/* Theme Toggle */}
      <button className="relative" title="Mudar para modo escuro/claro">
        {/* Modo claro: Moon icon */}
        <Moon className="h-5 w-5" />
        {/* Modo escuro: Sun icon */}
        <Sun className="h-5 w-5" />
      </button>

      {/* Notificações com badge animado */}
      <button className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
      </button>

      {/* Dropdown do Usuário */}
      <button className="flex items-center space-x-2">
        <User className="h-5 w-5" />
        <span className="font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
          Nome do Usuário
        </span>
      </button>
    </div>
  </div>
</header>
```

### **Classes CSS Principais**

```css
/* Header fixo */
.fixed top-0 left-64 right-0 z-40
.bg-white dark:bg-gray-900
.border-b border-gray-200 dark:border-gray-700 shadow-sm

/* Badge de notificação animado */
.absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse

/* Truncate text do usuário */
.max-w-[120px] truncate
```

---

## 🎨 5. Paleta de Cores

### **Cores Principais**

```css
/* Login & Gradientes */
--bg-login: linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a);
--accent-primary: linear-gradient(to right, #4f46e5, #7c3aed); /* Indigo to Purple */
--accent-hover: linear-gradient(to right, #4338ca, #6d28d9);

/* Sidebar */
--sidebar-light: #f8fafc; /* slate-50 */
--sidebar-dark: #1f2937; /* gray-800 */
--menu-active: linear-gradient(to right, #f97316, #ea580c); /* Orange 500 to 600 */
--menu-hover: linear-gradient(to right, #ea580c, #c2410c); /* Orange 600 to 700 */

/* Header */
--header-light: #ffffff;
--header-dark: #111827; /* gray-900 */
--border-light: #e5e7eb; /* gray-200 */
--border-dark: #374151; /* gray-700 */

/* Text Colors */
--text-primary-light: #111827; /* gray-900 */
--text-primary-dark: #ffffff;
--text-secondary-light: #6b7280; /* gray-500 */
--text-secondary-dark: #9ca3af; /* gray-400 */
--text-accent: #f97316; /* orange-500 */
```

### **Paleta Completa Tailwind**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Login & Accent
        'login-bg': {
          from: '#0f172a',
          via: '#1e293b',
          to: '#0f172a'
        },
        'accent': {
          indigo: '#4f46e5',
          purple: '#7c3aed',
          orange: '#f97316'
        },

        // Sidebar
        'sidebar': {
          light: '#f8fafc',
          dark: '#1f2937'
        },

        // Menu Active
        'menu-active': {
          from: '#f97316',
          to: '#ea580c'
        }
      }
    }
  }
}
```

---

## 🧩 6. Componentes Reutilizáveis

### **Button com Gradiente (Primary)**

```tsx
<button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3.5 rounded-lg transition-all transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm">
  TEXTO DO BOTÃO
</button>
```

### **Button com Gradiente (Laranja - Menu Ativo)**

```tsx
<button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg rounded-lg px-4 py-3 flex items-center gap-3">
  <Icon className="h-5 w-5" />
  <span>Texto do Menu</span>
</button>
```

### **Input com Glass Morphism**

```tsx
<input
  type="text"
  className="w-full px-4 py-3.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/80 transition-all duration-300 text-sm shadow-lg"
  placeholder="Texto placeholder"
/>
```

### **Card com Glass Morphism**

```tsx
<div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
  {/* Conteúdo do card */}
</div>
```

### **Badge de Notificação Animado**

```tsx
<div className="relative">
  <Bell className="h-5 w-5" />
  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
</div>
```

### **Dropdown Menu Item**

```tsx
<button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
  Item do Menu
</button>
```

---

## 📐 Layout e Spacing

### **Layout Principal**

```tsx
<div className="flex h-screen">
  {/* Sidebar - 256px (w-64) */}
  <aside className="w-64 fixed left-0 top-0 h-screen">
    <Sidebar />
  </aside>

  {/* Main Content Area */}
  <div className="flex-1 ml-64">
    {/* Header - 64px (h-16) */}
    <header className="fixed top-0 left-64 right-0 h-16">
      <Header />
    </header>

    {/* Content - começa após header */}
    <main className="mt-16 p-6">
      {/* Seu conteúdo aqui */}
    </main>
  </div>
</div>
```

### **Spacing Padrão**

```css
/* Padding interno de cards */
.p-8 /* 32px */
.p-6 /* 24px */
.p-4 /* 16px */

/* Gap entre elementos */
.space-y-6 /* 24px vertical */
.space-y-4 /* 16px vertical */
.space-x-4 /* 16px horizontal */

/* Margin entre seções */
.mb-6 /* 24px bottom */
.mt-8 /* 32px top */
```

---

## 🌓 Dark Mode Support

### **Implementação com Tailwind**

Todos os componentes usam prefixo `dark:` para modo escuro:

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <p className="text-gray-600 dark:text-gray-400">Texto secundário</p>
  <button className="border-gray-200 dark:border-gray-700">Botão</button>
</div>
```

### **Theme Context (React)**

```tsx
// contexts/ThemeContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {}
});

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Carregar preferência salva
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Aplicar classe no HTML
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
```

---

## 🎬 Animações

### **Animações CSS Personalizadas**

```css
/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        }
      }
    }
  }
}
```

### **Uso de Animações**

```tsx
{/* Fade in no card de login */}
<div className="animate-fade-in">Card content</div>

{/* Hover scale no botão */}
<button className="transform hover:scale-[1.02] transition-transform">
  Botão
</button>

{/* Pulse no badge de notificação */}
<span className="animate-pulse bg-red-500 rounded-full">Badge</span>
```

---

## 📝 Checklist de Implementação

### **Para replicar o design completo:**

- [ ] **Instalar Tailwind CSS** com dark mode habilitado
- [ ] **Configurar cores customizadas** no `tailwind.config.js`
- [ ] **Criar ThemeContext** para toggle dark/light
- [ ] **Implementar Login Page** com glass morphism
- [ ] **Criar Sidebar** com menu gradiente laranja
- [ ] **Criar Header** com theme toggle e notificações
- [ ] **Adicionar animações** personalizadas
- [ ] **Configurar layout** principal (sidebar + header + content)
- [ ] **Testar dark mode** em todos os componentes
- [ ] **Adicionar logo** nos locais corretos
- [ ] **Configurar filtros CSS** para logo no modo claro

---

## 🚀 Exemplos de Uso Rápido

### **Importar Componentes**

```tsx
import { Login } from './pages/auth/Login';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="mt-16">
            {/* Seu conteúdo */}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
```

---

## 📦 Dependências Necessárias

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "lucide-react": "^0.263.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "@supabase/supabase-js": "^2.0.0"
  }
}
```

---

**🎨 Fim do Guia de Design**

Este guia foi criado para facilitar a replicação do design visual do Financial Plano Certo em outros projetos.
Para dúvidas ou sugestões, consulte os arquivos originais em `/src/pages/auth/Login.tsx`, `/src/components/Sidebar.tsx` e `/src/components/Header.tsx`.
