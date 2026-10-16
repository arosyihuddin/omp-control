import type { ToolCategory, ToolPermissionSection } from "$lib/types";

export const riskOptions = [
  { value: "all", label: "Semua risiko" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "isolated", label: "Isolated" },
];

export const permissionOptions = [
  { value: "always_allow", label: "Selalu Izinkan" },
  { value: "require_approval", label: "Perlu Persetujuan" },
  { value: "blocked", label: "Blokir" },
  { value: "custom", label: "Kustom" },
];

export const toolPermissionSections: {
  id: ToolPermissionSection;
  label: string;
  description: string;
}[] = [
  {
    id: "read_only",
    label: "Read-only tools",
    description: "Kebijakan default untuk tool berisiko rendah.",
  },
  {
    id: "edit_delete",
    label: "Edit/Delete tools",
    description: "Kebijakan default untuk tool yang dapat mengubah state.",
  },
  {
    id: "other",
    label: "Other tools",
    description: "Kebijakan default untuk tool terisolasi atau kategori risiko lain.",
  },
];

export const toolCategories: {
  id: ToolCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "system_diagnostics",
    label: "System & Diagnostics",
    description: "Informasi host, hardware, dan kapabilitas sistem.",
  },
  {
    id: "desktop_automation",
    label: "Desktop & GUI Automation",
    description: "Kontrol aplikasi, jendela, mouse, keyboard, dan screenshot.",
  },
  {
    id: "files_search",
    label: "Files & Search",
    description: "Membaca file serta mencari file dan konten.",
  },
  {
    id: "code_development",
    label: "Code Development & Debugging",
    description: "Mengedit kode, analisis sintaks, LSP, dan debugging.",
  },
  {
    id: "terminal_execution",
    label: "Terminal & Execution",
    description: "Menjalankan perintah dan evaluasi kode.",
  },
  {
    id: "web_research",
    label: "Web & Research",
    description: "Pencarian informasi di web.",
  },
  {
    id: "network_tunnels",
    label: "Network & Tunnels",
    description: "Status dan pengelolaan Cloudflare Tunnel.",
  },
  {
    id: "agent_workflow",
    label: "Agent Workflow & Context",
    description: "Task, todo, konteks, dan pengelolaan kemampuan agent.",
  },
];
