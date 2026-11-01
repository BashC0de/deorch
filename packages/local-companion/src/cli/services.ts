import { Command } from 'commander';
import { apiRequest, getAuthHeaders } from './api.js';

interface ServiceResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  status: string;
  health_path: string | null;
}

export const servicesCommand = new Command('services')
  .description('Manage monitored development services');

servicesCommand
  .command('add')
  .description('Register a development service for monitoring')
  .requiredOption('--name <name>', 'Service display name')
  .requiredOption('--port <port>', 'Service port')
  .option('--host <host>', 'Service host', 'localhost')
  .option('--health <path>', 'Health check endpoint path')
  .option('--project-id <id>', 'Associated project ID')
  .action(async (opts: { name: string; port: string; host: string; health?: string; projectId?: string }) => {
    try {
      const headers = getAuthHeaders();
      const svc = await apiRequest<ServiceResponse>('/api/v1/services', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: opts.name,
          host: opts.host,
          port: parseInt(opts.port, 10),
          health_path: opts.health ?? null,
          project_id: opts.projectId ?? null,
        }),
      });
      console.log(`Service registered: ${svc.name} (${svc.host}:${svc.port})`);
      console.log(`  ID: ${svc.id}`);
    } catch (err) {
      console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

servicesCommand
  .command('list')
  .description('List monitored services')
  .action(async () => {
    try {
      const headers = getAuthHeaders();
      const services = await apiRequest<ServiceResponse[]>('/api/v1/services', { headers });

      if (services.length === 0) {
        console.log('No services registered. Use "deorch services add" to register one.');
        return;
      }

      console.log('Monitored Services');
      console.log('─'.repeat(70));
      for (const svc of services) {
        const statusDot = svc.status === 'HEALTHY' ? '+' : svc.status === 'STOPPED' ? 'x' : '?';
        console.log(`  [${statusDot}] ${svc.name.padEnd(20)} ${svc.host}:${svc.port}  ${svc.status}`);
      }
    } catch (err) {
      console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

servicesCommand
  .command('remove <id>')
  .description('Remove a monitored service')
  .action(async (id: string) => {
    try {
      const headers = getAuthHeaders();
      await apiRequest(`/api/v1/services/${id}`, { method: 'DELETE', headers });
      console.log('Service removed.');
    } catch (err) {
      console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
