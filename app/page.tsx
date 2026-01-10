import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function Home() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "350px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <span className="text-sm font-medium">Email Preview</span>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          <div className="text-muted-foreground text-center text-sm">
            Select an email to view its content
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
