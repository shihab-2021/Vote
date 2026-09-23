import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Upload, ListPlus, LogOut, Vote, FileScan,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "ড্যাশবোর্ড", icon: LayoutDashboard, end: true },
  { to: "/voters", label: "ভোটার তালিকা", icon: Users },
  { to: "/convert", label: "PDF কনভার্ট", icon: FileScan, adminOnly: true },
  { to: "/import", label: "ইমপোর্ট", icon: Upload, adminOnly: true },
  { to: "/fields", label: "কাস্টম ফিল্ড", icon: ListPlus, adminOnly: true },
];

function isActivePath(item: NavItem, pathname: string) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const visibleNav = NAV.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <SidebarProvider>
      {/* ডেস্কটপ/ট্যাবলেট -- বিদ্যমান sidebar অপরিবর্তিত */}
      <Sidebar collapsible="icon" className="hidden md:flex">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Vote className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold">ভোটার তালিকা</span>
              <span className="text-xs text-muted-foreground">ম্যানেজমেন্ট অ্যাপ</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>মেনু</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={isActivePath(item, location.pathname)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {user?.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium">{user?.username}</span>
              <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 group-data-[collapsible=icon]:hidden"
              onClick={() => logout()}
              title="লগআউট"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* মোবাইল -- কম্প্যাক্ট টপ বার (ব্র্যান্ড + প্রোফাইল), নেভিগেশন নিচের ট্যাব-বারে */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Vote className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">ভোটার তালিকা</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs text-muted-foreground active:bg-muted"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {user?.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="capitalize">{user?.role}</span>
          </button>
        </header>
        {/* ডেস্কটপ হেডার -- বিদ্যমান sidebar-toggle অপরিবর্তিত */}
        <header className="hidden h-14 shrink-0 items-center gap-2 border-b px-4 md:flex">
          <SidebarTrigger />
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>

        <MobileBottomNav items={visibleNav} pathname={location.pathname} />
      </SidebarInset>
    </SidebarProvider>
  );
}

function MobileBottomNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 backdrop-blur-sm md:hidden">
      {items.map((item) => {
        const active = isActivePath(item, pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 active:bg-muted/60"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full px-3 py-1 transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                "line-clamp-1 text-center text-[10px] leading-tight font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
