import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

export interface ProjectInput {
  name: string;
  owner: string;
  budget: number | string;
  startDate: string;
  endDate: string;
  status?: string;
  description?: string;
}

/** Projects list (search, filter) and the create/edit project form. */
export class ProjectsPage extends BasePage {
  readonly rows: Locator;
  readonly links: Locator;
  readonly search: Locator;
  readonly statusFilter: Locator;
  readonly applyFilters: Locator;
  readonly newProject: Locator;
  readonly empty: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.rows = page.getByTestId('project-row');
    this.links = page.getByTestId('project-link');
    this.search = page.getByTestId('input-search');
    this.statusFilter = page.getByTestId('input-status');
    this.applyFilters = page.getByTestId('apply-filters');
    this.newProject = page.getByTestId('new-project');
    this.empty = page.getByTestId('projects-empty');
  }

  async goto() {
    await this.open('/projects');
  }
  async gotoNew() {
    await this.open('/projects/new');
  }

  row(name: string): Locator {
    return this.rows.filter({ has: this.page.getByTestId('project-link').getByText(name, { exact: true }) });
  }
  async openProject(name: string) {
    await this.row(name).getByTestId('project-link').click();
  }

  async filter({ q = '', status = '' }: { q?: string; status?: string }) {
    await this.search.fill(q);
    await this.statusFilter.selectOption(status);
    await this.applyFilters.click();
  }

  /** Fills the project form; leaves fields untouched when a value is undefined. */
  async fillForm(p: Partial<ProjectInput>) {
    if (p.name !== undefined) await this.page.getByTestId('input-name').fill(p.name);
    if (p.owner !== undefined) await this.page.getByTestId('input-owner').fill(p.owner);
    if (p.budget !== undefined) await this.page.getByTestId('input-budget').fill(String(p.budget));
    if (p.status !== undefined) await this.page.getByTestId('input-status').selectOption(p.status);
    if (p.startDate !== undefined) await this.page.getByTestId('input-startDate').fill(p.startDate);
    if (p.endDate !== undefined) await this.page.getByTestId('input-endDate').fill(p.endDate);
    if (p.description !== undefined) await this.page.getByTestId('input-description').fill(p.description);
  }

  async save() {
    await this.page.getByTestId('save-project').click();
  }

  fieldError(field: 'name' | 'owner' | 'budget' | 'startDate' | 'endDate'): Locator {
    return this.page.getByTestId(`error-${field}`);
  }
}
