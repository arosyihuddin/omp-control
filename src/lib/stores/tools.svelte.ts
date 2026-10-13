import { errorMessage, toolsApi } from '$lib/api';
import type { Tool, ToolCustomRule, ToolPermission } from '$lib/types';

class ToolsStore {
  items = $state<Tool[]>([]);
  loading = $state(true);
  error = $state('');
  updating = $state<ReadonlySet<string>>(new Set());

  async load() {
    this.error = '';
    try {
      this.items = await toolsApi.list();
    } catch (error) {
      this.error = errorMessage(error, 'Unable to load tools');
    } finally {
      this.loading = false;
    }
  }

  async setPermission(tool: Tool, permission: ToolPermission | null, customRule?: ToolCustomRule) {
    if (this.updating.has(tool.name)) return;
    this.updating = new Set(this.updating).add(tool.name);
    this.error = '';
    try {
      const updated = await toolsApi.setPermission(tool.name, permission, customRule);
      this.items = this.items.map((item) => item.name === tool.name ? updated : item);
    } catch (error) {
      this.error = errorMessage(error, 'Unable to update tool permission');
    } finally {
      const next = new Set(this.updating); next.delete(tool.name); this.updating = next;
    }
  }

  async setSectionPermission(section: Tool['section'], permission: ToolPermission, customRule?: ToolCustomRule) {
    const names = this.items.filter((tool) => tool.section === section).map((tool) => tool.name);
    if (!names.length || names.some((name) => this.updating.has(name))) return;
    this.updating = new Set([...this.updating, ...names]);
    this.error = '';
    try {
      const response = await toolsApi.setSectionPermission(section, permission, customRule);
      this.items = response.tools;
    } catch (error) {
      this.error = errorMessage(error, 'Unable to update section permission');
    } finally {
      const next = new Set(this.updating); names.forEach((name) => next.delete(name)); this.updating = next;
    }
  }

  async toggleExposure(tool: Tool) {
    if (this.updating.has(tool.name)) return;
    this.updating = new Set(this.updating).add(tool.name);
    this.error = '';
    try {
      const updated = await toolsApi.setExposed(tool.name, !tool.exposed);
      this.items = this.items.map((item) => (item.name === tool.name ? updated : item));
    } catch (error) {
      this.error = errorMessage(error, 'Unable to update tool exposure');
    } finally {
      const next = new Set(this.updating);
      next.delete(tool.name);
      this.updating = next;
    }
  }
}

export const tools = new ToolsStore();
