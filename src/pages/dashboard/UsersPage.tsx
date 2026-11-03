import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/FadeIn';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, ShieldCheck, Plus, Trash2, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
/** Simple hash for local admin password lock */
function hashPassword(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const chr = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

export default function UsersPage() {
  const merchant = useStore(s => s.merchant);
  const updateMerchant = useStore(s => s.updateMerchant);
  const isPro = merchant.plan === 'pro';
  const [showSetAdmin, setShowSetAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [unlockPass, setUnlockPass] = useState('');

  const adminPasswordSet = !!merchant.adminPasswordHash;
  const users = merchant.posUsers || [];
  const [currentPass, setCurrentPass] = useState(''); // For verifying current password when changing


  const handleSetAdminPassword = () => {
    // If password is already set, verify current password first
    if (adminPasswordSet) {
      if (!currentPass || hashPassword(currentPass) !== merchant.adminPasswordHash) {
        toast.error('Current password is incorrect');
        return;
      }
    }
    
    if (adminPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (adminPass !== adminPassConfirm) { toast.error('Passwords do not match'); return; }
    updateMerchant({ adminPasswordHash: hashPassword(adminPass) });
    setShowSetAdmin(false);
    setAdminPass('');
    setAdminPassConfirm('');
    setCurrentPass('');
    toast.success(adminPasswordSet ? 'Password updated! 🔒' : 'Admin password set! 🔒');
  };

  const handleUnlockAdmin = () => {
    if (hashPassword(unlockPass) === merchant.adminPasswordHash) {
      setAdminUnlocked(true);
      setUnlockPass('');
      toast.success('Admin unlocked');
    } else {
      toast.error('Wrong admin password');
    }
  };

  const handleAddUser = () => {
    if (!newUsername.trim()) { toast.error('Enter a username'); return; }
    if (newUserPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (users.find(u => u.name.toLowerCase() === newUsername.toLowerCase())) {
      toast.error('Username already exists');
      return;
    }
    const newUser = {
      id: 'user_' + Math.random().toString(36).slice(2, 6),
      name: newUsername.trim(),
      pin: newUserPin,
      createdAt: new Date().toISOString(),
      role: 'cashier' as const,
    };
    updateMerchant({ posUsers: [...users, newUser] });
    setNewUsername('');
    setNewUserPin('');
    setShowAddUser(false);
    toast.success(`User "${newUser.name}" created`);
  };

  const handleDeleteUser = (id: string) => {
    updateMerchant({ posUsers: users.filter(u => u.id !== id) });
    toast.success('User removed');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Users & Access
          <HelpTooltip
            title="Users & Access"
            text="Manage your admin password and PoS cashier users. Each cashier has a name and PIN, and their sales are tracked separately."
          />
        </h1>
        <p className="text-muted-foreground text-sm">Manage admin password and PoS cashier users</p>
      </FadeIn>

      {/* Admin Password Section */}
      <FadeIn delay={0.03}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Admin Password
                <HelpTooltip
                  title="Admin Password"
                  text="The admin password protects destructive actions like deleting items, exporting data, restoring backups, and managing users."
                />
              </h2>
            </div>
            <Badge variant="outline" className={adminPasswordSet ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
              {adminPasswordSet ? 'Set' : 'Not Set'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            The admin password protects destructive actions: changing PoS prices, deleting items, exporting accounting data,
            restoring backups, deleting subscriptions, and simulating payments.
          </p>

          {!adminPasswordSet ? (
            <Button onClick={() => setShowSetAdmin(true)} className="bg-gradient-orange hover:opacity-90">
              <KeyRound className="w-4 h-4 mr-2" /> Set Admin Password
            </Button>
          ) : adminUnlocked ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-success/10 text-success border-success/20"><Lock className="w-3 h-3 mr-1" /> Unlocked</Badge>
              <Button variant="ghost" size="sm" onClick={() => setAdminUnlocked(false)} className="text-muted-foreground text-xs">Lock</Button>
              <Button variant="outline" size="sm" onClick={() => { setShowSetAdmin(true); }} className="text-xs border-border">Change Password</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input type="password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)} placeholder="Enter admin password" className="bg-background border-border max-w-xs" onKeyDown={e => e.key === 'Enter' && handleUnlockAdmin()} />
              <Button onClick={handleUnlockAdmin} className="bg-gradient-orange hover:opacity-90">Unlock</Button>
            </div>
          )}
        </div>
      </FadeIn>

      {/* PoS Users */}
      <FadeIn delay={0.06}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">PoS Cashier Users</h2>
            </div>
            {adminUnlocked && isPro && (
              <Button variant="outline" size="sm" onClick={() => setShowAddUser(true)} className="border-border hover:border-primary/50">
                <Plus className="w-4 h-4 mr-1" /> Add User
              </Button>
            )}
            {adminUnlocked && !isPro && (
              <Badge variant="outline" className="text-primary border-primary/30 text-xs">Pro Only</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Create cashier users for the PoS Terminal. Each user has a name and PIN. Invoices and reports can be filtered by user. Only admins can create/delete users.
          </p>

          {!adminUnlocked && adminPasswordSet && (
            <p className="text-sm text-warning">🔒 Unlock admin to manage users.</p>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No users yet. All sales are attributed to the admin account.</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">Created {new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-muted-foreground">{u.role}</Badge>
                    {adminUnlocked && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="text-foreground">Add Cashier User</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Username</Label>
                  <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. Sarah" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">PIN (min 4 digits)</Label>
                  <Input value={newUserPin} onChange={e => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="1234" className="bg-background border-border font-mono" />
                </div>
                <Button onClick={handleAddUser} className="w-full bg-gradient-orange hover:opacity-90">Create User</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      {/* Admin-protected actions info */}
      <FadeIn delay={0.09}>
        <div className="p-6 rounded-xl bg-card border border-border space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Protected Actions</h2>
          <p className="text-xs text-muted-foreground">The following actions require the admin password:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Change PoS item prices',
              'Delete PoS items',
              'Export accounting data',
              'Restore from backup',
              'Delete subscriptions',
              'Simulate payments',
              'View Payouts sensitive info',
              'Delete account (Danger Zone)',
              'Create/delete users',
            ].map(action => (
              <div key={action} className="flex items-center gap-2 text-sm text-foreground">
                <Lock className="w-3 h-3 text-warning shrink-0" />
                {action}
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Password Dialog - shared for Set and Change */}
      <Dialog open={showSetAdmin} onOpenChange={setShowSetAdmin}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{adminPasswordSet ? 'Change Admin Password' : 'Set Admin Password'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {adminPasswordSet && (
              <div className="space-y-2">
                <Label className="text-foreground">Current Password</Label>
                <Input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Enter current password" className="bg-background border-border" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-foreground">{adminPasswordSet ? 'New Password (min 6 chars)' : 'Password (min 6 chars)'}</Label>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} value={adminPass} onChange={e => setAdminPass(e.target.value)} className="bg-background border-border pr-10" />
                <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{adminPasswordSet ? 'Confirm New Password' : 'Confirm Password'}</Label>
              <Input type="password" value={adminPassConfirm} onChange={e => setAdminPassConfirm(e.target.value)} className="bg-background border-border" />
            </div>
            <Button onClick={handleSetAdminPassword} className="w-full bg-gradient-orange hover:opacity-90">{adminPasswordSet ? 'Update Password' : 'Save Admin Password'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
