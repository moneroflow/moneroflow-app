import { Shield, Lock, Globe, Server, Smartphone, Database, Eye, Layers } from 'lucide-react';

const nodes = [
  { icon: Smartphone, label: 'Your Browser', sub: 'React PWA · Keys never leave', color: 'text-primary' },
  { icon: Lock, label: 'Local Encryption', sub: 'AES-256 · IndexedDB vault', color: 'text-green-400' },
  { icon: Globe, label: 'HTTPS / TLS 1.3', sub: 'Standard port 443', color: 'text-blue-400' },
  { icon: Server, label: 'Akash Network', sub: 'Decentralized K8s cluster', color: 'text-red-400' },
  { icon: Database, label: 'Monero Node', sub: 'Remote RPC · No wallet server', color: 'text-orange-400' },
  { icon: Layers, label: 'Ring Signatures', sub: 'Mandatory 16-member rings', color: 'text-purple-400' },
  { icon: Eye, label: 'Stealth Addresses', sub: 'One-time output keys', color: 'text-cyan-400' },
  { icon: Shield, label: 'Blockchain', sub: 'Immutable · Private ledger', color: 'text-primary' },
];

export default function ArchitectureDiagram() {
  return (
    <section className="py-16">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">
          How <span className="text-primary">MoneroFlow</span> Protects You
        </h2>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto text-sm">
          Every layer is designed for maximum privacy and zero trust — your keys never leave your browser.
        </p>

        {/* Flow diagram */}
        <div className="relative max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {nodes.map((n, i) => (
              <div key={n.label} className="relative flex flex-col items-center text-center group">
                {/* connector line */}
                {i < nodes.length - 1 && i % 4 !== 3 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-border/60 z-0" />
                )}
                <div className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center mb-2 relative z-10 group-hover:border-primary/40 transition-colors">
                  <n.icon className={`w-6 h-6 ${n.color}`} />
                </div>
                <span className="text-xs font-semibold text-foreground leading-tight">{n.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{n.sub}</span>
              </div>
            ))}
          </div>

          {/* Privacy callouts */}
          <div className="mt-8 grid sm:grid-cols-3 gap-3 text-xs">
            {[
              { title: '🔒 Zero-Knowledge', desc: 'Server never sees spend keys, seeds, or balances.' },
              { title: '🌐 Decentralized Infra', desc: 'Hosted on Akash — no single cloud provider can censor.' },
              { title: '🛡️ Full Isolation', desc: 'Each merchant tab is a sandboxed wallet — no cross-leak.' },
            ].map(c => (
              <div key={c.title} className="p-3 rounded-lg bg-card border border-border/60">
                <span className="font-semibold text-foreground">{c.title}</span>
                <p className="text-muted-foreground mt-0.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
