import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { AppConfig, MarketCode } from '../config/markets';

export interface Project {
  id: string;
  market: MarketCode;
  name: string;
  owner: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: string;
  vendorIds: string[];
}
export interface Requirement {
  id: string;
  projectId: string;
  name: string;
  priority: 'must' | 'should' | 'could';
}
export interface Vendor {
  id: string;
  market: MarketCode;
  name: string;
  city: string;
  expertise: string[];
  rating: number;
  certifications: string[];
  contact: string;
}
export interface Rfp {
  id: string;
  projectId: string;
  title: string;
  requirementIds: string[];
  vendorIds: string[];
  deadline: string;
  status: string;
}
export interface Proposal {
  id: string;
  rfpId: string;
  vendorId: string;
  priceNet: number;
  vat: number;
  gross: number;
  deliveryMonths: number;
  status: string;
}
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'buyer' | 'vendor';
  market: MarketCode;
  vendorId: string | null;
  active: boolean;
}

/**
 * Thin, typed wrapper around ProcureLab's /api endpoints.
 * Every call fails fast with the HTTP status and body, so a broken precondition
 * is reported as a setup error instead of a confusing UI failure later.
 */
export class TestDataApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  private get headers() {
    return { 'x-test-token': this.token };
  }

  private async ok<T>(res: APIResponse, expected: number[] = [200, 201]): Promise<T> {
    if (!expected.includes(res.status())) {
      throw new Error(`${res.url()} returned ${res.status()}: ${await res.text()}`);
    }
    return (res.status() === 204 ? undefined : await res.json()) as T;
  }

  health() {
    return this.request.get('/api/health').then((r) => this.ok<{ status: string; version: string }>(r));
  }
  config() {
    return this.request.get('/api/config').then((r) => this.ok<AppConfig>(r));
  }
  reset() {
    return this.request.post('/api/test/reset', { headers: this.headers }).then((r) => this.ok(r));
  }

  createProject(data: Omit<Project, 'id' | 'vendorIds' | 'status'> & { status?: string; description?: string }) {
    return this.request.post('/api/projects', { headers: this.headers, data }).then((r) => this.ok<Project>(r));
  }
  deleteProject(id: string) {
    return this.request.delete(`/api/projects/${id}`, { headers: this.headers }).then((r) => this.ok<void>(r, [204, 404]));
  }
  listProjects(market: MarketCode) {
    return this.request.get(`/api/projects?market=${market}`, { headers: this.headers }).then((r) => this.ok<Project[]>(r));
  }

  addRequirement(projectId: string, data: { name: string; priority?: Requirement['priority'] }) {
    return this.request.post(`/api/projects/${projectId}/requirements`, { headers: this.headers, data }).then((r) => this.ok<Requirement>(r));
  }

  listVendors(market: MarketCode) {
    return this.request.get(`/api/vendors?market=${market}`, { headers: this.headers }).then((r) => this.ok<Vendor[]>(r));
  }
  createVendor(data: Omit<Vendor, 'id'> & { contactEmail?: string }) {
    return this.request.post('/api/vendors', { headers: this.headers, data }).then((r) => this.ok<Vendor>(r));
  }
  deleteVendor(id: string) {
    return this.request.delete(`/api/vendors/${id}`, { headers: this.headers }).then((r) => this.ok<void>(r, [204, 404]));
  }

  createRfp(projectId: string, data: { title: string; requirementIds: string[]; vendorIds: string[]; deadline: string }) {
    return this.request.post(`/api/projects/${projectId}/rfps`, { headers: this.headers, data }).then((r) => this.ok<Rfp>(r));
  }
  getRfp(id: string) {
    return this.request.get(`/api/rfps/${id}`, { headers: this.headers }).then((r) => this.ok<Rfp & { state: string; proposals: Proposal[] }>(r));
  }
  submitProposal(rfpId: string, data: { vendorId: string; priceNet: number; deliveryMonths: number; note?: string }) {
    return this.request.post(`/api/rfps/${rfpId}/proposals`, { headers: this.headers, data }).then((r) => this.ok<Proposal>(r));
  }

  createUser(data: { name: string; email: string; role: User['role']; market: MarketCode; vendorId?: string; password: string }) {
    return this.request.post('/api/users', { headers: this.headers, data }).then((r) => this.ok<User>(r));
  }
  listUsers() {
    return this.request.get('/api/users', { headers: this.headers }).then((r) => this.ok<User[]>(r));
  }
  i18n() {
    return this.request.get('/api/i18n').then((r) => this.ok<{ strings: Record<string, Record<string, string>>; missing: Record<string, string[]> }>(r));
  }
  deleteUser(id: string) {
    return this.request.delete(`/api/users/${id}`, { headers: this.headers }).then((r) => this.ok<void>(r, [204, 404]));
  }
}
