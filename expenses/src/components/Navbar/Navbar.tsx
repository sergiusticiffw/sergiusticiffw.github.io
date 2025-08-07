import { NavLink } from 'react-router-dom';
import { useAuthState } from '@context/context';
import {
  BarChart3,
  Home,
  DollarSign,
  Plus,
  User,
  HandCoins,
  Menu,
  X,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { AuthState } from '@type/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const { userIsLoggedIn } = useAuthState() as AuthState;
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = startX - touch.clientX;
      const deltaY = startY - touch.clientY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          setIsOpen(true); // Swipe left to open
        } else {
          setIsOpen(false); // Swipe right to close
        }
      }
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const navItems = [
    { to: "/expenses/", icon: Home, label: "Home", end: true },
    { to: "/expenses/charts", icon: BarChart3, label: "Charts" },
    { to: "/expenses/add-transaction", icon: Plus, label: "Add" },
    { to: "/expenses/income", icon: DollarSign, label: "Income" },
    { to: "/expenses/loans", icon: HandCoins, label: "Loans" },
  ];

  if (userIsLoggedIn) {
    navItems.push({ to: "/expenses/user", icon: User, label: "Profile" });
  }

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 md:hidden bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background/90 transition-all duration-200"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <X className="h-5 w-5 transition-transform duration-200 rotate-90" />
          ) : (
            <Menu className="h-5 w-5 transition-transform duration-200" />
          )}
        </Button>
      )}

      {/* Sidebar */}
      <nav
        className={cn(
          "fixed left-0 top-0 h-full bg-gradient-to-b from-background to-muted/20 border-r border-border/50 backdrop-blur-sm z-40 transition-all duration-300 ease-in-out shadow-xl",
          isMobile ? "w-72" : "w-72",
          isMobile && !isOpen ? "-translate-x-full" : "translate-x-0",
          !isMobile && "translate-x-0"
        )}
        onTouchStart={isMobile ? handleTouchStart : undefined}
      >
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <DollarSign className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Expenses</h1>
                <p className="text-xs text-muted-foreground">Track your finances</p>
              </div>
            </div>
          </div>
          
          {/* Navigation Items */}
          <ul className="space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                        isActive
                          ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:shadow-md"
                      )
                    }
                    onClick={() => isMobile && setIsOpen(false)}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn(
                          "relative z-10 transition-transform duration-200",
                          "group-hover:scale-110"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="font-medium relative z-10">{item.label}</span>
                        {isActive && (
                          <div className="absolute right-2 w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
          
          {/* Footer */}
          <div className="pt-6 border-t border-border/50">
            <div className="text-xs text-muted-foreground text-center">
              Made with ❤️
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in-0 duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;
