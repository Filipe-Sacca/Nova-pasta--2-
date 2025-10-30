
import {
  Utensils,
  Settings,
  Activity,
  Clock,
  QrCode,
  BarChart,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

export const Sidebar = ({ activeModule, onModuleChange }: SidebarProps) => {
  const { theme } = useTheme();

  const menuItems = [
    { id: 'menu-management', label: 'Gestão Menu', icon: Utensils },
    { id: 'ifood-api', label: 'API iFood', icon: Settings },
    { id: 'store-monitoring', label: 'Monitoramento', icon: Activity },
    { id: 'opening-hours', label: 'Horários', icon: Clock },
    { id: 'qr-code-generator', label: 'QR Code', icon: QrCode },
  ];

  return (
    <div className="w-64 bg-slate-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col fixed left-0 top-0 h-screen z-[100]">

      {/* 🎨 Logo integrada - sem divisória */}
      <div className="px-6 py-4">
        <div className="flex items-center">
          <img
            src="/logo-plano-certo.png"
            alt="Plano Certo Logo"
            className="h-12 w-12 object-contain flex-shrink-0 scale-[1.75] translate-y-1"
            style={{
              filter: theme === 'dark'
                ? 'brightness(0) saturate(100%) invert(57%) sepia(82%) saturate(1500%) hue-rotate(360deg) brightness(102%) contrast(101%)'
                : 'brightness(0) saturate(100%) invert(27%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(87%)'
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
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={
                isActive
                  ? "w-full flex justify-start items-center h-12 text-left px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg rounded-lg transition-all"
                  : "w-full flex justify-start items-center h-12 text-left px-4 text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 rounded-lg transition-all"
              }
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
              <span className="truncate text-sm">{item.label}</span>
            </button>
          );
        })}
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
  );
};
