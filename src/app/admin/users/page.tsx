import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/require';
import { hashPassword } from '@/lib/auth/password';

export default async function AdminUsersPage() {
  requireRole('ADMIN');
  const users = await prisma.user.findMany({
    include: { memberships: { include: { tenant: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });

  async function createUser(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const role = String(formData.get('role') ?? '');
    const tenantId = String(formData.get('tenantId') ?? '');

    if (!email || !password || !role) return;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password)
      }
    });

    if (role === 'ADMIN') {
      await prisma.tenantUser.create({
        data: {
          userId: user.id,
          role: 'PLATFORM_ADMIN',
          tenantId: null
        }
      });
    }

    if (role === 'ORGANISATEUR' && tenantId) {
      await prisma.tenantUser.create({
        data: {
          userId: user.id,
          role: 'ORGANIZER_ADMIN',
          tenantId
        }
      });
    }

    if (role === 'PARTENAIRE' && tenantId) {
      await prisma.tenantUser.create({
        data: {
          userId: user.id,
          role: 'PARTNER_ADMIN',
          tenantId
        }
      });
    }

    redirect('/admin/users');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Utilisateurs</h1>

      <form action={createUser} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Creer un utilisateur</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nom
            <input name="name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input name="email" type="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe
            <input name="password" type="password" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Role
            <select name="role" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required>
              <option value="">Selectionner</option>
              <option value="ADMIN">ADMIN</option>
              <option value="ORGANISATEUR">ORGANISATEUR</option>
              <option value="PARTENAIRE">PARTENAIRE</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Tenant (organisateur/partenaire)
          <select name="tenantId" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="">Aucun</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.type})
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Creer
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{user.name ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {user.memberships.map((m) => `${m.role}${m.tenant ? ` (${m.tenant.name})` : ''}`).join(', ')}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={3}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
